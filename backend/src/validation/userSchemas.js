const {
  requirePlainObject,
  stringValue,
  validationError,
} = require('./commonSchemas');

const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;

function normalizeName(value) {
  const name = stringValue(value, 'nome', {
    label: 'Nome', min: 2, max: NAME_MAX_LENGTH, collapseWhitespace: true,
  });
  if (!/[\p{L}\p{N}]/u.test(name) || /[<>]/.test(name)) {
    throw validationError('nome', 'Nome inválido.');
  }
  return name;
}

function normalizeEmail(value) {
  const email = stringValue(value, 'email', {
    label: 'E-mail', min: 3, max: EMAIL_MAX_LENGTH,
  }).toLowerCase();
  if (!/^[^\s@<>"()]+@[^\s@<>"()]+\.[^\s@<>"()]+$/.test(email)) {
    throw validationError('email', 'E-mail inválido.');
  }
  return email;
}

function cpfCheckDigitsAreValid(cpf) {
  const validDigit = (length) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return Number(cpf[length]) === (remainder === 10 ? 0 : remainder);
  };
  return validDigit(9) && validDigit(10);
}

function digitsOnly(value, field, label, {
  required = true,
  rawMax = 30,
  lengths,
} = {}) {
  if (!required && (value === null || value === undefined || value === '')) return null;
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw validationError(field, `${label} inválido.`);
  }
  const raw = String(value).trim();
  if (!raw || raw.length > rawMax || /[\u0000-\u001F\u007F]/.test(raw)) {
    throw validationError(field, `${label} inválido.`);
  }
  const digits = raw.replace(/\D/g, '');
  if (!lengths.includes(digits.length)) throw validationError(field, `${label} inválido.`);
  return digits;
}

function normalizeCpf(value, required = true) {
  const cpf = digitsOnly(value, 'cpf', 'CPF', { required, rawMax: 18, lengths: [11] });
  if (cpf === null) return null;
  if (/^(\d)\1{10}$/.test(cpf) || !cpfCheckDigitsAreValid(cpf)) {
    throw validationError('cpf', 'CPF inválido.');
  }
  return cpf;
}

function normalizePhone(value, required = true) {
  return digitsOnly(value, 'telefone', 'Telefone', {
    required, rawMax: 20, lengths: [10, 11],
  });
}

function normalizeCep(value, required = false) {
  return digitsOnly(value, 'cep', 'CEP', { required, rawMax: 10, lengths: [8] });
}

function normalizeOptionalText(value, field, label, max) {
  return stringValue(value, field, { label, required: false, nullable: true, max });
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length > 128 || /[\u0000]/.test(password)) {
    throw validationError('senha', 'Senha inválida.');
  }
  if (password.length < 8) {
    throw validationError('senha', 'A senha deve ter no mínimo 8 caracteres.', 'WEAK_PASSWORD');
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw validationError('senha', 'A senha deve conter letras e números.', 'WEAK_PASSWORD');
  }
}

function validateRegistration(data) {
  requirePlainObject(data);
  validatePassword(data.senha);
  return {
    nome: normalizeName(data.nome),
    email: normalizeEmail(data.email),
    cpf: normalizeCpf(data.cpf),
    telefone: normalizePhone(data.telefone),
    senha: data.senha,
  };
}

module.exports = {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  normalizeCep,
  normalizeCpf,
  normalizeEmail,
  normalizeName,
  normalizeOptionalText,
  normalizePhone,
  validatePassword,
  validateRegistration,
};
