const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const { createHttpError } = require('../utils/http');
const emailService = require('./emailService');
const logService = require('./logService');

function boundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

const CODE_TTL_MINUTES = boundedInteger(process.env.EMAIL_CODE_TTL_MINUTES, 15, 5, 30);
const RESEND_COOLDOWN_SECONDS = boundedInteger(process.env.EMAIL_RESEND_COOLDOWN_SECONDS, 60, 30, 600);
const RESEND_WINDOW_MINUTES = boundedInteger(process.env.EMAIL_RESEND_WINDOW_MINUTES, 60, 15, 24 * 60);
const RESEND_MAX_PER_WINDOW = boundedInteger(process.env.EMAIL_RESEND_MAX_PER_WINDOW, 5, 2, 20);
const VERIFY_MAX_ATTEMPTS = boundedInteger(process.env.EMAIL_CODE_MAX_ATTEMPTS, 5, 3, 10);
const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;

function requireString(value, field, { min = 1, max = 255 } = {}) {
  if (typeof value !== 'string') {
    throw createHttpError(400, `${field} inválido.`, 'VALIDATION_ERROR');
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max || /[\u0000-\u001F\u007F]/.test(normalized)) {
    throw createHttpError(400, `${field} inválido.`, 'VALIDATION_ERROR');
  }
  return normalized;
}

function normalizeNome(value) {
  const nome = requireString(value, 'Nome', { min: 2, max: NAME_MAX_LENGTH });
  if (!/[\p{L}\p{N}]/u.test(nome) || /[<>]/.test(nome)) {
    throw createHttpError(400, 'Nome inválido.', 'VALIDATION_ERROR');
  }
  return nome.replace(/\s+/g, ' ');
}

function normalizeEmail(value) {
  const email = requireString(value, 'E-mail', { min: 3, max: EMAIL_MAX_LENGTH }).toLowerCase();
  if (!/^[^\s@<>"()]+@[^\s@<>"()]+\.[^\s@<>"()]+$/.test(email)) {
    throw createHttpError(400, 'E-mail inválido.', 'VALIDATION_ERROR');
  }
  return email;
}

function normalizeCpf(value) {
  const cpf = requireString(value, 'CPF', { min: 11, max: 14 }).replace(/\D/g, '');
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
    throw createHttpError(400, 'CPF inválido.', 'VALIDATION_ERROR');
  }

  const isValidDigit = (length) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(cpf[i]) * (length + 1 - i);
    const remainder = (sum * 10) % 11;
    return Number(cpf[length]) === (remainder === 10 ? 0 : remainder);
  };
  if (!isValidDigit(9) || !isValidDigit(10)) {
    throw createHttpError(400, 'CPF inválido.', 'VALIDATION_ERROR');
  }
  return cpf;
}

function normalizeTelefone(value, required = true) {
  if (!required && (value === null || value === undefined || value === '')) return null;
  const telefone = requireString(value, 'Telefone', { min: 10, max: 16 }).replace(/\D/g, '');
  if (!/^\d{10,11}$/.test(telefone)) {
    throw createHttpError(400, 'Telefone inválido.', 'VALIDATION_ERROR');
  }
  return telefone;
}

function normalizeOptionalText(value, field, max) {
  if (value === null || value === undefined || value === '') return null;
  return requireString(value, field, { max });
}

function parsePermissoes(value) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

function toPublicUser(user) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil,
    cargo: user.cargo || null,
    permissoes: parsePermissoes(user.permissoes),
    email_verificado: Boolean(user.email_verificado),
  };
}

function gerarCodigo() {
  return String(crypto.randomInt(100000, 1000000));
}

function codigoExpiraEm() {
  return new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();
}

function hashCodigo(userId, codigo, secret) {
  return crypto.createHmac('sha256', secret).update(`${userId}:${codigo}`).digest('hex');
}

function codigoCorresponde(user, codigo, secret) {
  const stored = String(user.codigo_verificacao || '');
  // Compatibilidade temporária com códigos ainda válidos emitidos antes desta migração.
  if (/^\d{6}$/.test(stored)) return stored === codigo;
  const expected = hashCodigo(user.id, codigo, secret);
  if (stored.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(expected));
}

function validarForcaSenha(senha) {
  if (typeof senha !== 'string' || senha.length > 128) {
    throw createHttpError(400, 'Senha inválida.', 'VALIDATION_ERROR');
  }
  if (senha.length < 8) {
    throw createHttpError(400, 'A senha deve ter no mínimo 8 caracteres.', 'WEAK_PASSWORD');
  }
  if (!/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) {
    throw createHttpError(400, 'A senha deve conter letras e números.', 'WEAK_PASSWORD');
  }
}

async function enviarCodigoParaUsuario(user, secret, { enforceLimits = false } = {}) {
  const codigo = gerarCodigo();
  const codeHash = hashCodigo(user.id, codigo, secret);
  const now = new Date().toISOString();
  const reservation = await userModel.storeVerificationCode(user.id, {
    codeHash,
    expiresAt: codigoExpiraEm(),
    now,
    enforceLimits,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
    windowMinutes: RESEND_WINDOW_MINUTES,
    maxSendsPerWindow: RESEND_MAX_PER_WINDOW,
  });
  if (reservation.status === 'cooldown') {
    throw createHttpError(
      429,
      `Aguarde ${reservation.retryAfterSeconds} segundos para solicitar outro código.`,
      'VERIFICATION_RESEND_COOLDOWN'
    );
  }
  if (reservation.status === 'rate_limit') {
    throw createHttpError(
      429,
      'Limite de reenvios atingido. Tente novamente mais tarde.',
      'VERIFICATION_RESEND_LIMIT'
    );
  }
  if (reservation.status === 'not_found') {
    throw createHttpError(404, 'Usuário não encontrado.', 'USER_NOT_FOUND');
  }
  try {
    await emailService.enviarCodigoVerificacao(user.email, codigo, CODE_TTL_MINUTES);
  } catch (err) {
    console.error('[auth:email:error]', err.message);
    await userModel.clearVerificationCode(user.id, codeHash).catch(() => {});
    throw createHttpError(502, 'Não foi possível enviar o código de verificação.', 'EMAIL_SEND_FAILED');
  }
}

async function registerUser({ nome, email, senha, cpf, telefone }, jwtSecret) {
  if (!nome || !email || !senha || !cpf || !telefone) {
    throw createHttpError(400, 'Nome, email, senha, CPF e telefone são obrigatórios.', 'VALIDATION_ERROR');
  }
  const normalized = {
    nome: normalizeNome(nome),
    email: normalizeEmail(email),
    cpf: normalizeCpf(cpf),
    telefone: normalizeTelefone(telefone),
  };
  validarForcaSenha(senha);

  const existingUser = await userModel.findByEmail(normalized.email);
  if (existingUser) throw createHttpError(409, 'Email already registered.', 'EMAIL_ALREADY_EXISTS');

  const passwordHash = bcrypt.hashSync(senha, 10);
  const result = await userModel.create({ ...normalized, senha: passwordHash });
  const userId = result.lastID;

  await enviarCodigoParaUsuario({ id: userId, email: normalized.email }, jwtSecret);

  return {
    message: 'User created. Verification code sent.',
    id: userId,
    requiresVerification: true,
    verificationExpiresInSeconds: CODE_TTL_MINUTES * 60,
  };
}

async function verificarCodigoEmail({ email, codigo }, jwtSecret) {
  if (!email || !codigo) {
    throw createHttpError(400, 'Email e código são obrigatórios.', 'VALIDATION_ERROR');
  }

  const normalizedEmail = normalizeEmail(email);
  if (!/^\d{6}$/.test(String(codigo))) {
    throw createHttpError(400, 'Código inválido.', 'INVALID_CODE');
  }

  const user = await userModel.findByEmail(normalizedEmail);
  if (!user) throw createHttpError(404, 'Usuário não encontrado.', 'USER_NOT_FOUND');
  if (user.email_verificado) throw createHttpError(409, 'E-mail já verificado.', 'ALREADY_VERIFIED');

  if (!user.codigo_verificacao || !codigoCorresponde(user, String(codigo), jwtSecret)) {
    const failure = await userModel.recordVerificationFailure(user.id, VERIFY_MAX_ATTEMPTS);
    if (failure.invalidated) {
      throw createHttpError(
        429,
        'Muitas tentativas inválidas. Solicite um novo código.',
        'VERIFICATION_ATTEMPTS_EXCEEDED'
      );
    }
    throw createHttpError(400, 'Código inválido.', 'INVALID_CODE');
  }
  if (!user.codigo_expira_em || new Date(user.codigo_expira_em) < new Date()) {
    throw createHttpError(400, 'Código expirado. Solicite um novo.', 'CODE_EXPIRED');
  }

  await userModel.markEmailVerified(user.id);

  const publicUser = toPublicUser({ ...user, email_verificado: true });
  const token = jwt.sign(publicUser, jwtSecret, { expiresIn: '7d' });
  return { token, user: publicUser };
}

async function reenviarCodigoEmail({ email }, jwtSecret) {
  if (!email) throw createHttpError(400, 'Email é obrigatório.', 'VALIDATION_ERROR');

  const user = await userModel.findByEmail(normalizeEmail(email));
  if (!user) throw createHttpError(404, 'Usuário não encontrado.', 'USER_NOT_FOUND');
  if (user.email_verificado) throw createHttpError(409, 'E-mail já verificado.', 'ALREADY_VERIFIED');

  await enviarCodigoParaUsuario(user, jwtSecret, { enforceLimits: true });
  return {
    message: 'Código reenviado.',
    verificationExpiresInSeconds: CODE_TTL_MINUTES * 60,
    resendCooldownSeconds: RESEND_COOLDOWN_SECONDS,
  };
}

async function loginUser({ email, senha }, jwtSecret) {
  if (typeof senha !== 'string' || senha.length > 128) {
    throw createHttpError(401, 'Invalid credentials.', 'INVALID_CREDENTIALS');
  }
  const user = await userModel.findByEmail(normalizeEmail(email));
  if (!user || !bcrypt.compareSync(senha, user.senha)) {
    throw createHttpError(401, 'Invalid credentials.', 'INVALID_CREDENTIALS');
  }
  if (user.status === 'inativo') {
    throw createHttpError(403, 'Seu acesso foi desativado. Fale com um administrador.', 'ACCESS_DISABLED');
  }
  if (!user.email_verificado) {
    throw createHttpError(403, 'Confirme seu e-mail antes de entrar.', 'EMAIL_NOT_VERIFIED');
  }

  if (user.perfil === 'admin') {
    await userModel.updateUltimoAcesso(user.id);
    await logService.registrar(user, 'Login realizado', null);
  }

  const publicUser = toPublicUser(user);
  const token = jwt.sign(publicUser, jwtSecret, { expiresIn: '7d' });
  return { token, user: publicUser };
}

async function getProfile(userId) {
  const user = await userModel.findPublicById(userId);
  if (!user) throw createHttpError(404, 'User not found.', 'USER_NOT_FOUND');
  return { ...user, permissoes: parsePermissoes(user.permissoes) };
}

async function updateProfile(userId, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw createHttpError(400, 'Dados inválidos.', 'VALIDATION_ERROR');
  }
  const user = await userModel.findById(userId);
  if (!user) throw createHttpError(404, 'User not found.', 'USER_NOT_FOUND');

  if (data.novaSenha) {
    if (!data.senhaAtual) throw createHttpError(400, 'Current password is required.', 'VALIDATION_ERROR');
    if (!bcrypt.compareSync(data.senhaAtual, user.senha)) {
      throw createHttpError(401, 'Current password is incorrect.', 'INVALID_CURRENT_PASSWORD');
    }
    validarForcaSenha(data.novaSenha);

    const passwordHash = bcrypt.hashSync(data.novaSenha, 10);
    await userModel.updateNameAndPassword(userId, {
      nome: data.nome ? normalizeNome(data.nome) : user.nome,
      senha: passwordHash,
    });
    return getProfile(userId);
  }

  if (
    data.telefone !== undefined ||
    data.endereco_rua !== undefined ||
    data.cidade !== undefined ||
    data.cep !== undefined
  ) {
    await userModel.updateAddress(userId, {
      telefone: data.telefone !== undefined ? normalizeTelefone(data.telefone, false) : user.telefone,
      endereco_rua: data.endereco_rua !== undefined
        ? normalizeOptionalText(data.endereco_rua, 'Endereço', 200) : user.endereco_rua,
      cidade: data.cidade !== undefined ? normalizeOptionalText(data.cidade, 'Cidade', 100) : user.cidade,
      cep: data.cep !== undefined
        ? (() => {
            const cep = String(data.cep || '').replace(/\D/g, '');
            if (cep && !/^\d{8}$/.test(cep)) throw createHttpError(400, 'CEP inválido.', 'VALIDATION_ERROR');
            return cep || null;
          })()
        : user.cep,
    });
    return getProfile(userId);
  }

  if (!data.nome) throw createHttpError(400, 'Name is required.', 'VALIDATION_ERROR');
  await userModel.updateName(userId, normalizeNome(data.nome));
  return getProfile(userId);
}

module.exports = {
  getProfile,
  loginUser,
  registerUser,
  reenviarCodigoEmail,
  updateProfile,
  validarForcaSenha,
  verificarCodigoEmail,
};
