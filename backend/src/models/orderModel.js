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
       payment_status, currency, shipping_address, stock_status, updated_at,
       prazo_entrega_min, prazo_entrega_max, previsao_entrega, transportadora
     ) VALUES (?, JSON_VALUE(?), ?, ?, ?, ?, ?, 'stripe', 'pago', ?, ?, ?, ?, ?, ?, 'paid', ?, JSON_VALUE(?), 'committed', CURRENT_TIMESTAMP, ?, ?, ?, ?)`,
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
      order.prazo_entrega_min ?? null,
      order.prazo_entrega_max ?? null,
      order.previsao_entrega || null,
      order.transportadora || null,
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
        JSON.stringify({ ...(item.personalizacao || item.variacao || {}), ...(item.cor ? { cor: item.cor } : {}) }),
        Math.round(price * quantity * 100) / 100,
      ]
    );
  }

  await recordEvent(orderId, {
    tipo: 'pedido_pago_criado',
    status_novo: 'pago',
    ator_nome: 'Stripe',
    motivo: 'Pagamento confirmado pelo webhook',
    detalhes: {
      stripe_event_id: order.stripe_event_id,
      payment_status: 'paid',
    },
    chave_idempotencia: `stripe-pedido:${order.stripe_event_id}`,
  }, db);

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

function findNotificationByPaymentIntent(paymentIntentId, db = database) {
  return db.get(
    `SELECT id, nome_cliente, email_cliente, status, payment_status,
            transportadora, rastreio_url FROM pedidos WHERE stripe_payment_intent_id = ?`,
    [paymentIntentId]
  );
}

function findNotificationById(orderId, db = database) {
  return db.get(
    `SELECT id, nome_cliente, email_cliente, status, payment_status,
            transportadora, rastreio_url FROM pedidos WHERE id = ?`,
    [orderId]
  );
}

function findPaymentStatusForUser(sessionId, userId, db = database) {
  return db.get(
    `SELECT id, status, payment_status, total, currency, stripe_session_id, created_at, updated_at
     FROM pedidos WHERE stripe_session_id = ? AND usuario_id = ?`,
    [sessionId, userId]
  );
}

async function updatePaymentStatusByPaymentIntent(
  paymentIntentId,
  paymentStatus,
  orderStatus,
  db = database,
  audit = {}
) {
  const order = await findByStripePaymentIntent(paymentIntentId, db);
  if (!order) return null;
  const result = await db.run(
    `UPDATE pedidos
     SET payment_status = ?, status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP
     WHERE stripe_payment_intent_id = ? AND payment_status <> 'refunded'`,
    [paymentStatus, orderStatus || null, paymentIntentId]
  );
  if (Number(result.changes) === 1) {
    await recordEvent(order.id, {
      tipo: audit.tipo || 'pagamento_atualizado',
      status_anterior: order.status,
      status_novo: orderStatus || order.status,
      ator_nome: 'Stripe',
      motivo: audit.motivo || null,
      detalhes: { payment_status: paymentStatus },
      chave_idempotencia: audit.eventId ? `stripe-evento:${audit.eventId}` : null,
    }, db);
  }
  return result;
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

async function restoreStockByPaymentIntent(paymentIntentId, paymentStatus, orderStatus, db, audit = {}) {
  const order = await findByStripePaymentIntent(paymentIntentId, db);
  if (!order) return null;
  const restored = await restoreStockForOrder(order.id, paymentStatus, orderStatus, db);
  await recordEvent(order.id, {
    tipo: audit.tipo || 'pagamento_cancelado',
    status_anterior: order.status,
    status_novo: orderStatus || order.status,
    ator_nome: 'Stripe',
    motivo: audit.motivo || null,
    detalhes: { payment_status: paymentStatus },
    chave_idempotencia: audit.eventId ? `stripe-evento:${audit.eventId}` : null,
  }, db);
  return restored;
}

function list(archiveMode = 'active') {
  const where = archiveMode === 'archived'
    ? 'WHERE arquivado_em IS NOT NULL'
    : archiveMode === 'all' ? '' : 'WHERE arquivado_em IS NULL';
  return all(`SELECT * FROM pedidos ${where} ORDER BY created_at DESC`);
}

function listByUser(user) {
  return all('SELECT * FROM pedidos WHERE email_cliente = ? OR usuario_id = ? ORDER BY created_at DESC', [
    user.email,
    user.id,
  ]);
}

function findTrackingForUser(orderId, user) {
  return get(
    `SELECT id, status, codigo_rastreio, transportadora, rastreio_url,
            prazo_entrega_min, prazo_entrega_max, previsao_entrega, created_at
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
  return db.get(
    `SELECT id, status, payment_status, stock_status, arquivado_em,
            codigo_rastreio, transportadora, rastreio_url, prazo_entrega_min,
            prazo_entrega_max, previsao_entrega, motivo_cancelamento
     FROM pedidos WHERE id = ?`,
    [orderId]
  );
}

function updateTracking(orderId, {
  status,
  codigo_rastreio,
  transportadora,
  rastreio_url,
  prazo_entrega_min,
  prazo_entrega_max,
  motivo_cancelamento,
  cancelado_por,
}, db = database) {
  const changesTracking = codigo_rastreio !== undefined;
  const changesCarrier = transportadora !== undefined;
  const changesTrackingUrl = rastreio_url !== undefined;
  const changesDeliveryMin = prazo_entrega_min !== undefined;
  const changesDeliveryMax = prazo_entrega_max !== undefined;
  return db.run(
    `UPDATE pedidos SET
       status = COALESCE(?, status),
       codigo_rastreio = CASE WHEN ? THEN ? ELSE codigo_rastreio END,
       transportadora = CASE WHEN ? THEN ? ELSE transportadora END,
       rastreio_url = CASE WHEN ? THEN ? ELSE rastreio_url END,
       prazo_entrega_min = CASE WHEN ? THEN ? ELSE prazo_entrega_min END,
       prazo_entrega_max = CASE WHEN ? THEN ? ELSE prazo_entrega_max END,
       cancelado_em = CASE WHEN ? = 'cancelado' THEN COALESCE(cancelado_em, CURRENT_TIMESTAMP) ELSE cancelado_em END,
       cancelado_por = CASE WHEN ? = 'cancelado' THEN COALESCE(cancelado_por, ?) ELSE cancelado_por END,
       motivo_cancelamento = CASE WHEN ? = 'cancelado' THEN COALESCE(motivo_cancelamento, ?) ELSE motivo_cancelamento END,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      status || null,
      changesTracking ? 1 : 0,
      codigo_rastreio ?? null,
      changesCarrier ? 1 : 0,
      transportadora ?? null,
      changesTrackingUrl ? 1 : 0,
      rastreio_url ?? null,
      changesDeliveryMin ? 1 : 0,
      prazo_entrega_min ?? null,
      changesDeliveryMax ? 1 : 0,
      prazo_entrega_max ?? null,
      status || null,
      status || null,
      cancelado_por || null,
      status || null,
      motivo_cancelamento || null,
      orderId,
    ]
  );
}

function setArchived(orderId, { actorId, reason }, db = database) {
  return db.run(
    `UPDATE pedidos SET arquivado_em = CURRENT_TIMESTAMP, arquivado_por = ?,
       motivo_arquivamento = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND arquivado_em IS NULL`,
    [actorId || null, reason || null, orderId]
  );
}

function clearArchived(orderId, db = database) {
  return db.run(
    `UPDATE pedidos SET arquivado_em = NULL, arquivado_por = NULL,
       motivo_arquivamento = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND arquivado_em IS NOT NULL`,
    [orderId]
  );
}

function recordEvent(orderId, event, db = database) {
  return db.run(
    `INSERT INTO pedido_eventos (
       pedido_id, tipo, status_anterior, status_novo, ator_id, ator_nome,
       motivo, detalhes, chave_idempotencia
     ) VALUES (?, ?, ?, ?, ?, ?, ?, JSON_VALUE(?), ?)
     ON CONFLICT(chave_idempotencia) DO NOTHING`,
    [
      orderId,
      event.tipo,
      event.status_anterior || null,
      event.status_novo || null,
      event.ator_id || null,
      event.ator_nome || null,
      event.motivo || null,
      JSON.stringify(event.detalhes || {}),
      event.chave_idempotencia || null,
    ]
  );
}

function listEvents(orderIds, db = database) {
  const ids = [...new Set((orderIds || []).map(Number).filter(Number.isSafeInteger))];
  if (ids.length === 0) return Promise.resolve([]);
  return db.all(
    `SELECT id, pedido_id, tipo, status_anterior, status_novo,
            ator_id, ator_nome, motivo, detalhes, created_at
     FROM pedido_eventos
     WHERE pedido_id IN (${ids.map(() => '?').join(',')})
     ORDER BY created_at ASC, id ASC`,
    ids
  );
}

module.exports = {
  create,
  createPaidFromStripe,
  clearArchived,
  exists,
  findByStripePaymentIntent,
  findNotificationById,
  findNotificationByPaymentIntent,
  findByStripeSession,
  findPaymentStatusForUser,
  findTrackingForUser,
  list,
  listByUser,
  listEvents,
  recordEvent,
  restoreStockByPaymentIntent,
  restoreStockForOrder,
  setArchived,
  updatePaymentStatusByPaymentIntent,
  updateTracking,
};
