require('./testEnv');

process.env.DATABASE_URL = '';
process.env.DB_REQUIRE_POSTGRES = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'variant-test-jwt-secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_local_only';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_only';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const database = require('../src/config/database');
const productModel = require('../src/models/productModel');
const paymentModel = require('../src/models/paymentModel');
const cartService = require('../src/services/cartService');
const productService = require('../src/services/productService');
const stripeService = require('../src/services/stripeService');

const draftIds = ['variant_concurrent_a', 'variant_concurrent_b', 'variant_paid'];
const eventIds = ['evt_variant_paid', 'evt_variant_refunded'];
let productId;

function draft(id, tamanho, qty) {
  return {
    id,
    usuario_id: 1,
    itens: [{ productId, name: 'Produto com variações', price: 50, qty, tamanho }],
    subtotal: 50 * qty,
    frete: 0,
    desconto: 0,
    total: 50 * qty,
    currency: 'BRL',
    email_cliente: 'variantes@example.com',
  };
}

async function stocks() {
  const product = await database.get(
    'SELECT estoque, estoque_reservado FROM produtos WHERE id = ?',
    [productId]
  );
  const variants = await database.all(
    `SELECT tamanho, estoque, estoque_reservado FROM produto_variantes
     WHERE produto_id = ? ORDER BY tamanho`,
    [productId]
  );
  return { product, variants };
}

before(async () => {
  await database.init();
  await database.run(
    `DELETE FROM stripe_webhook_events WHERE id IN (${eventIds.map(() => '?').join(',')})`,
    eventIds
  );
  await database.run(
    `DELETE FROM checkout_drafts WHERE id IN (${draftIds.map(() => '?').join(',')})`,
    draftIds
  );
  await database.run(
    'DELETE FROM pedido_eventos WHERE pedido_id IN (SELECT id FROM pedidos WHERE stripe_session_id = ?)',
    ['cs_variant_paid']
  );
  await database.run('DELETE FROM pedidos WHERE stripe_session_id = ?', ['cs_variant_paid']);
  await database.run('DELETE FROM produtos WHERE sku = ?', ['variant-test-sku']);
  const category = await database.get('SELECT id FROM categorias ORDER BY id LIMIT 1');
  const result = await database.run(
    `INSERT INTO produtos (nome, sku, preco, categoria_id, imagens, tamanhos, estoque, estoque_reservado, status)
     VALUES (?, ?, ?, ?, JSON_VALUE(?), JSON_VALUE(?), 5, 0, 'ativo')`,
    ['Produto com variações', 'variant-test-sku', 50, category.id, '[]', JSON.stringify(['P', 'M'])]
  );
  productId = result.lastID;
  await productModel.syncVariants(productId, [
    { tamanho: 'P', estoque: 2 },
    { tamanho: 'M', estoque: 3 },
  ]);
});

after(async () => {
  await database.run(
    `DELETE FROM stripe_webhook_events WHERE id IN (${eventIds.map(() => '?').join(',')})`,
    eventIds
  );
  await database.run(
    'DELETE FROM pedido_eventos WHERE pedido_id IN (SELECT id FROM pedidos WHERE stripe_session_id = ?)',
    ['cs_variant_paid']
  );
  await database.run('DELETE FROM pedidos WHERE stripe_session_id = ?', ['cs_variant_paid']);
  await database.run(
    `DELETE FROM checkout_drafts WHERE id IN (${draftIds.map(() => '?').join(',')})`,
    draftIds
  );
  await database.run('DELETE FROM produtos WHERE id = ?', [productId]);
  await database.close();
});

test('API expõe somente tamanhos cadastrados com estoque disponível por variação', async () => {
  const product = await productService.getProduct(productId);
  assert.deepEqual(product.tamanhos, ['P', 'M']);
  assert.deepEqual(product.variantes, [
    { tamanho: 'P', estoque: 2 },
    { tamanho: 'M', estoque: 3 },
  ]);
});

test('cadastro exige estoque para todos os tamanhos e sincroniza o total', async () => {
  const basePayload = {
    nome: 'Produto com variações', preco: 50, estoque: 5,
    imagens: [], tamanhos: ['P', 'M'], cores: [], status: 'ativo',
  };
  await assert.rejects(
    () => productService.updateProduct(productId, {
      ...basePayload,
      variantes: [{ tamanho: 'P', estoque: 2 }],
    }),
    (error) => error.code === 'VARIANT_STOCK_INVALID'
  );
  await productService.updateProduct(productId, {
    ...basePayload,
    variantes: [{ tamanho: 'P', estoque: 2 }, { tamanho: 'M', estoque: 3 }],
  });
  const current = await stocks();
  assert.deepEqual(current.product, { estoque: 5, estoque_reservado: 0 });
});

test('carrinho exige tamanho válido e respeita o estoque da variação', async () => {
  await assert.rejects(
    () => cartService.buildCartSummary({ items: [{ productId, qty: 1 }] }),
    (error) => error.code === 'PRODUCT_VARIANT_REQUIRED'
  );
  await assert.rejects(
    () => cartService.buildCartSummary({ items: [{ productId, qty: 1, tamanho: 'GG' }] }),
    (error) => error.code === 'PRODUCT_VARIANT_INVALID'
  );
  await assert.rejects(
    () => cartService.buildCartSummary({ items: [{ productId, qty: 3, tamanho: 'P' }] }),
    (error) => error.code === 'INSUFFICIENT_VARIANT_STOCK'
  );
  const summary = await cartService.buildCartSummary({
    items: [{ productId, qty: 3, tamanho: 'M' }],
  });
  assert.equal(summary.items[0].tamanho, 'M');
});

test('reservas concorrentes disputam apenas o estoque do tamanho escolhido', async () => {
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const results = await Promise.allSettled([
    paymentModel.createReservedCheckoutDraft(draft('variant_concurrent_a', 'P', 2), expiresAt),
    paymentModel.createReservedCheckoutDraft(draft('variant_concurrent_b', 'P', 2), expiresAt),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(results.find((result) => result.status === 'rejected').reason.code, 'INSUFFICIENT_VARIANT_STOCK');

  let current = await stocks();
  assert.deepEqual(current.product, { estoque: 5, estoque_reservado: 2 });
  assert.deepEqual(current.variants, [
    { tamanho: 'M', estoque: 3, estoque_reservado: 0 },
    { tamanho: 'P', estoque: 2, estoque_reservado: 2 },
  ]);
  for (const id of ['variant_concurrent_a', 'variant_concurrent_b']) {
    await paymentModel.releaseDraftStock(id, 'test_cleanup');
  }
  current = await stocks();
  assert.deepEqual(current.product, { estoque: 5, estoque_reservado: 0 });
});

test('pagamento e reembolso movimentam somente a variante comprada', async () => {
  await paymentModel.createReservedCheckoutDraft(
    draft('variant_paid', 'M', 2),
    new Date(Date.now() + 30 * 60 * 1000).toISOString()
  );
  await paymentModel.attachStripeSession('variant_paid', 'cs_variant_paid');
  await stripeService.processWebhookEvent({
    id: 'evt_variant_paid',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_variant_paid', payment_status: 'paid', amount_total: 10000,
        currency: 'brl', payment_intent: 'pi_variant_paid', customer: 'cus_variant_paid',
        metadata: { checkout_id: 'variant_paid' },
        customer_details: { name: 'Cliente Variante', email: 'variantes@example.com' },
        shipping_details: { name: 'Cliente Variante', address: { country: 'BR' } },
      },
    },
  });
  let current = await stocks();
  assert.deepEqual(current.product, { estoque: 3, estoque_reservado: 0 });
  assert.deepEqual(current.variants, [
    { tamanho: 'M', estoque: 1, estoque_reservado: 0 },
    { tamanho: 'P', estoque: 2, estoque_reservado: 0 },
  ]);

  await stripeService.processWebhookEvent({
    id: 'evt_variant_refunded',
    type: 'charge.refunded',
    data: { object: { payment_intent: 'pi_variant_paid', refunded: true, amount: 10000, amount_refunded: 10000 } },
  });
  current = await stocks();
  assert.deepEqual(current.product, { estoque: 5, estoque_reservado: 0 });
  assert.deepEqual(current.variants, [
    { tamanho: 'M', estoque: 3, estoque_reservado: 0 },
    { tamanho: 'P', estoque: 2, estoque_reservado: 0 },
  ]);
});
