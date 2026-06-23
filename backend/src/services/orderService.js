const orderModel = require('../models/orderModel');
const productModel = require('../models/productModel');
const userModel = require('../models/userModel');
const couponService = require('../services/couponService');
const { createHttpError } = require('../utils/http');

function parseOrderItems(order) {
  if (Array.isArray(order.itens)) return order;
  return { ...order, itens: JSON.parse(order.itens || '[]') };
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
  deleteOrder,
  getTrackingById,
  listOrders,
  listOrdersByUser,
  updateOrder,
};
