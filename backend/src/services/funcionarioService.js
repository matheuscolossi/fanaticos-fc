const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');
const { PERMISSOES_KEYS } = require('../constants/permissions');
const { createHttpError } = require('../utils/http');
const { enumValue, requirePlainObject, stringValue } = require('../validation/commonSchemas');
const { normalizeEmail, normalizeName, validatePassword } = require('../validation/userSchemas');

function parsePermissoes(value) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

function sanitizePermissoes(permissoes) {
  const lista = Array.isArray(permissoes) ? permissoes : [];
  return lista.filter(p => PERMISSOES_KEYS.includes(p));
}

function serializeFuncionario(u) {
  return { ...u, permissoes: parsePermissoes(u.permissoes) };
}

const STATUS_VALIDOS = ['ativo', 'inativo'];

async function listFuncionarios() {
  const lista = await userModel.listFuncionarios();
  return lista.map(serializeFuncionario);
}

async function createFuncionario(data) {
  requirePlainObject(data, 'Funcionário');
  const nome = normalizeName(data.nome);
  const email = normalizeEmail(data.email);
  const cargo = stringValue(data.cargo, 'cargo', { label: 'Cargo', min: 1, max: 100 });
  validatePassword(data.senha);

  const existing = await userModel.findByEmail(email);
  if (existing) throw createHttpError(409, 'Já existe uma conta com esse e-mail.', 'EMAIL_ALREADY_EXISTS');

  const senhaHash = bcrypt.hashSync(data.senha, 10);
  const result = await userModel.createFuncionario({
    nome,
    email,
    senha: senhaHash,
    cargo,
    permissoes: sanitizePermissoes(data.permissoes),
    status: enumValue(data.status, 'status', STATUS_VALIDOS, { label: 'Status', fallback: 'ativo' }),
  });
  return { id: result.lastID, message: 'Funcionário cadastrado.' };
}

async function updateFuncionario(id, data) {
  requirePlainObject(data, 'Funcionário');
  const current = await userModel.findById(id);
  if (!current || current.perfil !== 'admin') {
    throw createHttpError(404, 'Funcionário não encontrado.', 'FUNCIONARIO_NOT_FOUND');
  }

  const nome = normalizeName(data.nome);
  const cargo = stringValue(data.cargo, 'cargo', { label: 'Cargo', min: 1, max: 100 });

  const status = enumValue(data.status, 'status', STATUS_VALIDOS, {
    label: 'Status', fallback: current.status,
  });
  if (status === 'inativo' && current.status === 'ativo') {
    const { c } = await userModel.countAdminsAtivos();
    if (Number(c) <= 1) {
      throw createHttpError(409, 'Não é possível desativar o único administrador ativo do sistema.', 'LAST_ACTIVE_ADMIN');
    }
  }

  await userModel.updateFuncionario(id, {
    nome,
    cargo,
    permissoes: sanitizePermissoes(data.permissoes),
    status,
  });

  if (data.senha) {
    validatePassword(data.senha);
    await userModel.updateFuncionarioSenha(id, bcrypt.hashSync(data.senha, 10));
  }

  return { message: 'Funcionário atualizado.' };
}

async function setFuncionarioStatus(id, status, requesterId) {
  if (!STATUS_VALIDOS.includes(status)) throw createHttpError(400, 'Status inválido.', 'VALIDATION_ERROR');

  const current = await userModel.findById(id);
  if (!current || current.perfil !== 'admin') {
    throw createHttpError(404, 'Funcionário não encontrado.', 'FUNCIONARIO_NOT_FOUND');
  }
  if (status === 'inativo' && String(id) === String(requesterId)) {
    throw createHttpError(400, 'Você não pode desativar o próprio acesso.', 'CANNOT_DISABLE_SELF');
  }
  if (status === 'inativo' && current.status === 'ativo') {
    const { c } = await userModel.countAdminsAtivos();
    if (Number(c) <= 1) {
      throw createHttpError(409, 'Não é possível desativar o único administrador ativo do sistema.', 'LAST_ACTIVE_ADMIN');
    }
  }

  await userModel.setFuncionarioStatus(id, status);
  return { message: status === 'ativo' ? 'Acesso reativado.' : 'Acesso desativado.' };
}

module.exports = {
  createFuncionario,
  listFuncionarios,
  setFuncionarioStatus,
  updateFuncionario,
};
