const orderModel = require('../models/orderModel');
const productModel = require('../models/productModel');
const userModel = require('../models/userModel');
const couponService = require('../services/couponService');
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

function getInitialOrderStatus(paymentMethod) {
  return paymentMethod === 'pix' ? 'aguardando_pagamento' : 'pendente';
}

async function aplicarCupom(cupomCodigo, itens, usuarioId) {
  const subtotal = itens.reduce((s, i) => s + Number(i.preco) * Number(i.qty), 0);
  const itensComCategoria = await Promise.all(itens.map(async (i) => {
    const produto = await productModel.findById(i.id);
    return { productId: i.id, categoria_id: produto?.categoria_id, preco: Number(i.preco), qty: Number(i.qty) };
  }));

  const { desconto } = await couponService.validateCoupon(cupomCodigo, {
    subtotal, itens: itensComCategoria, usuarioId,
  });

  return { subtotal, desconto };
}

async function createOrder(data) {
  const { itens, total, usuario_id, nome_cliente, email_cliente, telefone_cliente, endereco, metodo_pagamento, cupom_codigo } = data;
  if (!Array.isArray(itens) || itens.length === 0 || !Number(total)) {
    throw createHttpError(400, 'Order items and total are required.', 'VALIDATION_ERROR');
  }

  const usuario = await userModel.findPublicById(usuario_id);
  if (usuario && usuario.perfil !== 'admin' && !usuario.email_verificado) {
    throw createHttpError(403, 'Confirme seu e-mail antes de finalizar uma compra.', 'EMAIL_NOT_VERIFIED');
  }

  let totalFinal = Number(total);
  let cupomDesconto = null;

  if (cupom_codigo) {
    const { subtotal, desconto } = await aplicarCupom(cupom_codigo, itens, usuario_id);
    totalFinal = Math.max(0, Math.round((subtotal - desconto) * 100) / 100);
    cupomDesconto = desconto;
  }

  const result = await orderModel.create({
    usuario_id: usuario_id || null,
    itens: JSON.stringify(itens),
    total: totalFinal,
    nome_cliente: nome_cliente || null,
    email_cliente: email_cliente || null,
    telefone_cliente: telefone_cliente || null,
    endereco: endereco || null,
    metodo_pagamento: metodo_pagamento || 'whatsapp',
    status: getInitialOrderStatus(metodo_pagamento),
    cupom_codigo: cupom_codigo || null,
    cupom_desconto: cupomDesconto,
  });

  return { message: 'Order created.', id: result.lastID, total: totalFinal };
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
