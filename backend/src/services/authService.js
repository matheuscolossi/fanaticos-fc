const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const { createHttpError } = require('../utils/http');

function toPublicUser(user) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil,
  };
}

async function registerUser({ nome, email, senha }) {
  if (!nome || !email || !senha) {
    throw createHttpError(400, 'Name, email and password are required.', 'VALIDATION_ERROR');
  }

  const existingUser = await userModel.findByEmail(email);
  if (existingUser) throw createHttpError(409, 'Email already registered.', 'EMAIL_ALREADY_EXISTS');

  const passwordHash = bcrypt.hashSync(senha, 10);
  const result = await userModel.create({ nome, email, senha: passwordHash });
  return { message: 'User created.', id: result.lastID };
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
  updateProfile,
};
