const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { run, get } = require('../config/database');
const { createHttpError } = require('../utils/http');

const PUBLIC_USER_FIELDS = 'id, nome, email, perfil, telefone, endereco_rua, cidade, cep';

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

  const existingUser = await get('SELECT id FROM usuarios WHERE email = ?', [email]);
  if (existingUser) throw createHttpError(409, 'Email already registered.', 'EMAIL_ALREADY_EXISTS');

  const passwordHash = bcrypt.hashSync(senha, 10);
  const result = await run('INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)', [nome, email, passwordHash]);
  return { message: 'User created.', id: result.lastID };
}

async function loginUser({ email, senha }, jwtSecret) {
  const user = await get('SELECT * FROM usuarios WHERE email = ?', [email]);
  if (!user || !bcrypt.compareSync(senha, user.senha)) {
    throw createHttpError(401, 'Invalid credentials.', 'INVALID_CREDENTIALS');
  }

  const publicUser = toPublicUser(user);
  const token = jwt.sign(publicUser, jwtSecret, { expiresIn: '7d' });
  return { token, user: publicUser };
}

async function getProfile(userId) {
  const user = await get(`SELECT ${PUBLIC_USER_FIELDS} FROM usuarios WHERE id = ?`, [userId]);
  if (!user) throw createHttpError(404, 'User not found.', 'USER_NOT_FOUND');
  return user;
}

async function updateProfile(userId, data) {
  const user = await get('SELECT * FROM usuarios WHERE id = ?', [userId]);
  if (!user) throw createHttpError(404, 'User not found.', 'USER_NOT_FOUND');

  if (data.novaSenha) {
    if (!data.senhaAtual) throw createHttpError(400, 'Current password is required.', 'VALIDATION_ERROR');
    if (!bcrypt.compareSync(data.senhaAtual, user.senha)) {
      throw createHttpError(401, 'Current password is incorrect.', 'INVALID_CURRENT_PASSWORD');
    }
    const passwordHash = bcrypt.hashSync(data.novaSenha, 10);
    await run('UPDATE usuarios SET nome = ?, senha = ? WHERE id = ?', [data.nome || user.nome, passwordHash, userId]);
    return getProfile(userId);
  }

  if (
    data.telefone !== undefined ||
    data.endereco_rua !== undefined ||
    data.cidade !== undefined ||
    data.cep !== undefined
  ) {
    await run(
      'UPDATE usuarios SET telefone = ?, endereco_rua = ?, cidade = ?, cep = ? WHERE id = ?',
      [
        data.telefone ?? user.telefone,
        data.endereco_rua ?? user.endereco_rua,
        data.cidade ?? user.cidade,
        data.cep ?? user.cep,
        userId,
      ]
    );
    return getProfile(userId);
  }

  if (!data.nome) throw createHttpError(400, 'Name is required.', 'VALIDATION_ERROR');
  await run('UPDATE usuarios SET nome = ? WHERE id = ?', [data.nome, userId]);
  return getProfile(userId);
}

module.exports = {
  getProfile,
  loginUser,
  registerUser,
  updateProfile,
};
