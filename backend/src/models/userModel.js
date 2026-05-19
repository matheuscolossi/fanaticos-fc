const { all, get, run } = require('../config/database');

const PUBLIC_USER_FIELDS = 'id, nome, email, perfil, telefone, endereco_rua, cidade, cep';

function findByEmail(email) {
  return get('SELECT * FROM usuarios WHERE email = ?', [email]);
}

function findById(userId) {
  return get('SELECT * FROM usuarios WHERE id = ?', [userId]);
}

function findPublicById(userId) {
  return get(`SELECT ${PUBLIC_USER_FIELDS} FROM usuarios WHERE id = ?`, [userId]);
}

function listAdminsView() {
  return all('SELECT id, nome, email, perfil, created_at FROM usuarios ORDER BY created_at DESC');
}

function create({ nome, email, senha }) {
  return run('INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)', [nome, email, senha]);
}

function updateNameAndPassword(userId, { nome, senha }) {
  return run('UPDATE usuarios SET nome = ?, senha = ? WHERE id = ?', [nome, senha, userId]);
}

function updateAddress(userId, data) {
  return run(
    'UPDATE usuarios SET telefone = ?, endereco_rua = ?, cidade = ?, cep = ? WHERE id = ?',
    [data.telefone, data.endereco_rua, data.cidade, data.cep, userId]
  );
}

function updateName(userId, nome) {
  return run('UPDATE usuarios SET nome = ? WHERE id = ?', [nome, userId]);
}

module.exports = {
  create,
  findByEmail,
  findById,
  findPublicById,
  listAdminsView,
  updateAddress,
  updateName,
  updateNameAndPassword,
};
