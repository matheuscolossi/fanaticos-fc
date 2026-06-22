const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const { createHttpError } = require('../utils/http');
const { enviarCodigoVerificacao } = require('./emailService');

const CODE_TTL_MINUTES = 15;

function toPublicUser(user) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil,
  };
}

function gerarCodigo() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function codigoExpiraEm() {
  return new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();
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

async function registerUser({ nome, email, senha, cpf, telefone }) {
  if (!nome || !email || !senha || !cpf || !telefone) {
    throw createHttpError(400, 'Nome, email, senha, CPF e telefone são obrigatórios.', 'VALIDATION_ERROR');
  }

  const existingUser = await userModel.findByEmail(email);
  if (existingUser) throw createHttpError(409, 'Email already registered.', 'EMAIL_ALREADY_EXISTS');

  const passwordHash = bcrypt.hashSync(senha, 10);
  const result = await userModel.create({ nome, email, senha: passwordHash, cpf, telefone });
  const userId = result.lastID;

  await enviarCodigoParaUsuario({ id: userId, email });

  return { message: 'User created. Verification code sent.', id: userId, requiresVerification: true };
}

async function verificarCodigoEmail({ email, codigo }, jwtSecret) {
  if (!email || !codigo) {
    throw createHttpError(400, 'Email e código são obrigatórios.', 'VALIDATION_ERROR');
  }

  const user = await userModel.findByEmail(email);
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

  const user = await userModel.findByEmail(email);
  if (!user) throw createHttpError(404, 'Usuário não encontrado.', 'USER_NOT_FOUND');
  if (user.email_verificado) throw createHttpError(409, 'E-mail já verificado.', 'ALREADY_VERIFIED');

  await enviarCodigoParaUsuario(user);
  return { message: 'Código reenviado.' };
}

async function loginUser({ email, senha }, jwtSecret) {
  const user = await userModel.findByEmail(email);
  if (!user || !bcrypt.compareSync(senha, user.senha)) {
    throw createHttpError(401, 'Invalid credentials.', 'INVALID_CREDENTIALS');
  }

  const publicUser = toPublicUser(user);
  const token = jwt.sign(publicUser, jwtSecret, { expiresIn: '7d' });
  return { token, user: publicUser };
}

async function getProfile(userId) {
  const user = await userModel.findPublicById(userId);
  if (!user) throw createHttpError(404, 'User not found.', 'USER_NOT_FOUND');
  return user;
}

async function updateProfile(userId, data) {
  const user = await userModel.findById(userId);
  if (!user) throw createHttpError(404, 'User not found.', 'USER_NOT_FOUND');

  if (data.novaSenha) {
    if (!data.senhaAtual) throw createHttpError(400, 'Current password is required.', 'VALIDATION_ERROR');
    if (!bcrypt.compareSync(data.senhaAtual, user.senha)) {
      throw createHttpError(401, 'Current password is incorrect.', 'INVALID_CURRENT_PASSWORD');
    }

    const passwordHash = bcrypt.hashSync(data.novaSenha, 10);
    await userModel.updateNameAndPassword(userId, { nome: data.nome || user.nome, senha: passwordHash });
    return getProfile(userId);
  }

  if (
    data.telefone !== undefined ||
    data.endereco_rua !== undefined ||
    data.cidade !== undefined ||
    data.cep !== undefined
  ) {
    await userModel.updateAddress(userId, {
      telefone: data.telefone ?? user.telefone,
      endereco_rua: data.endereco_rua ?? user.endereco_rua,
      cidade: data.cidade ?? user.cidade,
      cep: data.cep ?? user.cep,
    });
    return getProfile(userId);
  }

  if (!data.nome) throw createHttpError(400, 'Name is required.', 'VALIDATION_ERROR');
  await userModel.updateName(userId, data.nome);
  return getProfile(userId);
}

module.exports = {
  getProfile,
  loginUser,
  registerUser,
  reenviarCodigoEmail,
  updateProfile,
  verificarCodigoEmail,
};
