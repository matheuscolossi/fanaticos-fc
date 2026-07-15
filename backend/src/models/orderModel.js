const database = require('../config/database');
const { all, get, run } = database;
const inventoryModel = require('./inventoryModel');
const { createHttpError } = require('../utils/http');

function create(order) {
  return run(
    `INSERT INTO pedidos (usuario_id, itens, total, nome_cliente, email_cliente, telefone_cliente, endereco, metodo_pagamento, status, cupom_codigo, cupom_desconto)
     VALUES (?, JSON_VALUE(?), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      order.usuario_id,
      order.itens,
      order.total,
      order.nome_cliente,
      order.email_cliente,
      order.telefone_cliente,
      order.endereco,
      order.metodo_pagamento,
      order.status,
      order.cupom_codigo || null,
      order.cupom_desconto ?? null,
    ]
  );
}

async function createPaidFromStripe(order, db = database) {
  const result = await db.run(
    `INSERT INTO pedidos (
       usuario_id, itens, total, nome_cliente, email_cliente, telefone_cliente, endereco,
       metodo_pagamento, status, cupom_codigo, cupom_desconto,
       stripe_session_id, stripe_payment_intent_id, stripe_customer_id, stripe_event_id,
       payment_status, currency, shipping_address, stock_status, updated_at
     ) VALUES (?, JSON_VALUE(?), ?, ?, ?, ?, ?, 'stripe', 'pago', ?, ?, ?, ?, ?, ?, 'paid', ?, JSON_VALUE(?), 'committed', CURRENT_TIMESTAMP)`,
    [
      order.usuario_id || null,
      JSON.stringify(order.itens || []),
      order.total,
      order.nome_cliente || null,
      order.email_cliente || null,
      order.telefone_cliente || null,
      order.endereco || null,
      order.cupom_codigo || null,
      order.cupom_desconto ?? null,
      order.stripe_session_id,
      order.stripe_payment_intent_id || null,
      order.stripe_customer_id || null,
      order.stripe_event_id,
      order.currency || 'BRL',
      JSON.stringify(order.shipping_address || {}),
    ]
  );

  const orderId = result.lastID;
  for (const item of order.itens || []) {
    const price = Number(item.price ?? item.preco ?? 0);
    const quantity = Number(item.qty || 0);
    await db.run(
      `INSERT INTO pedido_itens (
         pedido_id, produto_id, nome, preco_unitario, quantidade, tamanho, variacao, subtotal
       ) VALUES (?, ?, ?, ?, ?, ?, JSON_VALUE(?), ?)`,
      [
        orderId,
        Number(item.productId ?? item.id) || null,
        item.name || item.nome || 'Produto',
        price,
        quantity,
        item.tamanho || null,
        JSON.stringify(item.personalizacao || item.variacao || {}),
        Math.round(price * quantity * 100) / 100,
      ]
    );
  }

  return { ...result, id: orderId };
}

function findByStripeSession(sessionId, db = database) {
  return db.get(
    'SELECT id, status, payment_status, total, currency, stripe_session_id FROM pedidos WHERE stripe_session_id = ?',
    [sessionId]
  );
}

function findByStripePaymentIntent(paymentIntentId, db = database) {
  return db.get(
    'SELECT id, status, payment_status, stripe_session_id FROM pedidos WHERE stripe_payment_intent_id = ?',
    [paymentIntentId]
  );
}

function findPaymentStatusForUser(sessionId, userId, db = database) {
  return db.get(
    `SELECT id, status, payment_status, total, currency, stripe_session_id, created_at, updated_at
     FROM pedidos WHERE stripe_session_id = ? AND usuario_id = ?`,
    [sessionId, userId]
  );
}

function updatePaymentStatusByPaymentIntent(paymentIntentId, paymentStatus, orderStatus, db = database) {
  return db.run(
    `UPDATE pedidos
     SET payment_status = ?, status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP
     WHERE stripe_payment_intent_id = ? AND payment_status <> 'refunded'`,
    [paymentStatus, orderStatus || null, paymentIntentId]
  );
}

async function restoreStockForOrder(orderId, paymentStatus, orderStatus, db) {
  const order = await db.get(
    'SELECT id, itens, stock_status FROM pedidos WHERE id = ?',
    [orderId]
  );
  if (!order) return null;

  if (order.stock_status === 'committed') {
    const claim = await db.run(
      `UPDATE pedidos SET stock_status = 'restoring'
       WHERE id = ? AND stock_status = 'committed'`,
      [orderId]
    );
    if (Number(claim.changes) !== 1) {
      throw createHttpError(409, 'Movimentação de estoque concorrente.', 'STOCK_TRANSITION_IN_PROGRESS');
    }
    await inventoryModel.restore(order.itens, db);
    await db.run(
      `UPDATE pedidos
       SET stock_status = 'restored', payment_status = COALESCE(?, payment_status),
           status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND stock_status = 'restoring'`,
      [paymentStatus || null, orderStatus || null, orderId]
    );
    return { ...order, stock_status: 'restored' };
  }

  await db.run(
    `UPDATE pedidos
     SET payment_status = CASE
           WHEN payment_status = 'refunded' THEN payment_status
           ELSE COALESCE(?, payment_status)
         END,
         status = COALESCE(?, status),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [paymentStatus || null, orderStatus || null, orderId]
  );
  return order;
}

async function restoreStockByPaymentIntent(paymentIntentId, paymentStatus, orderStatus, db) {
  const order = await findByStripePaymentIntent(paymentIntentId, db);
  if (!order) return null;
  return restoreStockForOrder(order.id, paymentStatus, orderStatus, db);
}

function list() {
  return all('SELECT * FROM pedidos ORDER BY created_at DESC');
}

function listByUser(user) {
  return all('SELECT * FROM pedidos WHERE email_cliente = ? OR usuario_id = ? ORDER BY created_at DESC', [
    user.email,
    user.id,
  ]);
}

function findTrackingForUser(orderId, user) {
  return get(
    `SELECT id, status, codigo_rastreio, created_at
     FROM pedidos
     WHERE id = ?
       AND (
         usuario_id = ?
         OR (usuario_id IS NULL AND LOWER(email_cliente) = LOWER(?))
       )`,
    [orderId, user.id, user.email]
  );
}

function exists(orderId, db = database) {
  return db.get('SELECT id FROM pedidos WHERE id = ?', [orderId]);
}

function updateTracking(orderId, { status, codigo_rastreio }, db = database) {
  return db.run(
    'UPDATE pedidos SET status = COALESCE(?, status), codigo_rastreio = COALESCE(?, codigo_rastreio) WHERE id = ?',
    [status || null, codigo_rastreio !== undefined ? codigo_rastreio : null, orderId]
  );
}

function remove(orderId, db = database) {
  return db.run('DELETE FROM pedidos WHERE id = ?', [orderId]);
}

module.exports = {
  create,
  createPaidFromStripe,
  exists,
  findByStripePaymentIntent,
  findByStripeSession,
  findPaymentStatusForUser,
  findTrackingForUser,
  list,
  listByUser,
  remove,
  restoreStockByPaymentIntent,
  restoreStockForOrder,
  updatePaymentStatusByPaymentIntent,
  updateTracking,
};
