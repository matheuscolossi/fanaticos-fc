const database = require('../config/database');
const { all, get, run } = database;
const { createHttpError } = require('../utils/http');

const ORDER_BY = {
  az:          'p.nome ASC',
  za:          'p.nome DESC',
  preco_asc:   'p.preco ASC',
  preco_desc:  'p.preco DESC',
  estoque_asc: 'p.estoque ASC',
  recente:     'p.created_at DESC',
  antigo:      'p.created_at ASC',
};

function searchSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Administrative projection. Never use this projection in public endpoints.
const ADMIN_PRODUCT_SELECT = `
  p.id, p.nome, p.slug, p.sku, p.preco, p.preco_promocional, p.custo,
  p.categoria_id, p.descricao, p.descricao_curta,
  p.imagens, p.estoque, COALESCE(p.estoque_reservado, 0) AS estoque_reservado, p.estoque_minimo, p.destaque,
  p.time, p.pais, p.competicao, p.temporada, p.tipo, p.marca, p.genero,
  p.tamanhos, p.cores, p.status, p.produto_novo, p.produto_promocional,
  p.peso, p.dimensoes, p.info_lavagem, p.keywords, p.meta_titulo, p.meta_descricao,
  p.created_at, c.nome as categoria_nome
`;

// Public queries still fetch reserved stock so the service can calculate the
// available quantity, but that internal value is never included in the DTO.
const PUBLIC_PRODUCT_LIST_SELECT = `
  p.id, p.nome, p.slug, p.preco, p.preco_promocional, p.categoria_id,
  p.imagens, p.estoque, COALESCE(p.estoque_reservado, 0) AS estoque_reservado,
  p.destaque, p.time, p.pais, p.competicao, p.temporada, p.tipo, p.marca, p.genero,
  p.tamanhos, p.produto_novo, p.produto_promocional,
  c.nome AS categoria_nome
`;

const PUBLIC_PRODUCT_DETAIL_SELECT = `
  p.id, p.nome, p.slug, p.preco, p.preco_promocional, p.categoria_id,
  p.descricao, p.descricao_curta, p.imagens,
  p.estoque, COALESCE(p.estoque_reservado, 0) AS estoque_reservado, p.destaque,
  p.time, p.pais, p.competicao, p.temporada, p.tipo, p.marca, p.genero,
  p.tamanhos, p.cores, p.produto_novo, p.produto_promocional,
  p.peso, p.dimensoes, p.info_lavagem, p.keywords, p.meta_titulo, p.meta_descricao,
  c.nome AS categoria_nome
`;

function buildFilters(query, adminMode = false) {
  const filters = [];
  const params = [];

  // Non-admin: only show active products
  if (!adminMode) {
    filters.push("(p.status = 'ativo' OR p.status IS NULL)");
  }

  if (query.busca) {
    filters.push("(LOWER(p.nome) LIKE LOWER(?) OR LOWER(COALESCE(p.sku,'')) LIKE LOWER(?) OR LOWER(COALESCE(p.time,'')) LIKE LOWER(?) OR LOWER(COALESCE(p.slug,'')) LIKE LOWER(?))");
    const term = `%${query.busca}%`;
    params.push(term, term, term, `%${searchSlug(query.busca)}%`);
  }
  if (query.categoria) {
    filters.push('p.categoria_id = ?');
    params.push(query.categoria);
  }
  if (adminMode && query.status) {
    filters.push('p.status = ?');
    params.push(query.status);
  }
  if (query.tipo) {
    filters.push('p.tipo = ?');
    params.push(query.tipo);
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
  if (query.semEstoque) {
    filters.push('p.estoque = 0');
  }

  return {
    params,
    where:   filters.length ? `WHERE ${filters.join(' AND ')}` : '',
    orderBy: ORDER_BY[query.ordem] || ORDER_BY.recente,
  };
}

function list(query = {}, adminMode = false) {
  const { where, params, orderBy } = buildFilters(query, adminMode);
  return all(
    `SELECT ${ADMIN_PRODUCT_SELECT}
     FROM produtos p
     LEFT JOIN categorias c ON p.categoria_id = c.id
     ${where}
     ORDER BY ${orderBy}`,
    params
  );
}

async function listPaginated(query = {}) {
  const { where, params, orderBy } = buildFilters(query, false);
  const limit  = Math.min(Math.max(Number(query.limit) || 24, 1), 100);
  const page   = Math.max(Number(query.page) || 1, 1);
  const offset = (page - 1) * limit;

  const [rows, countRow] = await Promise.all([
    all(
      `SELECT ${PUBLIC_PRODUCT_LIST_SELECT}
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
    `SELECT ${ADMIN_PRODUCT_SELECT}
     FROM produtos p
     LEFT JOIN categorias c ON p.categoria_id = c.id
     WHERE p.id = ?`,
    [productId]
  );
}

function findPublicById(productId) {
  return get(
    `SELECT ${PUBLIC_PRODUCT_DETAIL_SELECT}
     FROM produtos p
     LEFT JOIN categorias c ON p.categoria_id = c.id
     WHERE p.id = ? AND (p.status = 'ativo' OR p.status IS NULL)`,
    [productId]
  );
}

function exists(productId) {
  return get('SELECT id FROM produtos WHERE id = ?', [productId]);
}

function findBySkus(skus, db = database) {
  const normalized = [...new Set((skus || []).map((sku) => String(sku).trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0) return Promise.resolve([]);
  return db.all(
    `SELECT id, sku FROM produtos
     WHERE LOWER(sku) IN (${normalized.map(() => '?').join(',')})`,
    normalized
  );
}

function findPricesByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return Promise.resolve([]);
  return all(
    `SELECT id, preco, preco_promocional FROM produtos
     WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
}

function create(p, db = database) {
  return db.run(
    `INSERT INTO produtos (
      nome, slug, sku, preco, preco_promocional, custo,
      categoria_id, descricao, descricao_curta,
      imagens, estoque, estoque_minimo, destaque,
      time, pais, competicao, temporada, tipo, marca, genero,
      tamanhos, cores, status, produto_novo, produto_promocional,
      peso, dimensoes, info_lavagem, keywords, meta_titulo, meta_descricao
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      JSON_VALUE(?), ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      JSON_VALUE(?), JSON_VALUE(?), ?, ?, ?,
      ?, JSON_VALUE(?), ?, ?, ?, ?
    )`,
    [
      p.nome, p.slug, p.sku, p.preco, p.preco_promocional, p.custo,
      p.categoria_id, p.descricao, p.descricao_curta,
      p.imagens, p.estoque, p.estoque_minimo, p.destaque,
      p.time, p.pais, p.competicao, p.temporada, p.tipo, p.marca, p.genero,
      p.tamanhos, p.cores, p.status, p.produto_novo, p.produto_promocional,
      p.peso, p.dimensoes, p.info_lavagem, p.keywords, p.meta_titulo, p.meta_descricao,
    ]
  );
}

function update(productId, p, db = database) {
  return db.run(
    `UPDATE produtos SET
      nome=?, slug=?, sku=?, preco=?, preco_promocional=?, custo=?,
      categoria_id=?, descricao=?, descricao_curta=?,
      imagens=JSON_VALUE(?), estoque=?, estoque_minimo=?, destaque=?,
      time=?, pais=?, competicao=?, temporada=?, tipo=?, marca=?, genero=?,
      tamanhos=JSON_VALUE(?), cores=JSON_VALUE(?), status=?, produto_novo=?, produto_promocional=?,
      peso=?, dimensoes=JSON_VALUE(?), info_lavagem=?, keywords=?, meta_titulo=?, meta_descricao=?
     WHERE id=? AND ? >= COALESCE(estoque_reservado, 0)`,
    [
      p.nome, p.slug, p.sku, p.preco, p.preco_promocional, p.custo,
      p.categoria_id, p.descricao, p.descricao_curta,
      p.imagens, p.estoque, p.estoque_minimo, p.destaque,
      p.time, p.pais, p.competicao, p.temporada, p.tipo, p.marca, p.genero,
      p.tamanhos, p.cores, p.status, p.produto_novo, p.produto_promocional,
      p.peso, p.dimensoes, p.info_lavagem, p.keywords, p.meta_titulo, p.meta_descricao,
      productId, p.estoque,
    ]
  );
}

function listVariants(productIds, db = database) {
  const ids = [...new Set((productIds || []).map(Number).filter(Number.isSafeInteger))];
  if (ids.length === 0) return Promise.resolve([]);
  const placeholders = ids.map(() => '?').join(',');
  return db.all(
    `SELECT produto_id, tamanho, estoque, estoque_reservado
     FROM produto_variantes WHERE produto_id IN (${placeholders})
     ORDER BY produto_id, id`,
    ids
  );
}

async function syncVariants(productId, variants, db = database) {
  const current = await db.all(
    'SELECT tamanho, estoque_reservado FROM produto_variantes WHERE produto_id = ?',
    [productId]
  );
  const requestedSizes = new Set(variants.map((variant) => variant.tamanho));
  const blockedRemoval = current.some(
    (variant) => !requestedSizes.has(variant.tamanho) && Number(variant.estoque_reservado) > 0
  );
  if (blockedRemoval) {
    throw createHttpError(409, 'Uma variação reservada não pode ser removida.', 'VARIANT_HAS_STOCK_RESERVATION');
  }

  const orderedVariants = [...variants].sort((a, b) => a.tamanho.localeCompare(b.tamanho));
  for (const variant of orderedVariants) {
    const result = await db.run(
      `INSERT INTO produto_variantes (produto_id, tamanho, estoque, estoque_reservado)
       VALUES (?, ?, ?, 0)
       ON CONFLICT(produto_id, tamanho) DO UPDATE SET estoque = excluded.estoque
       WHERE excluded.estoque >= produto_variantes.estoque_reservado`,
      [productId, variant.tamanho, variant.estoque]
    );
    if (Number(result.changes) !== 1) {
      throw createHttpError(
        409,
        `O estoque da variação ${variant.tamanho} não pode ficar abaixo das reservas.`,
        'VARIANT_STOCK_BELOW_RESERVED'
      );
    }
  }

  for (const variant of current) {
    if (!requestedSizes.has(variant.tamanho)) {
      const result = await db.run(
        'DELETE FROM produto_variantes WHERE produto_id = ? AND tamanho = ? AND estoque_reservado = 0',
        [productId, variant.tamanho]
      );
      if (Number(result.changes) !== 1) {
        throw createHttpError(409, 'Uma variação reservada não pode ser removida.', 'VARIANT_HAS_STOCK_RESERVATION');
      }
    }
  }

  if (variants.length > 0) {
    await db.run(
      `UPDATE produtos SET
         estoque = (SELECT COALESCE(SUM(estoque), 0) FROM produto_variantes WHERE produto_id = ?),
         estoque_reservado = (SELECT COALESCE(SUM(estoque_reservado), 0) FROM produto_variantes WHERE produto_id = ?)
       WHERE id = ?`,
      [productId, productId, productId]
    );
  }
}

async function duplicate(productId) {
  const original = await findById(productId);
  if (!original) return null;
  const copySuffix = ' (cópia)';
  const copyName = `${String(original.nome).slice(0, 200 - copySuffix.length)}${copySuffix}`;
  const copySlug = original.slug ? `${original.slug.slice(0, 194)}-copia` : null;
  const copySku = original.sku ? `${original.sku.slice(0, 98)}-C` : null;
  return run(
    `INSERT INTO produtos (
      nome, slug, sku, preco, preco_promocional, custo,
      categoria_id, descricao, descricao_curta,
      imagens, estoque, estoque_minimo, destaque,
      time, pais, competicao, temporada, tipo, marca, genero,
      tamanhos, cores, status, produto_novo, produto_promocional,
      peso, dimensoes, info_lavagem, keywords, meta_titulo, meta_descricao
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      JSON_VALUE(?), ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      JSON_VALUE(?), JSON_VALUE(?), 'inativo', ?, ?,
      ?, JSON_VALUE(?), ?, ?, ?, ?
    )`,
    [
      copyName,
      copySlug,
      copySku,
      original.preco, original.preco_promocional, original.custo,
      original.categoria_id, original.descricao, original.descricao_curta,
      typeof original.imagens === 'string' ? original.imagens : JSON.stringify(original.imagens || []),
      original.estoque, original.estoque_minimo, original.destaque,
      original.time, original.pais, original.competicao, original.temporada,
      original.tipo, original.marca, original.genero,
      typeof original.tamanhos === 'string' ? original.tamanhos : JSON.stringify(original.tamanhos || []),
      typeof original.cores === 'string' ? original.cores : JSON.stringify(original.cores || []),
      original.produto_novo, original.produto_promocional,
      original.peso,
      typeof original.dimensoes === 'string' ? original.dimensoes : JSON.stringify(original.dimensoes || {}),
      original.info_lavagem, original.keywords, original.meta_titulo, original.meta_descricao,
    ]
  );
}

async function bulkUpdatePrice(ids, { tipo, valor }) {
  if (!ids || ids.length === 0) return;
  const sanitized = ids.map(Number).filter(Boolean);
  if (sanitized.length === 0) return;
  const placeholders = sanitized.map(() => '?').join(',');

  if (tipo === 'fixo') {
    return run(
      `UPDATE produtos SET
         preco_promocional = CASE WHEN preco_promocional > ? THEN NULL ELSE preco_promocional END,
         preco = ?
       WHERE id IN (${placeholders})`,
      [Number(valor), Number(valor), ...sanitized]
    );
  }
  if (tipo === 'desconto_pct') {
    return run(
      `UPDATE produtos SET preco_promocional = CASE
         WHEN ROUND(preco * (1 - ? / 100.0), 2) < 0.01 THEN 0.01
         ELSE ROUND(preco * (1 - ? / 100.0), 2)
       END WHERE id IN (${placeholders})`,
      [Number(valor), Number(valor), ...sanitized]
    );
  }
  if (tipo === 'acrescimo_pct') {
    return run(
      `UPDATE produtos SET preco = ROUND(preco * (1 + ? / 100.0), 2) WHERE id IN (${placeholders})`,
      [Number(valor), ...sanitized]
    );
  }
}

function setStatus(productId, status) {
  return run('UPDATE produtos SET status = ? WHERE id = ?', [status, productId]);
}

function setDestaque(productId, destaque) {
  return run('UPDATE produtos SET destaque = ? WHERE id = ?', [destaque ? 1 : 0, productId]);
}

function remove(productId) {
  return run(
    'DELETE FROM produtos WHERE id = ? AND COALESCE(estoque_reservado, 0) = 0',
    [productId]
  );
}

module.exports = {
  bulkUpdatePrice,
  create,
  duplicate,
  exists,
  findBySkus,
  findPricesByIds,
  findById,
  findPublicById,
  list,
  listPaginated,
  listVariants,
  remove,
  setDestaque,
  setStatus,
  syncVariants,
  update,
};
