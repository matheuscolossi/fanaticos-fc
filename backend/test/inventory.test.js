require('./testEnv');

process.env.DATABASE_URL = '';
process.env.DB_REQUIRE_POSTGRES = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'inventory-test-jwt-secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_local_only';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_only';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const database = require('../src/config/database');
const cartService = require('../src/services/cartService');
const orderService = require('../src/services/orderService');
const paymentModel = require('../src/models/paymentModel');
const stripeService = require('../src/services/stripeService');

const draftIds = [
  'inventory_concurrent_a',
  'inventory_concurrent_b',
  'inventory_expired',
  'inventory_expired_cleanup',
  'inventory_async_failed',
  'inventory_paid',
  'inventory_cancelled',
];
const eventIds = [
  'evt_inventory_expired',
  'evt_inventory_async_failed',
  'evt_inventory_paid',
  'evt_inventory_partial_refund',
  'evt_inventory_full_refund',
  'evt_inventory_full_refund_again',
  'evt_inventory_cancelled_paid',
];
const sessionIds = ['cs_inventory_paid', 'cs_inventory_cancelled'];
let productId;

function draft(id, qty) {
  return {
    id,
    usuario_id: 1,
    itens: [{ productId, name: 'Produto de estoque', price: 50, qty }],
    subtotal: 50 * qty,
    frete: 0,
    desconto: 0,
    total: 50 * qty,
    currency: 'BRL',
    email_cliente: 'estoque@example.com',
  };
}

function paidEvent({ eventId, checkoutId, sessionId, paymentIntentId, qty }) {
  return {
    id: eventId,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        payment_status: 'paid',
        amount_total: 5000 * qty,
        currency: 'brl',
        payment_intent: paymentIntentId,
        customer: `cus_${checkoutId}`,
        metadata: { checkout_id: checkoutId },
        customer_details: { name: 'Cliente Estoque', email: 'estoque@example.com' },
        shipping_details: { name: 'Cliente Estoque', address: { country: 'BR' } },
      },
    },
  };
}

async function stock() {
  return database.get(
    'SELECT estoque, estoque_reservado FROM produtos WHERE id = ?',
    [productId]
  );
}

before(async () => {
  await database.init();
  const eventPlaceholders = eventIds.map(() => '?').join(',');
  const draftPlaceholders = draftIds.map(() => '?').join(',');
  const sessionPlaceholders = sessionIds.map(() => '?').join(',');
  await database.run(`DELETE FROM stripe_webhook_events WHERE id IN (${eventPlaceholders})`, eventIds);
  await database.run(
    `DELETE FROM pedido_eventos WHERE pedido_id IN (
       SELECT id FROM pedidos WHERE stripe_session_id IN (${sessionPlaceholders})
     )`,
    sessionIds
  );
  await database.run(`DELETE FROM pedidos WHERE stripe_session_id IN (${sessionPlaceholders})`, sessionIds);
  await database.run(`DELETE FROM checkout_drafts WHERE id IN (${draftPlaceholders})`, draftIds);
  await database.run('DELETE FROM produtos WHERE sku = ?', ['inventory-test-sku']);
  const category = await database.get('SELECT id FROM categorias ORDER BY id LIMIT 1');
  const result = await database.run(
    `INSERT INTO produtos (nome, sku, preco, categoria_id, imagens, estoque, estoque_reservado, status)
     VALUES (?, ?, ?, ?, JSON_VALUE(?), ?, 0, 'ativo')`,
    ['Produto de estoque', 'inventory-test-sku', 50, category.id, '[]', 10]
  );
  productId = result.lastID;
});

after(async () => {
  const eventPlaceholders = eventIds.map(() => '?').join(',');
  const draftPlaceholders = draftIds.map(() => '?').join(',');
  const sessionPlaceholders = sessionIds.map(() => '?').join(',');
  await database.run(`DELETE FROM stripe_webhook_events WHERE id IN (${eventPlaceholders})`, eventIds);
  await database.run(
    `DELETE FROM pedido_eventos WHERE pedido_id IN (
       SELECT id FROM pedidos WHERE stripe_session_id IN (${sessionPlaceholders})
     )`,
    sessionIds
  );
  await database.run(`DELETE FROM pedidos WHERE stripe_session_id IN (${sessionPlaceholders})`, sessionIds);
  await database.run(`DELETE FROM checkout_drafts WHERE id IN (${draftPlaceholders})`, draftIds);
  await database.run('DELETE FROM produtos WHERE id = ?', [productId]);
  await database.close();
});

test('carrinho rejeita quantidade maior que o estoque disponível', async () => {
  await assert.rejects(
    () => cartService.buildCartSummary({ items: [{ productId, qty: 11 }] }),
    (error) => error.code === 'INSUFFICIENT_STOCK' && error.statusCode === 409
  );
});

test('reservas concorrentes não ultrapassam o estoque e são atômicas', async () => {
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const results = await Promise.allSettled([
    paymentModel.createReservedCheckoutDraft(draft('inventory_concurrent_a', 6), expiresAt),
    paymentModel.createReservedCheckoutDraft(draft('inventory_concurrent_b', 6), expiresAt),
  ]);
  const fulfilled = results.filter((result) => result.status === 'fulfilled');
  const rejected = results.filter((result) => result.status === 'rejected');
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.code, 'INSUFFICIENT_STOCK');
  assert.deepEqual(await stock(), { estoque: 10, estoque_reservado: 6 });

  await assert.rejects(
    () => cartService.buildCartSummary({ items: [{ productId, qty: 5 }] }),
    (error) => error.code === 'INSUFFICIENT_STOCK'
  );

  for (const id of ['inventory_concurrent_a', 'inventory_concurrent_b']) {
    await paymentModel.releaseDraftStock(id, 'test_cleanup');
  }
  assert.deepEqual(await stock(), { estoque: 10, estoque_reservado: 0 });
});

test('sessão expirada libera a reserva uma única vez', async () => {
  await paymentModel.createReservedCheckoutDraft(
    draft('inventory_expired', 4),
    new Date(Date.now() + 30 * 60 * 1000).toISOString()
  );
  const event = {
    id: 'evt_inventory_expired',
    type: 'checkout.session.expired',
    data: { object: { id: 'cs_inventory_expired', metadata: { checkout_id: 'inventory_expired' } } },
  };
  const first = await stripeService.processWebhookEvent(event);
  const second = await stripeService.processWebhookEvent(event);
  const savedDraft = await paymentModel.findDraftById('inventory_expired');

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(savedDraft.stock_status, 'released');
  assert.equal(savedDraft.status, 'expired');
  assert.deepEqual(await stock(), { estoque: 10, estoque_reservado: 0 });
});

test('limpeza periódica libera reserva vencida mesmo sem webhook ou novo checkout', async () => {
  await paymentModel.createReservedCheckoutDraft(
    draft('inventory_expired_cleanup', 4),
    new Date(Date.now() - 60_000).toISOString()
  );

  const released = await paymentModel.releaseExpiredReservations();
  const savedDraft = await paymentModel.findDraftById('inventory_expired_cleanup');

  assert.ok(released >= 1);
  assert.equal(savedDraft.stock_status, 'released');
  assert.equal(savedDraft.status, 'expired');
  assert.deepEqual(await stock(), { estoque: 10, estoque_reservado: 0 });
});

test('falha de pagamento assíncrono libera a reserva', async () => {
  await paymentModel.createReservedCheckoutDraft(
    draft('inventory_async_failed', 3),
    new Date(Date.now() + 30 * 60 * 1000).toISOString()
  );
  await stripeService.processWebhookEvent({
    id: 'evt_inventory_async_failed',
    type: 'checkout.session.async_payment_failed',
    data: { object: { id: 'cs_inventory_async_failed', metadata: { checkout_id: 'inventory_async_failed' } } },
  });
  const savedDraft = await paymentModel.findDraftById('inventory_async_failed');
  assert.equal(savedDraft.stock_status, 'released');
  assert.equal(savedDraft.status, 'payment_failed');
  assert.deepEqual(await stock(), { estoque: 10, estoque_reservado: 0 });
});

test('pagamento converte reserva em baixa física sem dupla movimentação', async () => {
  await paymentModel.createReservedCheckoutDraft(
    draft('inventory_paid', 2),
    new Date(Date.now() + 30 * 60 * 1000).toISOString()
  );
  await paymentModel.attachStripeSession('inventory_paid', 'cs_inventory_paid');
  assert.deepEqual(await stock(), { estoque: 10, estoque_reservado: 2 });

  const event = paidEvent({
    eventId: 'evt_inventory_paid', checkoutId: 'inventory_paid',
    sessionId: 'cs_inventory_paid', paymentIntentId: 'pi_inventory_paid', qty: 2,
  });
  await stripeService.processWebhookEvent(event);
  const duplicate = await stripeService.processWebhookEvent(event);
  const savedDraft = await paymentModel.findDraftById('inventory_paid');
  const order = await database.get('SELECT * FROM pedidos WHERE stripe_session_id = ?', ['cs_inventory_paid']);

  assert.equal(duplicate.duplicate, true);
  assert.equal(savedDraft.stock_status, 'committed');
  assert.equal(order.stock_status, 'committed');
  assert.deepEqual(await stock(), { estoque: 8, estoque_reservado: 0 });
});

test('reembolso parcial não devolve itens e integral devolve somente uma vez', async () => {
  await stripeService.processWebhookEvent({
    id: 'evt_inventory_partial_refund',
    type: 'charge.refunded',
    data: { object: { payment_intent: 'pi_inventory_paid', refunded: false, amount: 10000, amount_refunded: 5000 } },
  });
  let order = await database.get('SELECT * FROM pedidos WHERE stripe_session_id = ?', ['cs_inventory_paid']);
  assert.equal(order.payment_status, 'partially_refunded');
  assert.equal(order.stock_status, 'committed');
  assert.deepEqual(await stock(), { estoque: 8, estoque_reservado: 0 });

  await stripeService.processWebhookEvent({
    id: 'evt_inventory_full_refund',
    type: 'charge.refunded',
    data: { object: { payment_intent: 'pi_inventory_paid', refunded: true, amount: 10000, amount_refunded: 10000 } },
  });
  await stripeService.processWebhookEvent({
    id: 'evt_inventory_full_refund_again',
    type: 'charge.refunded',
    data: { object: { payment_intent: 'pi_inventory_paid', refunded: true, amount: 10000, amount_refunded: 10000 } },
  });
  order = await database.get('SELECT * FROM pedidos WHERE stripe_session_id = ?', ['cs_inventory_paid']);
  assert.equal(order.payment_status, 'refunded');
  assert.equal(order.status, 'cancelado');
  assert.equal(order.stock_status, 'restored');
  assert.deepEqual(await stock(), { estoque: 10, estoque_reservado: 0 });
});

test('cancelamento administrativo devolve estoque de forma idempotente', async () => {
  await paymentModel.createReservedCheckoutDraft(
    draft('inventory_cancelled', 1),
    new Date(Date.now() + 30 * 60 * 1000).toISOString()
  );
  await paymentModel.attachStripeSession('inventory_cancelled', 'cs_inventory_cancelled');
  await stripeService.processWebhookEvent(paidEvent({
    eventId: 'evt_inventory_cancelled_paid', checkoutId: 'inventory_cancelled',
    sessionId: 'cs_inventory_cancelled', paymentIntentId: 'pi_inventory_cancelled', qty: 1,
  }));
  const order = await database.get('SELECT id FROM pedidos WHERE stripe_session_id = ?', ['cs_inventory_cancelled']);
  assert.deepEqual(await stock(), { estoque: 9, estoque_reservado: 0 });

  await orderService.updateOrder(
    order.id,
    { status: 'cancelado', motivo_cancelamento: 'Cancelamento administrativo de teste' },
    { id: 1, nome: 'Administrador de teste' }
  );
  await orderService.updateOrder(order.id, { status: 'cancelado' }, { id: 1, nome: 'Administrador de teste' });
  assert.deepEqual(await stock(), { estoque: 10, estoque_reservado: 0 });
});
