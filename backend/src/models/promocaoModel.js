const { all, get, run } = require('../config/database');

function list(query = {}) {
  const filters = [];
  const params = [];

  if (query.status) {
    filters.push('status = ?');
    params.push(query.status);
  }
  if (query.tipo) {
    filters.push('tipo = ?');
    params.push(query.tipo);
  }
  if (query.busca) {
    filters.push("(LOWER(nome) LIKE LOWER(?) OR LOWER(COALESCE(descricao,'')) LIKE LOWER(?))");
    const term = `%${query.busca}%`;
    params.push(term, term);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  return all(`SELECT * FROM promocoes ${where} ORDER BY created_at DESC`, params);
}

// Promoções vigentes agora: ativas e dentro da janela de data (quando definida).
function listAtivas() {
  return all(`
    SELECT * FROM promocoes
    WHERE status = 'ativo'
      AND (data_inicio IS NULL OR data_inicio <= CURRENT_TIMESTAMP)
      AND (data_fim IS NULL OR data_fim >= CURRENT_TIMESTAMP)
  `);
}

function findById(id) {
  return get('SELECT * FROM promocoes WHERE id = ?', [id]);
}

function create(p) {
  return run(
    `INSERT INTO promocoes (
      nome, descricao, tipo, valor, compre_qtd, leve_qtd,
      regras_progressivas, produtos_ids, categorias_ids,
      data_inicio, data_fim, destaque, mostrar_contador, status
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      JSON_VALUE(?), JSON_VALUE(?), JSON_VALUE(?),
      ?, ?, ?, ?, ?
    )`,
    [
      p.nome, p.descricao, p.tipo, p.valor, p.compre_qtd, p.leve_qtd,
      JSON.stringify(p.regras_progressivas || []), JSON.stringify(p.produtos_ids || []), JSON.stringify(p.categorias_ids || []),
      p.data_inicio, p.data_fim, p.destaque ? 1 : 0, p.mostrar_contador ? 1 : 0, p.status || 'ativo',
    ]
  );
}

function update(id, p) {
  return run(
    `UPDATE promocoes SET
      nome = ?, descricao = ?, tipo = ?, valor = ?, compre_qtd = ?, leve_qtd = ?,
      regras_progressivas = JSON_VALUE(?), produtos_ids = JSON_VALUE(?), categorias_ids = JSON_VALUE(?),
      data_inicio = ?, data_fim = ?, destaque = ?, mostrar_contador = ?, status = ?
     WHERE id = ?`,
    [
      p.nome, p.descricao, p.tipo, p.valor, p.compre_qtd, p.leve_qtd,
      JSON.stringify(p.regras_progressivas || []), JSON.stringify(p.produtos_ids || []), JSON.stringify(p.categorias_ids || []),
      p.data_inicio, p.data_fim, p.destaque ? 1 : 0, p.mostrar_contador ? 1 : 0, p.status || 'ativo',
      id,
    ]
  );
}

function setStatus(id, status) {
  return run('UPDATE promocoes SET status = ? WHERE id = ?', [status, id]);
}

function remove(id) {
  return run('DELETE FROM promocoes WHERE id = ?', [id]);
}

module.exports = {
  create,
  findById,
  list,
  listAtivas,
  remove,
  setStatus,
  update,
};
