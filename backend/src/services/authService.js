const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const { createHttpError } = require('../utils/http');
const { enviarCodigoVerificacao } = require('./emailService');
const logService = require('./logService');

const CODE_TTL_MINUTES = 15;
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
  };
}

function gerarCodigo() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function codigoExpiraEm() {
  return new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();
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

async function enviarCodigoParaUsuario(user) {
  const codigo = gerarCodigo();
  await userModel.setVerificationCode(user.id, codigo, codigoExpiraEm());
  try {
    await enviarCodigoVerificacao(user.email, codigo);
  } catch (err) {
    console.error('[auth:email:error]', err.message);
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

  try {
    await enviarCodigoParaUsuario({ id: userId, email: normalized.email });
  } catch (err) {
    // Não bloqueia o cadastro se o envio falhar (ex.: domínio ainda não
    // verificado na Resend, que só permite enviar para o próprio e-mail da
    // conta em modo sandbox) — libera o login direto pra não travar clientes reais.
    console.error('[auth:register:email-failed]', err.message);
    const user = await userModel.findById(userId);
    const publicUser = toPublicUser(user);
    const token = jwt.sign(publicUser, jwtSecret, { expiresIn: '7d' });
    return { message: 'User created.', id: userId, requiresVerification: false, token, user: publicUser };
  }

  return { message: 'User created. Verification code sent.', id: userId, requiresVerification: true };
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

  if (!user.codigo_verificacao || user.codigo_verificacao !== String(codigo)) {
    throw createHttpError(400, 'Código inválido.', 'INVALID_CODE');
  }
  if (!user.codigo_expira_em || new Date(user.codigo_expira_em) < new Date()) {
    throw createHttpError(400, 'Código expirado. Solicite um novo.', 'CODE_EXPIRED');
  }

  await userModel.markEmailVerified(user.id);

  const publicUser = toPublicUser(user);
  const token = jwt.sign(publicUser, jwtSecret, { expiresIn: '7d' });
  return { token, user: publicUser };
}

async function reenviarCodigoEmail({ email }) {
  if (!email) throw createHttpError(400, 'Email é obrigatório.', 'VALIDATION_ERROR');

  const user = await userModel.findByEmail(normalizeEmail(email));
  if (!user) throw createHttpError(404, 'Usuário não encontrado.', 'USER_NOT_FOUND');
  if (user.email_verificado) throw createHttpError(409, 'E-mail já verificado.', 'ALREADY_VERIFIED');

  await enviarCodigoParaUsuario(user);
  return { message: 'Código reenviado.' };
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
