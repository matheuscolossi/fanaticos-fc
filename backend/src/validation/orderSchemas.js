const {
  enumValue,
  numberValue,
  requirePlainObject,
  stringValue,
  validationError,
} = require('./commonSchemas');

const ORDER_STATUSES = [
  'pendente',
  'aguardando_pagamento',
  'pago',
  'em_separacao',
  'enviado',
  'entregue',
  'cancelado',
];

const STATUS_TRANSITIONS = {
  pendente: ['aguardando_pagamento', 'pago', 'cancelado'],
  aguardando_pagamento: ['pago', 'cancelado'],
  pago: ['em_separacao', 'cancelado'],
  em_separacao: ['enviado', 'cancelado'],
  enviado: ['entregue'],
  entregue: [],
  cancelado: [],
};

function validateOrderUpdate(currentStatus, data) {
  requirePlainObject(data, 'Pedido');
  const status = data.status === undefined || data.status === null || data.status === ''
    ? null
    : enumValue(data.status, 'status', ORDER_STATUSES, { label: 'Status' });
  const trackingCode = data.codigo_rastreio === undefined
    ? undefined
    : stringValue(data.codigo_rastreio, 'codigo_rastreio', {
      label: 'Código de rastreio', required: false, nullable: true, max: 100,
    });
  const carrier = data.transportadora === undefined
    ? undefined
    : stringValue(data.transportadora, 'transportadora', {
      label: 'Transportadora', required: false, nullable: true, max: 100,
    });
  const trackingUrl = data.rastreio_url === undefined
    ? undefined
    : stringValue(data.rastreio_url, 'rastreio_url', {
      label: 'Link de rastreio', required: false, nullable: true, max: 2000,
    });
  if (trackingUrl) {
    let parsed;
    try { parsed = new URL(trackingUrl); } catch { throw validationError('rastreio_url', 'Link de rastreio inválido.'); }
    if (parsed.protocol !== 'https:') throw validationError('rastreio_url', 'Link de rastreio deve usar HTTPS.');
  }
  const deliveryMin = data.prazo_entrega_min === undefined ? undefined : numberValue(data.prazo_entrega_min, 'prazo_entrega_min', {
    label: 'Prazo mínimo', required: false, nullable: true, min: 1, max: 120, integer: true,
  });
  const deliveryMax = data.prazo_entrega_max === undefined ? undefined : numberValue(data.prazo_entrega_max, 'prazo_entrega_max', {
    label: 'Prazo máximo', required: false, nullable: true, min: 1, max: 180, integer: true,
  });
  if (deliveryMin && deliveryMax && deliveryMax < deliveryMin) throw validationError('prazo_entrega_max', 'Prazo máximo deve ser maior ou igual ao mínimo.');

  if (status && status !== currentStatus) {
    const allowed = STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(status)) {
      throw validationError(
        'status',
        `Não é permitido alterar o pedido de ${currentStatus} para ${status}.`,
        'ORDER_STATUS_TRANSITION_INVALID'
      );
    }
  }

  let cancellationReason = null;
  if (status === 'cancelado' && status !== currentStatus) {
    cancellationReason = stringValue(data.motivo_cancelamento, 'motivo_cancelamento', {
      label: 'Motivo do cancelamento', min: 5, max: 500,
    });
  }

  if (!status && trackingCode === undefined && carrier === undefined && trackingUrl === undefined && deliveryMin === undefined && deliveryMax === undefined) {
    throw validationError('_root', 'Informe o status ou o código de rastreio.');
  }

  return {
    status,
    codigo_rastreio: trackingCode,
    transportadora: carrier,
    rastreio_url: trackingUrl,
    prazo_entrega_min: deliveryMin,
    prazo_entrega_max: deliveryMax,
    motivo_cancelamento: cancellationReason,
  };
}

function validateArchiveReason(value) {
  return stringValue(value, 'motivo', {
    label: 'Motivo do arquivamento', required: false, nullable: true, max: 500,
  });
}

module.exports = {
  ORDER_STATUSES,
  STATUS_TRANSITIONS,
  validateArchiveReason,
  validateOrderUpdate,
};
