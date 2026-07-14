const orderModel = require('../models/orderModel');
const { createHttpError } = require('../utils/http');

function parseOrderItems(order) {
  const itens = Array.isArray(order.itens) ? order.itens : JSON.parse(order.itens || '[]');
  return {
    ...order,
    itens: itens.map((item) => ({
      ...item,
      id: item.id ?? item.productId,
      nome: item.nome ?? item.name,
      preco: Number(item.preco ?? item.price ?? 0),
    })),
  };
}

async function createOrder() {
  throw createHttpError(
    410,
    'Pedidos devem ser finalizados exclusivamente pelo Checkout Stripe.',
    'STRIPE_CHECKOUT_REQUIRED'
  );
}

async function createPaidOrderFromStripe(data, db) {
  const { draft, session, eventId, shippingAddress } = data;
  const itens = Array.isArray(draft?.itens)
    ? draft.itens
    : JSON.parse(draft?.itens || '[]');
  const total = session?.amount_total != null
    ? Number(session.amount_total) / 100
    : Number(draft?.total || 0);

  if (!Array.isArray(itens) || itens.length === 0 || !Number(total)) {
    throw createHttpError(400, 'Dados do pedido Stripe inválidos.', 'VALIDATION_ERROR');
  }

  const payload = {
    usuario_id: draft.usuario_id,
    itens,
    total,
    nome_cliente: session.customer_details?.name || draft.nome_cliente,
    email_cliente: session.customer_details?.email || draft.email_cliente,
    telefone_cliente: session.customer_details?.phone || draft.telefone_cliente,
    endereco: shippingAddress?.formatted || draft.endereco,
    cupom_codigo: draft.cupom_codigo,
    cupom_desconto: Number(session.total_details?.amount_discount || 0) / 100,
    stripe_session_id: session.id,
    metodo_pagamento: 'stripe',
    status: 'pago',
    stripe_payment_intent_id: session.payment_intent,
    stripe_customer_id: session.customer,
    stripe_event_id: eventId,
    currency: String(session.currency || draft.currency || 'brl').toUpperCase(),
    shipping_address: shippingAddress?.raw || {},
  };

  if (db) return orderModel.createPaidFromStripe(payload, db);

  const result = await orderModel.create(payload);
  return { message: 'Order created.', id: result.lastID, total };
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

async function deleteOrder(orderId) {
  const existingOrder = await orderModel.exists(orderId);
  if (!existingOrder) throw createHttpError(404, 'Order not found.', 'ORDER_NOT_FOUND');

  await orderModel.remove(orderId);
  return { message: 'Order deleted.' };
}

module.exports = {
  createOrder,
  createPaidOrderFromStripe,
  deleteOrder,
  getTrackingById,
  listOrders,
  listOrdersByUser,
  updateOrder,
};
