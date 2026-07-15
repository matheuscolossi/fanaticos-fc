const database = require('../config/database');
const { all, get, run } = database;

const PUBLIC_USER_FIELDS = 'id, nome, email, perfil, cargo, permissoes, status, cpf, telefone, endereco_rua, cidade, cep, email_verificado';

function findByEmail(email) {
  return get('SELECT * FROM usuarios WHERE email = ?', [email]);
}

function findById(userId) {
  return get('SELECT * FROM usuarios WHERE id = ?', [userId]);
}

function findPublicById(userId) {
  return get(`SELECT ${PUBLIC_USER_FIELDS} FROM usuarios WHERE id = ?`, [userId]);
}

function listClientsView() {
  return all(`
    SELECT u.id, u.nome, u.email, u.created_at,
      (SELECT COUNT(*) FROM pedidos p WHERE p.usuario_id = u.id) AS pedidos_count
    FROM usuarios u
    WHERE u.perfil = 'cliente'
    ORDER BY u.created_at DESC
  `);
}

function removeClientWithRelations(userId) {
  return database.transaction(async (db) => {
    const client = await db.get(
      "SELECT id FROM usuarios WHERE id = ? AND perfil = 'cliente'",
      [userId]
    );
    if (!client) return null;

    await db.run('UPDATE pedidos SET usuario_id = NULL WHERE usuario_id = ?', [userId]);
    await db.run('UPDATE logs_acoes SET usuario_id = NULL WHERE usuario_id = ?', [userId]);
    const result = await db.run(
      "DELETE FROM usuarios WHERE id = ? AND perfil = 'cliente'",
      [userId]
    );
    if (Number(result.changes) !== 1) {
      throw new Error('A conta deixou de ser cliente durante a exclusão.');
    }
    return client;
  });
}

function countAdminsAtivos() {
  return get("SELECT COUNT(*) as c FROM usuarios WHERE perfil = 'admin' AND status = 'ativo'");
}

function countPedidos(userId) {
  return get('SELECT COUNT(*) as c FROM pedidos WHERE usuario_id = ?', [userId]);
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

function updateUltimoAcesso(userId) {
  return run('UPDATE usuarios SET ultimo_acesso = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
}

// ── Funcionários/administradores (perfil = 'admin') ────────────────────────

function listFuncionarios() {
  return all(`
    SELECT id, nome, email, perfil, cargo, permissoes, status, ultimo_acesso, created_at
    FROM usuarios
    WHERE perfil = 'admin'
    ORDER BY created_at DESC
  `);
}

function createFuncionario({ nome, email, senha, cargo, permissoes, status }) {
  return run(
    `INSERT INTO usuarios (nome, email, senha, perfil, cargo, permissoes, status, email_verificado)
     VALUES (?, ?, ?, 'admin', ?, JSON_VALUE(?), ?, ?)`,
    [nome, email, senha, cargo || null, JSON.stringify(permissoes || []), status || 'ativo', 1]
  );
}

function updateFuncionario(userId, { nome, cargo, permissoes, status }) {
  return run(
    `UPDATE usuarios SET nome = ?, cargo = ?, permissoes = JSON_VALUE(?), status = ? WHERE id = ?`,
    [nome, cargo || null, JSON.stringify(permissoes || []), status || 'ativo', userId]
  );
}

function updateFuncionarioSenha(userId, senhaHash) {
  return run('UPDATE usuarios SET senha = ? WHERE id = ?', [senhaHash, userId]);
}

function setFuncionarioStatus(userId, status) {
  return run('UPDATE usuarios SET status = ? WHERE id = ?', [status, userId]);
}

module.exports = {
  countAdminsAtivos,
  countPedidos,
  create,
  createFuncionario,
  findByEmail,
  findById,
  findPublicById,
  listClientsView,
  listFuncionarios,
  markEmailVerified,
  removeClientWithRelations,
  setFuncionarioStatus,
  setVerificationCode,
  updateAddress,
  updateFuncionario,
  updateFuncionarioSenha,
  updateName,
  updateNameAndPassword,
  updateUltimoAcesso,
};
