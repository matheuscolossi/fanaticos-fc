const orderModel = require('../models/orderModel');
const inventoryModel = require('../models/inventoryModel');
const userModel = require('../models/userModel');
const { transaction } = require('../config/database');
const { createHttpError } = require('../utils/http');
const { buildCartSummary } = require('./cartService');
const { normalizePhone } = require('../validation/userSchemas');
const { requirePlainObject, stringValue, validationError } = require('../validation/commonSchemas');
const { validateArchiveReason, validateOrderUpdate } = require('../validation/orderSchemas');
const emailService = require('./emailService');

function parseOrderItems(order) {
  const itens = Array.isArray(order.itens) ? order.itens : JSON.parse(order.itens || '[]');
  return {
    ...order,
    itens: itens.map((item) => ({
      ...item,
      id: item.id ?? item.productId,
      nome: item.nome ?? item.name,
      preco: Number(item.preco ?? item.price ?? 0),
      imagem: item.imagem ?? item.image ?? null,
    })),
  };
}

function normalizeWhatsappOrder(data, user) {
  requirePlainObject(data, 'Pedido');
  if (data.metodo_pagamento && data.metodo_pagamento !== 'whatsapp') {
    throw createHttpError(
      400,
      'O checkout disponível no momento é pelo WhatsApp.',
      'WHATSAPP_CHECKOUT_ONLY'
    );
  }

  const uf = stringValue(data.uf, 'uf', {
    label: 'UF', required: false, nullable: true, max: 2,
  })?.toUpperCase() || null;
  if (uf && !/^[A-Z]{2}$/.test(uf)) throw validationError('uf', 'UF inválida.');

  return {
    itens: data.itens,
    nome_cliente: stringValue(data.nome_cliente || user.nome, 'nome_cliente', {
      label: 'Nome', min: 2, max: 120, collapseWhitespace: true,
    }),
    email_cliente: user.email,
    telefone_cliente: normalizePhone(data.telefone_cliente),
    endereco: stringValue(data.endereco, 'endereco', {
      label: 'Endereço', min: 8, max: 500, collapseWhitespace: true,
    }),
    uf,
    cupom_codigo: stringValue(data.cupom_codigo, 'cupom_codigo', {
      label: 'Cupom', required: false, nullable: true, max: 50,
      collapseWhitespace: true,
    })?.toUpperCase() || null,
  };
}

async function createOrder(data) {
  if (data?.metodo_pagamento && data.metodo_pagamento !== 'whatsapp') {
    throw createHttpError(
      400,
      'O checkout disponível no momento é pelo WhatsApp.',
      'WHATSAPP_CHECKOUT_ONLY'
    );
  }

  const user = await userModel.findPublicById(Number(data?.usuario_id));
  if (!user) throw createHttpError(401, 'Faça login para finalizar a compra.', 'AUTH_REQUIRED');
  if (user.status === 'inativo') throw createHttpError(403, 'Seu acesso foi desativado.', 'ACCESS_DISABLED');
  if (!user.email_verificado) {
    throw createHttpError(403, 'Confirme seu e-mail antes de finalizar uma compra.', 'EMAIL_NOT_VERIFIED');
  }

  const order = normalizeWhatsappOrder(data, user);
  const summary = await buildCartSummary({
    items: order.itens,
    cupomCode: order.cupom_codigo,
    usuarioId: user.id,
    uf: order.uf,
  });
  if (order.cupom_codigo && summary.cupomErro) {
    throw createHttpError(400, summary.cupomErro, 'COUPON_INVALID');
  }
  if (summary.total <= 0) {
    throw createHttpError(400, 'O valor do pedido deve ser maior que zero.', 'INVALID_ORDER_TOTAL');
  }

  return transaction(async (db) => {
    await inventoryModel.commit(summary.items, db, { reserved: false });
    const result = await orderModel.createWhatsApp({
      usuario_id: user.id,
      itens: summary.items,
      total: summary.total,
      nome_cliente: order.nome_cliente,
      email_cliente: order.email_cliente,
      telefone_cliente: order.telefone_cliente,
      endereco: order.endereco,
      cupom_codigo: order.cupom_codigo,
      cupom_desconto: Number(summary.discount || 0),
      prazo_entrega_min: summary.deliveryEstimate?.minBusinessDays,
      prazo_entrega_max: summary.deliveryEstimate?.maxBusinessDays,
      previsao_entrega: summary.deliveryEstimate?.estimatedDate,
      transportadora: summary.deliveryEstimate?.carrier,
    }, db);
    await orderModel.recordEvent(result.id, {
      tipo: 'pedido_whatsapp_criado',
      status_novo: 'aguardando_pagamento',
      ator_id: user.id,
      ator_nome: user.nome,
      motivo: 'Pagamento será combinado pelo WhatsApp',
      detalhes: { payment_status: 'unpaid', metodo_pagamento: 'whatsapp' },
    }, db);
    return {
      message: 'Pedido criado. Continue pelo WhatsApp para combinar o pagamento.',
      id: result.id,
      total: summary.total,
      subtotal: summary.subtotal,
      freight: summary.freight,
      discount: summary.discount,
    };
  });
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
    // O desconto exibido pelo Stripe também inclui promoções por quantidade.
    // No pedido, cupom_desconto deve registrar somente a parcela do cupom.
    cupom_desconto: Number(draft.desconto || 0),
    stripe_session_id: session.id,
    metodo_pagamento: 'stripe',
    status: 'pago',
    stripe_payment_intent_id: session.payment_intent,
    stripe_customer_id: session.customer,
    stripe_event_id: eventId,
    currency: String(session.currency || draft.currency || 'brl').toUpperCase(),
    shipping_address: shippingAddress?.raw || {},
    prazo_entrega_min: draft.prazo_entrega_min,
    prazo_entrega_max: draft.prazo_entrega_max,
    previsao_entrega: draft.previsao_entrega,
    transportadora: draft.transportadora,
  };

  if (db) return orderModel.createPaidFromStripe(payload, db);

  const result = await orderModel.create(payload);
  return { message: 'Order created.', id: result.lastID, total };
}

async function listOrders(archiveMode = 'active') {
  const orders = await orderModel.list(archiveMode);
  const events = await orderModel.listEvents(orders.map((order) => order.id));
  const groupedEvents = new Map();
  for (const event of events) {
    const list = groupedEvents.get(String(event.pedido_id)) || [];
    let details = event.detalhes;
    if (typeof details === 'string') {
      try { details = JSON.parse(details); } catch { details = {}; }
    }
    list.push({ ...event, detalhes: details || {} });
    groupedEvents.set(String(event.pedido_id), list);
  }
  return orders.map((order) => ({
    ...parseOrderItems(order),
    historico: groupedEvents.get(String(order.id)) || [],
  }));
}

async function listOrdersByUser(user) {
  const orders = await orderModel.listByUser(user);
  return orders.map(parseOrderItems);
}

async function getTrackingForUser(orderId, user) {
  const normalizedId = Number(orderId);
  if (!Number.isSafeInteger(normalizedId) || normalizedId <= 0 || String(normalizedId) !== String(orderId)) {
    throw createHttpError(404, 'Pedido não encontrado para esta conta.', 'ORDER_TRACKING_NOT_FOUND');
  }

  const order = await orderModel.findTrackingForUser(normalizedId, user);
  if (!order) {
    // A mesma resposta é usada para pedido inexistente e pedido de terceiro.
    throw createHttpError(404, 'Pedido não encontrado para esta conta.', 'ORDER_TRACKING_NOT_FOUND');
  }
  return {
    id: order.id,
    status: order.status,
    codigo_rastreio: order.codigo_rastreio || null,
    transportadora: order.transportadora || null,
    rastreio_url: order.rastreio_url || null,
    prazo_entrega_min: order.prazo_entrega_min == null ? null : Number(order.prazo_entrega_min),
    prazo_entrega_max: order.prazo_entrega_max == null ? null : Number(order.prazo_entrega_max),
    previsao_entrega: order.previsao_entrega || null,
    created_at: order.created_at,
  };
}

function eventActor(actor) {
  return {
    ator_id: Number(actor?.id) || null,
    ator_nome: actor?.nome || actor?.email || 'Administrador',
  };
}

function assertOrderCanEnterFulfillment(order, nextStatus, {
  production = process.env.NODE_ENV === 'production',
} = {}) {
  if (!['em_separacao', 'enviado', 'entregue'].includes(nextStatus)) return;
  const paid = order?.payment_status === 'paid';
  const testSession = String(order?.stripe_session_id || '').startsWith('cs_test_');
  if (!paid || (production && testSession)) {
    throw createHttpError(
      409,
      'Pedido sem pagamento confirmado não pode entrar em separação ou envio.',
      'ORDER_PAYMENT_REQUIRED'
    );
  }
}

async function updateOrder(orderId, data, actor) {
  let notificationType = null;
  await transaction(async (db) => {
    const existingOrder = await orderModel.exists(orderId, db);
    if (!existingOrder) throw createHttpError(404, 'Order not found.', 'ORDER_NOT_FOUND');
    if (existingOrder.arquivado_em) {
      throw createHttpError(409, 'Desarquive o pedido antes de alterá-lo.', 'ORDER_ARCHIVED');
    }
    const normalized = validateOrderUpdate(existingOrder.status, data);
    if (normalized.status === 'pago' && existingOrder.metodo_pagamento !== 'whatsapp') {
      throw createHttpError(
        409,
        'Somente pedidos do WhatsApp podem ter o pagamento confirmado manualmente.',
        'MANUAL_PAYMENT_NOT_ALLOWED'
      );
    }
    if (normalized.status === 'pago') normalized.payment_status = 'paid';
    assertOrderCanEnterFulfillment(existingOrder, normalized.status);
    if (normalized.status === 'cancelado' && existingOrder.status !== 'cancelado') {
      await orderModel.restoreStockForOrder(orderId, null, 'cancelado', db);
    }
    await orderModel.updateTracking(orderId, {
      ...normalized,
      cancelado_por: actor?.id,
    }, db);

    if (normalized.status && normalized.status !== existingOrder.status) {
      if (normalized.status === 'pago') notificationType = 'confirmado';
      if (normalized.status === 'enviado') notificationType = 'enviado';
      if (normalized.status === 'cancelado') notificationType = 'cancelado';
      await orderModel.recordEvent(orderId, {
        tipo: normalized.status === 'cancelado' ? 'pedido_cancelado' : 'status_alterado',
        status_anterior: existingOrder.status,
        status_novo: normalized.status,
        ...eventActor(actor),
        motivo: normalized.motivo_cancelamento,
        detalhes: { payment_status: normalized.payment_status || existingOrder.payment_status },
      }, db);
    }
    if (
      normalized.codigo_rastreio !== undefined &&
      normalized.codigo_rastreio !== existingOrder.codigo_rastreio
    ) {
      await orderModel.recordEvent(orderId, {
        tipo: 'rastreio_alterado',
        status_anterior: existingOrder.status,
        status_novo: normalized.status || existingOrder.status,
        ...eventActor(actor),
        detalhes: { codigo_rastreio: normalized.codigo_rastreio },
      }, db);
    }
  });
  if (notificationType && process.env.RESEND_API_KEY) {
    const order = await orderModel.findNotificationById(orderId);
    if (order?.email_cliente) {
      await emailService.enviarAtualizacaoPedido(order.email_cliente, {
        nome: order.nome_cliente,
        pedidoId: order.id,
        tipo: notificationType,
        status: order.status,
        rastreioUrl: order.rastreio_url,
      }).catch((error) => console.error('[order:email:error]', error.message));
    }
  }
  return { message: 'Order updated.' };
}

async function archiveOrder(orderId, data, actor) {
  const reason = validateArchiveReason(data?.motivo);
  await transaction(async (db) => {
    const existingOrder = await orderModel.exists(orderId, db);
    if (!existingOrder) throw createHttpError(404, 'Order not found.', 'ORDER_NOT_FOUND');
    if (existingOrder.arquivado_em) {
      throw createHttpError(409, 'Pedido já está arquivado.', 'ORDER_ALREADY_ARCHIVED');
    }
    await orderModel.setArchived(orderId, { actorId: actor?.id, reason }, db);
    await orderModel.recordEvent(orderId, {
      tipo: 'pedido_arquivado',
      status_anterior: existingOrder.status,
      status_novo: existingOrder.status,
      ...eventActor(actor),
      motivo: reason,
    }, db);
  });
  return { message: 'Pedido arquivado sem remover o histórico.' };
}

async function unarchiveOrder(orderId, actor) {
  await transaction(async (db) => {
    const existingOrder = await orderModel.exists(orderId, db);
    if (!existingOrder) throw createHttpError(404, 'Order not found.', 'ORDER_NOT_FOUND');
    if (!existingOrder.arquivado_em) {
      throw createHttpError(409, 'Pedido não está arquivado.', 'ORDER_NOT_ARCHIVED');
    }
    await orderModel.clearArchived(orderId, db);
    await orderModel.recordEvent(orderId, {
      tipo: 'pedido_desarquivado',
      status_anterior: existingOrder.status,
      status_novo: existingOrder.status,
      ...eventActor(actor),
    }, db);
  });
  return { message: 'Pedido desarquivado.' };
}

async function deleteOrder(orderId, actor) {
  await transaction(async (db) => {
    const existingOrder = await orderModel.exists(orderId, db);
    if (!existingOrder) throw createHttpError(404, 'Order not found.', 'ORDER_NOT_FOUND');
    await orderModel.recordEvent(orderId, {
      tipo: 'exclusao_fisica_bloqueada',
      status_anterior: existingOrder.status,
      status_novo: existingOrder.status,
      ...eventActor(actor),
      motivo: 'Tentativa bloqueada; utilize o arquivamento',
    }, db);
  });
  throw createHttpError(
    405,
    'Pedidos não podem ser excluídos fisicamente. Use o arquivamento.',
    'ORDER_DELETION_FORBIDDEN'
  );
}

module.exports = {
  assertOrderCanEnterFulfillment,
  archiveOrder,
  createOrder,
  createPaidOrderFromStripe,
  deleteOrder,
  getTrackingForUser,
  listOrders,
  listOrdersByUser,
  unarchiveOrder,
  updateOrder,
};
