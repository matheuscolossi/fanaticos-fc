const { all, get, run } = require('../config/database');

const ORDER_BY = {
  az: 'p.nome ASC',
  za: 'p.nome DESC',
  preco_asc: 'p.preco ASC',
  preco_desc: 'p.preco DESC',
  recente: 'p.created_at DESC',
};

function buildFilters(query) {
  const filters = [];
  const params = [];

  if (query.busca) {
    filters.push('LOWER(p.nome) LIKE LOWER(?)');
    params.push(`%${query.busca}%`);
  }
  if (query.categoria) {
    filters.push('p.categoria_id = ?');
    params.push(query.categoria);
  }
  if (query.precoMin) {
    filters.push('p.preco >= ?');
    params.push(Number(query.precoMin));
  }
  if (query.precoMax) {
    filters.push('p.preco <= ?');
    params.push(Number(query.precoMax));
  }
  if (query.destaque) {
    filters.push('p.destaque = TRUE');
  }

  return {
    params,
    where: filters.length ? `WHERE ${filters.join(' AND ')}` : '',
    orderBy: ORDER_BY[query.ordem] || ORDER_BY.recente,
  };
}

function list(query = {}) {
  const { where, params, orderBy } = buildFilters(query);
  return all(
    `SELECT p.*, c.nome as categoria_nome
     FROM produtos p
     LEFT JOIN categorias c ON p.categoria_id = c.id
     ${where}
     ORDER BY ${orderBy}`,
    params
  );
}

async function listPaginated(query = {}) {
  const { where, params, orderBy } = buildFilters(query);
  const limit = Math.min(Math.max(Number(query.limit) || 24, 1), 100);
  const page  = Math.max(Number(query.page) || 1, 1);
  const offset = (page - 1) * limit;

  const [rows, countRow] = await Promise.all([
    all(
      `SELECT p.id, p.nome, p.preco, p.categoria_id, p.destaque, p.estoque, p.imagens, c.nome as categoria_nome
       FROM produtos p
       LEFT JOIN categorias c ON p.categoria_id = c.id
       ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ),
    get(`SELECT COUNT(*) as total FROM produtos p ${where}`, params),
  ]);

  const total = Number(countRow?.total || 0);
  return { produtos: rows, total, page, totalPages: Math.ceil(total / limit) };
}

function findById(productId) {
  return get(
    'SELECT p.*, c.nome as categoria_nome FROM produtos p LEFT JOIN categorias c ON p.categoria_id = c.id WHERE p.id = ?',
    [productId]
  );
}

function exists(productId) {
  return get('SELECT id FROM produtos WHERE id = ?', [productId]);
}

function create(product) {
  return run(
    'INSERT INTO produtos (nome, preco, categoria_id, descricao, imagens, estoque, destaque) VALUES (?, ?, ?, ?, JSON_VALUE(?), ?, ?)',
    [product.nome, product.preco, product.categoria_id, product.descricao, product.imagens, product.estoque, product.destaque]
  );
}

function update(productId, product) {
  return run(
    'UPDATE produtos SET nome=?, preco=?, categoria_id=?, descricao=?, imagens=JSON_VALUE(?), estoque=?, destaque=? WHERE id=?',
    [
      product.nome,
      product.preco,
      product.categoria_id,
      product.descricao,
      product.imagens,
      product.estoque,
      product.destaque,
      productId,
    ]
  );
}

function remove(productId) {
  return run('DELETE FROM produtos WHERE id = ?', [productId]);
}

module.exports = {
  create,
  exists,
  findById,
  list,
  listPaginated,
  remove,
  update,
};
