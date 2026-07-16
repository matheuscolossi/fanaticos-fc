require('./testEnv');

process.env.DATABASE_URL = '';
process.env.DB_REQUIRE_POSTGRES = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'stripe-test-jwt-secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_local_only';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_only';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const database = require('../src/config/database');
const cartService = require('../src/services/cartService');
const couponModel = require('../src/models/couponModel');
const couponService = require('../src/services/couponService');
const paymentModel = require('../src/models/paymentModel');
const promocaoService = require('../src/services/promocaoService');
const stripeService = require('../src/services/stripeService');
const orderService = require('../src/services/orderService');

let productId;
const eventIds = ['evt_test_duplicate', 'evt_test_rollback', 'evt_test_paid'];

before(async () => {
  await database.init();
  await database.run('DELETE FROM stripe_webhook_events WHERE id IN (?, ?, ?)', eventIds);
  await database.run(
    'DELETE FROM pedido_eventos WHERE pedido_id IN (SELECT id FROM pedidos WHERE stripe_session_id = ?)',
    ['cs_test_paid']
  );
  await database.run('DELETE FROM pedidos WHERE stripe_session_id = ?', ['cs_test_paid']);
  await database.run('DELETE FROM checkout_drafts WHERE id = ?', ['checkout_test_paid']);
  await database.run('DELETE FROM produtos WHERE sku = ?', ['stripe-test-sku']);
  const category = await database.get('SELECT id FROM categorias ORDER BY id LIMIT 1');
  const result = await database.run(
    `INSERT INTO produtos (nome, sku, preco, categoria_id, imagens, estoque, status)
     VALUES (?, ?, ?, ?, JSON_VALUE(?), ?, ?)`,
    ['Produto Stripe de teste', 'stripe-test-sku', 100, category.id, '[]', 10, 'ativo']
  );
  productId = result.lastID;
});

after(async () => {
  await database.run('DELETE FROM stripe_webhook_events WHERE id IN (?, ?, ?)', eventIds);
  await database.run(
    'DELETE FROM pedido_eventos WHERE pedido_id IN (SELECT id FROM pedidos WHERE stripe_session_id = ?)',
    ['cs_test_paid']
  );
  await database.run('DELETE FROM pedidos WHERE stripe_session_id = ?', ['cs_test_paid']);
  await database.run('DELETE FROM checkout_drafts WHERE id = ?', ['checkout_test_paid']);
  await database.run('DELETE FROM produtos WHERE id = ?', [productId]);
  await database.close();
});

test('normaliza apenas IDs, quantidades e variações permitidas', () => {
  const [item] = stripeService.normalizeCartItems([{
    productId: '12', qty: '2', price: 0,
    tamanho: ' M ', personalizacao: { nome: 'A'.repeat(80), numero: '10' },
  }]);
  assert.deepEqual(item, {
    productId: 12,
    qty: 2,
    tamanho: 'M',
    cor: null,
    personalizacao: { nome: 'A'.repeat(30), numero: '10' },
  });
});

test('recalcula o preço pelo banco e ignora preço adulterado no navegador', async () => {
  const summary = await cartService.buildCartSummary({
    items: [{ productId, qty: 2, price: 0 }],
  });
  assert.equal(summary.subtotal, 200);
});

test('representa promoções percentual, fixa e preço fixo no preço unitário do Stripe', () => {
  const product = { id: productId, categoria_id: 1, preco: 100, preco_promocional: null };
  const cases = [
    [{ nome: '10%', tipo: 'percentual', valor: 10, produtos_ids: [], categorias_ids: [] }, 90],
    [{ nome: 'R$ 15', tipo: 'fixo', valor: 15, produtos_ids: [], categorias_ids: [] }, 85],
    [{ nome: 'Preço final', tipo: 'preco_fixo', valor: 79.99, produtos_ids: [], categorias_ids: [] }, 79.99],
  ];

  for (const [promotion, expectedPrice] of cases) {
    const { precoFinal } = promocaoService.calcularPrecoComPromocao(product, [promotion]);
    const pricing = stripeService.buildCheckoutPricing({
      items: [{ name: 'Produto', price: precoFinal, qty: 2 }],
      freight: 0,
      promocoesDesconto: 0,
      discount: 0,
      total: expectedPrice * 2,
    });
    assert.equal(pricing.lineItems[0].price_data.unit_amount, cartService.moneyToCents(expectedPrice));
    assert.equal(pricing.totalCents, cartService.moneyToCents(expectedPrice * 2));
  }
});

test('representa compre X leve Y como desconto fixo em centavos no Stripe', async (t) => {
  t.mock.method(promocaoService, 'getPromocoesAtivas', async () => [{
    nome: 'Compre 2 leve 3', tipo: 'compre_x_leve_y', compre_qtd: 2, leve_qtd: 3,
    produtos_ids: [productId], categorias_ids: [],
  }]);

  const summary = await cartService.buildCartSummary({ items: [{ productId, qty: 3 }] });
  const pricing = stripeService.buildCheckoutPricing(summary);

  assert.equal(summary.subtotal, 200);
  assert.equal(summary.promocoesDesconto, 100);
  assert.equal(pricing.lineItems[0].price_data.unit_amount, 10000);
  assert.equal(pricing.totalDiscountCents, 10000);
  assert.equal(pricing.totalCents, 20000);
});

test('representa desconto progressivo como desconto fixo em centavos no Stripe', async (t) => {
  t.mock.method(promocaoService, 'getPromocoesAtivas', async () => [{
    nome: 'Progressivo 15%', tipo: 'progressivo',
    regras_progressivas: [{ qtd_minima: 3, desconto_pct: 15 }],
    produtos_ids: [productId], categorias_ids: [],
  }]);

  const summary = await cartService.buildCartSummary({ items: [{ productId, qty: 3 }] });
  const pricing = stripeService.buildCheckoutPricing(summary);

  assert.equal(summary.subtotal, 255);
  assert.equal(summary.promocoesDesconto, 45);
  assert.equal(pricing.totalDiscountCents, 4500);
  assert.equal(pricing.totalCents, 25500);
});

test('calcula cupons percentual e fixo sobre o subtotal após promoções', async (t) => {
  t.mock.method(couponModel, 'findByCodigo', async (code) => ({
    codigo: code,
    status: 'ativo',
    tipo_desconto: code === 'PERCENTUAL' ? 'percentual' : 'fixo',
    valor: code === 'PERCENTUAL' ? 10 : 250,
    produtos_ids: [], categorias_ids: [], clientes_ids: [],
    frete_gratis: 0,
  }));
  const context = {
    subtotal: 200,
    itens: [{ productId, categoria_id: 1, preco: 100, qty: 3, subtotalAposPromocao: 200 }],
    usuarioId: 1,
  };

  const percentage = await couponService.validateCoupon('PERCENTUAL', context);
  const fixed = await couponService.validateCoupon('FIXO', context);

  assert.equal(percentage.desconto, 20);
  assert.equal(fixed.desconto, 200);
});

test('calcula frete regional, padrão, grátis por faixa e grátis por cupom', async (t) => {
  t.mock.method(promocaoService, 'getPromocoesAtivas', async () => []);
  const regional = await cartService.buildCartSummary({ items: [{ productId, qty: 1 }], uf: 'RS' });
  const standard = await cartService.buildCartSummary({ items: [{ productId, qty: 1 }] });
  const threshold = await cartService.buildCartSummary({ items: [{ productId, qty: 2 }], uf: 'RS' });

  t.mock.method(couponService, 'validateCoupon', async () => ({ desconto: 0, freteGratis: true }));
  const coupon = await cartService.buildCartSummary({
    items: [{ productId, qty: 1 }], uf: 'RS', cupomCode: 'FRETEGRATIS',
  });

  assert.equal(regional.freight, 15);
  assert.equal(standard.freight, 25);
  assert.equal(threshold.freight, 0);
  assert.equal(coupon.freight, 0);
});

test('mantém promoção, cupom, frete e total iguais após arredondamento em centavos', () => {
  const summary = {
    items: [{ name: 'Produto decimal', price: 19.99, qty: 3 }],
    freight: 15,
    promocoesDesconto: 7.5,
    discount: 5.25,
    total: 62.22,
  };
  const pricing = stripeService.buildCheckoutPricing(summary);
  const roundedPromotion = promocaoService.calcularPrecoComPromocao(
    { id: productId, categoria_id: 1, preco: 2.03, preco_promocional: null },
    [{ tipo: 'percentual', valor: 50, produtos_ids: [], categorias_ids: [] }]
  );

  assert.equal(cartService.moneyToCents(1.005), 101);
  assert.equal(roundedPromotion.precoFinal, 1.02);
  assert.equal(pricing.lineItems[0].price_data.unit_amount, 1999);
  assert.equal(pricing.lineItems[1].price_data.unit_amount, 1500);
  assert.equal(pricing.totalDiscountCents, 1275);
  assert.equal(pricing.totalCents, 6222);
});

test('recusa criar preços Stripe quando o detalhamento diverge por um centavo', () => {
  assert.throws(
    () => stripeService.buildCheckoutPricing({
      items: [{ name: 'Produto', price: 10, qty: 1 }],
      freight: 0,
      promocoesDesconto: 0,
      discount: 0,
      total: 9.99,
    }),
    (error) => error.code === 'CHECKOUT_TOTAL_INCONSISTENT'
  );
});

test('recusa quantidade inválida', async () => {
  await assert.rejects(
    () => cartService.buildCartSummary({ items: [{ productId, qty: 0 }] }),
    (error) => error.code === 'CART_ITEM_INVALID'
  );
});

test('recusa carrinho acima do limite antes de consultar produtos', async () => {
  const items = Array.from(
    { length: cartService.MAX_CART_ITEMS + 1 },
    (_, index) => ({ productId: index + 1, qty: 1 })
  );
  await assert.rejects(
    () => cartService.buildCartSummary({ items }),
    (error) => error.code === 'CART_ITEMS_LIMIT_EXCEEDED'
  );
});

test('recusa produto inexistente', async () => {
  await assert.rejects(
    () => cartService.buildCartSummary({ items: [{ productId: 999999999, qty: 1 }] }),
    (error) => error.code === 'PRODUCT_NOT_FOUND'
  );
});

test('exige usuário autenticado para criar checkout', async () => {
  await assert.rejects(
    () => stripeService.createCheckoutSession({ items: [{ productId, qty: 1 }], userId: null }),
    (error) => error.code === 'AUTH_REQUIRED'
  );
});

test('bloqueia o endpoint antigo de pedidos fora do Checkout Stripe', async () => {
  await assert.rejects(
    () => orderService.createOrder({ metodo_pagamento: 'whatsapp' }),
    (error) => error.code === 'STRIPE_CHECKOUT_REQUIRED'
  );
});

test('recusa webhook com assinatura inválida', async () => {
  await assert.rejects(
    () => stripeService.handleWebhook(Buffer.from('{}'), 't=0,v1=invalid'),
    (error) => error.code === 'STRIPE_WEBHOOK_SIGNATURE_INVALID'
  );
});

test('processa o mesmo evento somente uma vez', async () => {
  const event = {
    id: 'evt_test_duplicate',
    type: 'payment_intent.payment_failed',
    data: { object: { id: 'pi_test_missing' } },
  };
  const first = await stripeService.processWebhookEvent(event);
  const second = await stripeService.processWebhookEvent(event);
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
});

test('cria o pedido e seus itens somente após evento pago', async () => {
  await paymentModel.createCheckoutDraft({
    id: 'checkout_test_paid',
    usuario_id: 1,
    itens: [{ productId, name: 'Produto Stripe de teste', price: 100, qty: 1, tamanho: 'M' }],
    subtotal: 100,
    frete: 0,
    desconto: 0,
    total: 100,
    currency: 'BRL',
    email_cliente: 'teste@example.com',
  });
  await paymentModel.attachStripeSession('checkout_test_paid', 'cs_test_paid');

  const result = await stripeService.processWebhookEvent({
    id: 'evt_test_paid',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_paid',
        payment_status: 'paid',
        amount_total: 10000,
        currency: 'brl',
        payment_intent: 'pi_test_paid',
        customer: 'cus_test_paid',
        metadata: { checkout_id: 'checkout_test_paid' },
        customer_details: { name: 'Cliente Teste', email: 'teste@example.com', phone: '54999999999' },
        shipping_details: { name: 'Cliente Teste', address: { line1: 'Rua Teste', city: 'Caxias do Sul', state: 'RS', postal_code: '95000000', country: 'BR' } },
        total_details: { amount_discount: 0 },
      },
    },
  });
  const order = await database.get('SELECT * FROM pedidos WHERE stripe_session_id = ?', ['cs_test_paid']);
  const items = await database.all('SELECT * FROM pedido_itens WHERE pedido_id = ?', [order.id]);
  assert.equal(result.duplicate, false);
  assert.equal(order.payment_status, 'paid');
  assert.equal(order.status, 'pago');
  assert.equal(items.length, 1);
  assert.equal(items[0].preco_unitario, 100);
});

test('faz rollback do evento quando o pedido não pode ser registrado', async () => {
  const event = {
    id: 'evt_test_rollback',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_missing',
        payment_status: 'paid',
        amount_total: 10000,
        metadata: { checkout_id: 'checkout_missing' },
      },
    },
  };
  await assert.rejects(() => stripeService.processWebhookEvent(event), (error) => error.code === 'CHECKOUT_DRAFT_NOT_FOUND');
  const savedEvent = await database.get('SELECT id FROM stripe_webhook_events WHERE id = ?', [event.id]);
  assert.equal(savedEvent, undefined);
});
