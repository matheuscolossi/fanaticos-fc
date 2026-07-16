const {
  enumValue,
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

  if (!status && trackingCode === undefined) {
    throw validationError('_root', 'Informe o status ou o código de rastreio.');
  }

  return { status, codigo_rastreio: trackingCode, motivo_cancelamento: cancellationReason };
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
