const express = require('express');
const { run, get, all } = require('../config/database');
const { asyncHandler, createHttpError, sendCreated } = require('../utils/http');

const ORDER_BY = {
  az: 'p.nome ASC',
  za: 'p.nome DESC',
  preco_asc: 'p.preco ASC',
  preco_desc: 'p.preco DESC',
  recente: 'p.created_at DESC',
};

function parseImages(value) {
  try {
    return JSON.parse(value || '[]');
  } catch {
    return [];
  }
}

function serializeProduct(product) {
  return { ...product, imagens: parseImages(product.imagens) };
}

function buildProductFilters(query) {
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
    filters.push('p.destaque = 1');
  }

  return {
    params,
    where: filters.length ? `WHERE ${filters.join(' AND ')}` : '',
    orderBy: ORDER_BY[query.ordem] || ORDER_BY.recente,
  };
}

function normalizeProductPayload(body) {
  const { nome, preco, categoria_id, descricao, imagens, estoque, destaque } = body;
  const numericPrice = Number(preco);

  if (!nome || Number.isNaN(numericPrice)) {
    throw createHttpError(400, 'Product name and valid price are required.', 'VALIDATION_ERROR');
  }

  return {
    nome,
    preco: numericPrice,
    categoria_id: categoria_id || null,
    descricao: descricao || '',
    imagens: JSON.stringify(Array.isArray(imagens) ? imagens : []),
    estoque: Number(estoque) || 0,
    destaque: destaque ? 1 : 0,
  };
}

async function ensureProductExists(productId) {
  const product = await get('SELECT id FROM produtos WHERE id = ?', [productId]);
  if (!product) throw createHttpError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
}

module.exports = (adminMiddleware) => {
  const router = express.Router();

  router.get('/', asyncHandler(async (req, res) => {
    const { where, params, orderBy } = buildProductFilters(req.query);
    const products = await all(
      `
        SELECT p.*, c.nome as categoria_nome
        FROM produtos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        ${where}
        ORDER BY ${orderBy}
      `,
      params
    );
    res.json(products.map(serializeProduct));
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
    const product = await get(
      'SELECT p.*, c.nome as categoria_nome FROM produtos p LEFT JOIN categorias c ON p.categoria_id = c.id WHERE p.id = ?',
      [req.params.id]
    );
    if (!product) throw createHttpError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
    res.json(serializeProduct(product));
  }));

  router.post('/', adminMiddleware, asyncHandler(async (req, res) => {
    const product = normalizeProductPayload(req.body);
    const result = await run(
      'INSERT INTO produtos (nome, preco, categoria_id, descricao, imagens, estoque, destaque) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [product.nome, product.preco, product.categoria_id, product.descricao, product.imagens, product.estoque, product.destaque]
    );
    sendCreated(res, { message: 'Product created.', id: result.lastID });
  }));

  router.put('/:id', adminMiddleware, asyncHandler(async (req, res) => {
    await ensureProductExists(req.params.id);
    const product = normalizeProductPayload(req.body);
    await run(
      'UPDATE produtos SET nome=?, preco=?, categoria_id=?, descricao=?, imagens=?, estoque=?, destaque=? WHERE id=?',
      [
        product.nome,
        product.preco,
        product.categoria_id,
        product.descricao,
        product.imagens,
        product.estoque,
        product.destaque,
        req.params.id,
      ]
    );
    res.json({ message: 'Product updated.' });
  }));

  router.delete('/:id', adminMiddleware, asyncHandler(async (req, res) => {
    await ensureProductExists(req.params.id);
    await run('DELETE FROM produtos WHERE id = ?', [req.params.id]);
    res.json({ message: 'Product deleted.' });
  }));

  return router;
};
