const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');
const { validarForcaSenha } = require('./authService');
const { PERMISSOES_KEYS } = require('../constants/permissions');
const { createHttpError } = require('../utils/http');

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
  const nome = String(data.nome || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  if (!nome || !email) throw createHttpError(400, 'Nome e e-mail são obrigatórios.', 'VALIDATION_ERROR');
  if (!data.cargo || !String(data.cargo).trim()) {
    throw createHttpError(400, 'Cargo é obrigatório.', 'VALIDATION_ERROR');
  }
  if (!data.senha) throw createHttpError(400, 'Senha é obrigatória.', 'VALIDATION_ERROR');
  validarForcaSenha(data.senha);

  const existing = await userModel.findByEmail(email);
  if (existing) throw createHttpError(409, 'Já existe uma conta com esse e-mail.', 'EMAIL_ALREADY_EXISTS');

  const senhaHash = bcrypt.hashSync(data.senha, 10);
  const result = await userModel.createFuncionario({
    nome,
    email,
    senha: senhaHash,
    cargo: String(data.cargo).trim(),
    permissoes: sanitizePermissoes(data.permissoes),
    status: STATUS_VALIDOS.includes(data.status) ? data.status : 'ativo',
  });
  return { id: result.lastID, message: 'Funcionário cadastrado.' };
}

async function updateFuncionario(id, data) {
  const current = await userModel.findById(id);
  if (!current || current.perfil !== 'admin') {
    throw createHttpError(404, 'Funcionário não encontrado.', 'FUNCIONARIO_NOT_FOUND');
  }

  const nome = String(data.nome || '').trim();
  if (!nome) throw createHttpError(400, 'Nome é obrigatório.', 'VALIDATION_ERROR');
  if (!data.cargo || !String(data.cargo).trim()) {
    throw createHttpError(400, 'Cargo é obrigatório.', 'VALIDATION_ERROR');
  }

  const status = STATUS_VALIDOS.includes(data.status) ? data.status : current.status;
  if (status === 'inativo' && current.status === 'ativo') {
    const { c } = await userModel.countAdminsAtivos();
    if (Number(c) <= 1) {
      throw createHttpError(409, 'Não é possível desativar o único administrador ativo do sistema.', 'LAST_ACTIVE_ADMIN');
    }
  }

  await userModel.updateFuncionario(id, {
    nome,
    cargo: String(data.cargo).trim(),
    permissoes: sanitizePermissoes(data.permissoes),
    status,
  });

  if (data.senha) {
    validarForcaSenha(data.senha);
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
