const { all, get, run } = require('../config/database');

function list(query = {}) {
  const filters = [];
  const params = [];

  if (query.usuario_id) {
    filters.push('usuario_id = ?');
    params.push(query.usuario_id);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  return all(`SELECT * FROM logs_acoes ${where} ORDER BY created_at DESC LIMIT ?`, [...params, limit]);
}

function create({ usuario_id, usuario_nome, acao, detalhes }) {
  return run(
    'INSERT INTO logs_acoes (usuario_id, usuario_nome, acao, detalhes) VALUES (?, ?, ?, ?)',
    [usuario_id || null, usuario_nome || null, acao, detalhes || null]
  );
}

module.exports = { create, list };
