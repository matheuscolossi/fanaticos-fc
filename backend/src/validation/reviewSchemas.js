const {
  enumValue,
  numberValue,
  requirePlainObject,
  stringValue,
} = require('./commonSchemas');

const REVIEW_STATUSES = ['pendente', 'aprovada', 'rejeitada'];

function validateReview(data) {
  requirePlainObject(data, 'Avaliação');
  return {
    nota: numberValue(data.nota, 'nota', {
      label: 'Nota', min: 1, max: 5, integer: true,
    }),
    titulo: stringValue(data.titulo, 'titulo', {
      label: 'Título', required: false, nullable: true, max: 100,
    }),
    comentario: stringValue(data.comentario, 'comentario', {
      label: 'Comentário', min: 20, max: 2000,
    }),
  };
}

function validateModeration(data) {
  requirePlainObject(data, 'Moderação');
  const status = enumValue(data.status, 'status', ['aprovada', 'rejeitada'], {
    label: 'Decisão de moderação',
  });
  const motivo = stringValue(data.motivo, 'motivo', {
    label: 'Motivo', required: status === 'rejeitada', nullable: status !== 'rejeitada',
    min: status === 'rejeitada' ? 5 : 0, max: 500,
  });
  return { status, motivo };
}

module.exports = { REVIEW_STATUSES, validateModeration, validateReview };
