const { all, get, run } = require('../config/database');

const PUBLIC_USER_FIELDS = 'id, nome, email, perfil, cpf, telefone, endereco_rua, cidade, cep, email_verificado';

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
  return all(`
    SELECT u.id, u.nome, u.email, u.perfil, u.created_at,
      (SELECT COUNT(*) FROM pedidos p WHERE p.usuario_id = u.id) AS pedidos_count
    FROM usuarios u
    ORDER BY u.created_at DESC
  `);
}

function countAdmins() {
  return get("SELECT COUNT(*) as c FROM usuarios WHERE perfil = 'admin'");
}

function countPedidos(userId) {
  return get('SELECT COUNT(*) as c FROM pedidos WHERE usuario_id = ?', [userId]);
}

function unlinkPedidos(userId) {
  return run('UPDATE pedidos SET usuario_id = NULL WHERE usuario_id = ?', [userId]);
}

function remove(userId) {
  return run('DELETE FROM usuarios WHERE id = ?', [userId]);
}

function create({ nome, email, senha, cpf, telefone }) {
  return run(
    'INSERT INTO usuarios (nome, email, senha, cpf, telefone) VALUES (?, ?, ?, ?, ?)',
    [nome, email, senha, cpf || null, telefone || null]
  );
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

function setVerificationCode(userId, codigo, expiraEm) {
  return run(
    'UPDATE usuarios SET codigo_verificacao = ?, codigo_expira_em = ? WHERE id = ?',
    [codigo, expiraEm, userId]
  );
}

function markEmailVerified(userId) {
  return run(
    'UPDATE usuarios SET email_verificado = ?, codigo_verificacao = NULL, codigo_expira_em = NULL WHERE id = ?',
    [1, userId]
  );
}

module.exports = {
  countAdmins,
  countPedidos,
  create,
  findByEmail,
  findById,
  findPublicById,
  listAdminsView,
  markEmailVerified,
  remove,
  setVerificationCode,
  unlinkPedidos,
  updateAddress,
  updateName,
  updateNameAndPassword,
};
