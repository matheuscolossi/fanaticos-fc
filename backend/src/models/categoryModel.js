const { all, get, run } = require('../config/database');

function list() {
  return all(`
    SELECT c.*,
      (SELECT COUNT(*) FROM produtos p WHERE p.categoria_id = c.id) AS produtos_count,
      (SELECT COUNT(*) FROM categorias sub WHERE sub.categoria_pai_id = c.id) AS subcategorias_count,
      pai.nome AS categoria_pai_nome
    FROM categorias c
    LEFT JOIN categorias pai ON pai.id = c.categoria_pai_id
    ORDER BY c.ordem ASC, c.nome ASC
  `);
}

function listPublic() {
  return all(`
    SELECT id, nome, imagem, categoria_pai_id, ordem
    FROM categorias
    WHERE status = 'ativo' OR status IS NULL
    ORDER BY ordem ASC, nome ASC
  `);
}

function findById(id) {
  return get('SELECT * FROM categorias WHERE id = ?', [id]);
}

function findByNome(nome) {
  return get('SELECT * FROM categorias WHERE nome = ?', [nome]);
}

function findByNomeCI(nome) {
  return get('SELECT * FROM categorias WHERE LOWER(nome) = LOWER(?)', [nome]);
}

function countProdutos(categoriaId) {
  return get('SELECT COUNT(*) as c FROM produtos WHERE categoria_id = ?', [categoriaId]);
}

function countSubcategorias(categoriaId) {
  return get('SELECT COUNT(*) as c FROM categorias WHERE categoria_pai_id = ?', [categoriaId]);
}

function create({ nome, imagem, categoria_pai_id, ordem, status }) {
  return run(
    'INSERT INTO categorias (nome, imagem, categoria_pai_id, ordem, status) VALUES (?, ?, ?, ?, ?)',
    [nome, imagem || null, categoria_pai_id || null, ordem ?? 0, status || 'ativo']
  );
}

function update(id, { nome, imagem, categoria_pai_id, ordem, status }) {
  return run(
    'UPDATE categorias SET nome = ?, imagem = ?, categoria_pai_id = ?, ordem = ?, status = ? WHERE id = ?',
    [nome, imagem || null, categoria_pai_id || null, ordem ?? 0, status || 'ativo', id]
  );
}

function setStatus(id, status) {
  return run('UPDATE categorias SET status = ? WHERE id = ?', [status, id]);
}

function remove(id) {
  return run('DELETE FROM categorias WHERE id = ?', [id]);
}

function reassignProducts(fromId, toId) {
  return run('UPDATE produtos SET categoria_id = ? WHERE categoria_id = ?', [toId, fromId]);
}

module.exports = {
  countProdutos,
  countSubcategorias,
  create,
  findByNome,
  findByNomeCI,
  findById,
  list,
  listPublic,
  reassignProducts,
  remove,
  setStatus,
  update,
};
