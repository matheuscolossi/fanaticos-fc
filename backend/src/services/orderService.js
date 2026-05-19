const orderModel = require('../models/orderModel');
const { createHttpError } = require('../utils/http');

function parseOrderItems(order) {
  if (Array.isArray(order.itens)) return order;
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

  const result = await orderModel.create({
    usuario_id: usuario_id || null,
    itens: JSON.stringify(itens),
    total,
    nome_cliente: nome_cliente || null,
    email_cliente: email_cliente || null,
    telefone_cliente: telefone_cliente || null,
    endereco: endereco || null,
    metodo_pagamento: metodo_pagamento || 'whatsapp',
    status: getInitialOrderStatus(metodo_pagamento),
  });

  return { message: 'Order created.', id: result.lastID };
}

async function listOrders() {
  const orders = await orderModel.list();
  return orders.map(parseOrderItems);
}

async function listOrdersByUser(user) {
  const orders = await orderModel.listByUser(user);
  return orders.map(parseOrderItems);
}

async function getTrackingById(orderId) {
  const order = await orderModel.findTrackingById(orderId);
  if (!order) throw createHttpError(404, 'Order not found.', 'ORDER_NOT_FOUND');
  return order;
}

async function updateOrder(orderId, data) {
  const existingOrder = await orderModel.exists(orderId);
  if (!existingOrder) throw createHttpError(404, 'Order not found.', 'ORDER_NOT_FOUND');

  await orderModel.updateTracking(orderId, data);
  return { message: 'Order updated.' };
}

module.exports = {
  createOrder,
  getTrackingById,
  listOrders,
  listOrdersByUser,
  updateOrder,
};
