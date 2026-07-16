const { createHttpError } = require('../utils/http');

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

function validationError(field, message, code = 'VALIDATION_ERROR') {
  const error = createHttpError(400, message, code);
  error.details = { field };
  return error;
}

function requirePlainObject(value, label = 'Dados') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('_root', `${label} inválidos.`);
  }
  return value;
}

function stringValue(value, field, {
  label = field,
  required = true,
  min = required ? 1 : 0,
  max = 255,
  nullable = !required,
  collapseWhitespace = false,
} = {}) {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  if (typeof value !== 'string') throw validationError(field, `${label} inválido.`);
  let normalized = value.trim();
  if (collapseWhitespace) normalized = normalized.replace(/\s+/g, ' ');
  if (nullable && normalized === '') return null;
  if (
    normalized.length < min ||
    normalized.length > max ||
    CONTROL_CHARACTERS.test(normalized)
  ) {
    throw validationError(field, `${label} deve conter entre ${min} e ${max} caracteres.`);
  }
  return normalized;
}

function numberValue(value, field, {
  label = field,
  required = true,
  min = -Number.MAX_VALUE,
  max = Number.MAX_VALUE,
  integer = false,
  decimals = null,
  nullable = !required,
} = {}) {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  if (typeof value === 'boolean' || typeof value === 'object') {
    throw validationError(field, `${label} deve ser um número válido.`);
  }
  if (typeof value === 'string' && !/^-?\d+(?:[.,]\d+)?$/.test(value.trim())) {
    throw validationError(field, `${label} deve ser um número válido.`);
  }
  const normalized = typeof value === 'string' ? value.trim().replace(',', '.') : value;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw validationError(field, `${label} deve estar entre ${min} e ${max}.`);
  }
  if (integer && !Number.isSafeInteger(parsed)) {
    throw validationError(field, `${label} deve ser um número inteiro válido.`);
  }
  if (decimals !== null) {
    const factor = 10 ** decimals;
    if (Math.abs(parsed * factor - Math.round(parsed * factor)) > 1e-7) {
      throw validationError(field, `${label} aceita no máximo ${decimals} casas decimais.`);
    }
  }
  return parsed;
}

function enumValue(value, field, allowed, { label = field, fallback } = {}) {
  const candidate = value === undefined || value === null || value === '' ? fallback : value;
  if (typeof candidate !== 'string' || !allowed.includes(candidate)) {
    throw validationError(field, `${label} deve ser um dos valores: ${allowed.join(', ')}.`);
  }
  return candidate;
}

function booleanValue(value, field, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  throw validationError(field, `${field} deve ser verdadeiro ou falso.`);
}

function jsonValue(value, field, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    throw validationError(field, `${field} contém JSON inválido.`);
  }
}

module.exports = {
  booleanValue,
  enumValue,
  jsonValue,
  numberValue,
  requirePlainObject,
  stringValue,
  validationError,
};
