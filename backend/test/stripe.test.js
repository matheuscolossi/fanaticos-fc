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
const paymentModel = require('../src/models/paymentModel');
const stripeService = require('../src/services/stripeService');

let productId;
const eventIds = ['evt_test_duplicate', 'evt_test_rollback', 'evt_test_paid'];

before(async () => {
  await database.init();
  await database.run('DELETE FROM stripe_webhook_events WHERE id IN (?, ?, ?)', eventIds);
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
    personalizacao: { nome: 'A'.repeat(30), numero: '10' },
  });
});

test('recalcula o preço pelo banco e ignora preço adulterado no navegador', async () => {
  const summary = await cartService.buildCartSummary({
    items: [{ productId, qty: 2, price: 0 }],
  });
  assert.equal(summary.subtotal, 200);
});

test('recusa quantidade inválida', async () => {
  await assert.rejects(
    () => cartService.buildCartSummary({ items: [{ productId, qty: 0 }] }),
    (error) => error.code === 'CART_ITEM_INVALID'
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
