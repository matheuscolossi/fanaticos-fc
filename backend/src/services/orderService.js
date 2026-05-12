const { run, get, all } = require('../config/database');
const { createHttpError } = require('../utils/http');

function parseOrderItems(order) {
  return { ...order, itens: JSON.parse(order.itens || '[]') };
}

function getInitialOrderStatus(paymentMethod) {
  return paymentMethod === 'pix' ? 'aguardando_pagamento' : 'pendente';
}

async function createOrder(data) {
  const { itens, total, usuario_id, nome_cliente, email_cliente, telefone_cliente, endereco, metodo_pagamento } = data;
  if (!Array.isArray(itens) || itens.length === 0 || !Number(total)) {
    throw createHttpError(400, 'Order items and total are required.', 'VALIDATION_ERROR');
  }

  const result = await run(
    `INSERT INTO pedidos (usuario_id, itens, total, nome_cliente, email_cliente, telefone_cliente, endereco, metodo_pagamento, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      usuario_id || null,
      JSON.stringify(itens),
      total,
      nome_cliente || null,
      email_cliente || null,
      telefone_cliente || null,
      endereco || null,
      metodo_pagamento || 'whatsapp',
      getInitialOrderStatus(metodo_pagamento),
    ]
  );

  return { message: 'Order created.', id: result.lastID };
}

async function listOrders() {
  const orders = await all('SELECT * FROM pedidos ORDER BY created_at DESC');
  return orders.map(parseOrderItems);
}

async function listOrdersByUser(user) {
  const orders = await all(
    'SELECT * FROM pedidos WHERE email_cliente = ? OR usuario_id = ? ORDER BY created_at DESC',
    [user.email, user.id]
  );
  return orders.map(parseOrderItems);
}

async function getTrackingById(orderId) {
  const order = await get(
    'SELECT id, status, codigo_rastreio, metodo_pagamento, total, nome_cliente, created_at FROM pedidos WHERE id = ?',
    [orderId]
  );
  if (!order) throw createHttpError(404, 'Order not found.', 'ORDER_NOT_FOUND');
  return order;
}

async function updateOrder(orderId, { status, codigo_rastreio }) {
  const existingOrder = await get('SELECT id FROM pedidos WHERE id = ?', [orderId]);
  if (!existingOrder) throw createHttpError(404, 'Order not found.', 'ORDER_NOT_FOUND');

  await run(
    'UPDATE pedidos SET status = COALESCE(?, status), codigo_rastreio = COALESCE(?, codigo_rastreio) WHERE id = ?',
    [status || null, codigo_rastreio !== undefined ? codigo_rastreio : null, orderId]
  );

  return { message: 'Order updated.' };
}

module.exports = {
  createOrder,
  getTrackingById,
  listOrders,
  listOrdersByUser,
  updateOrder,
};
