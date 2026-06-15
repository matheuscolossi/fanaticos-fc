const productModel = require('../models/productModel');
const { normalizeProductImages } = require('./imageService');
const { createHttpError } = require('../utils/http');

function parseJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  try { return JSON.parse(value || JSON.stringify(fallback)); } catch { return fallback; }
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function serializeProduct(product) {
  return {
    ...product,
    imagens:   parseJson(product.imagens, []),
    tamanhos:  parseJson(product.tamanhos, []),
    cores:     parseJson(product.cores, []),
    dimensoes: parseJson(product.dimensoes, {}),
    destaque:        Boolean(product.destaque),
    produto_novo:    Boolean(product.produto_novo),
    produto_promocional: Boolean(product.produto_promocional),
    status: product.status || 'ativo',
  };
}

async function normalizeProductPayload(body) {
  const {
    nome, slug, sku, preco, preco_promocional, custo,
    categoria_id, descricao, descricao_curta,
    imagens, estoque, estoque_minimo, destaque,
    time, pais, competicao, temporada, tipo, marca, genero,
    tamanhos, cores, status,
    produto_novo, produto_promocional,
    peso, dimensoes, info_lavagem,
    keywords, meta_titulo, meta_descricao,
  } = body;

  const numericPrice = Number(preco);
  if (!nome || Number.isNaN(numericPrice)) {
    throw createHttpError(400, 'Nome e preço são obrigatórios.', 'VALIDATION_ERROR');
  }

  const imageList = parseJson(imagens, []);

  return {
    nome:               String(nome).trim(),
    slug:               slug ? slugify(slug) : slugify(nome),
    sku:                sku ? String(sku).trim() : null,
    preco:              numericPrice,
    preco_promocional:  preco_promocional != null && preco_promocional !== '' ? Number(preco_promocional) : null,
    custo:              custo != null && custo !== '' ? Number(custo) : null,
    categoria_id:       categoria_id || null,
    descricao:          descricao || '',
    descricao_curta:    descricao_curta || '',
    imagens:            JSON.stringify(await normalizeProductImages(imageList)),
    estoque:            Number(estoque) || 0,
    estoque_minimo:     Number(estoque_minimo) || 0,
    destaque:           Boolean(destaque),
    time:               time || null,
    pais:               pais || null,
    competicao:         competicao || null,
    temporada:          temporada || null,
    tipo:               tipo || 'torcedor',
    marca:              marca || null,
    genero:             genero || 'masculino',
    tamanhos:           JSON.stringify(parseJson(tamanhos, [])),
    cores:              JSON.stringify(parseJson(cores, [])),
    status:             status || 'ativo',
    produto_novo:       Boolean(produto_novo),
    produto_promocional:Boolean(produto_promocional),
    peso:               peso != null && peso !== '' ? Number(peso) : null,
    dimensoes:          JSON.stringify(parseJson(dimensoes, {})),
    info_lavagem:       info_lavagem || null,
    keywords:           keywords || null,
    meta_titulo:        meta_titulo || null,
    meta_descricao:     meta_descricao || null,
  };
}

async function ensureProductExists(productId) {
  const product = await productModel.exists(productId);
  if (!product) throw createHttpError(404, 'Produto não encontrado.', 'PRODUCT_NOT_FOUND');
}

async function listProducts(query) {
  const products = await productModel.list(query, true); // admin mode — all statuses
  return products.map(serializeProduct);
}

function serializeProductForList(product) {
  const imgs = parseJson(product.imagens, []);
  return { ...product, imagens: imgs.slice(0, 1), destaque: Boolean(product.destaque) };
}

async function listProductsPaginated(query) {
  const { produtos, total, page, totalPages } = await productModel.listPaginated(query);
  return { produtos: produtos.map(serializeProductForList), total, page, totalPages };
}

async function getProduct(productId) {
  const product = await productModel.findById(productId);
  if (!product) throw createHttpError(404, 'Produto não encontrado.', 'PRODUCT_NOT_FOUND');
  return serializeProduct(product);
}

async function createProduct(data) {
  const product = await normalizeProductPayload(data);
  const result = await productModel.create(product);
  return { message: 'Produto criado.', id: result.lastID };
}

async function updateProduct(productId, data) {
  await ensureProductExists(productId);
  const product = await normalizeProductPayload(data);
  await productModel.update(productId, product);
  return { message: 'Produto atualizado.' };
}

async function duplicateProduct(productId) {
  await ensureProductExists(productId);
  const result = await productModel.duplicate(productId);
  return { message: 'Produto duplicado.', id: result.lastID };
}

async function bulkUpdatePrices(ids, priceData) {
  if (!ids?.length) throw createHttpError(400, 'Nenhum produto selecionado.');
  await productModel.bulkUpdatePrice(ids, priceData);
  return { message: `${ids.length} produto(s) atualizados.` };
}

async function setProductStatus(productId, status) {
  await ensureProductExists(productId);
  await productModel.setStatus(productId, status);
  return { message: 'Status atualizado.' };
}

async function setProductDestaque(productId, destaque) {
  await ensureProductExists(productId);
  await productModel.setDestaque(productId, destaque);
  return { message: 'Destaque atualizado.' };
}

async function deleteProduct(productId) {
  await ensureProductExists(productId);
  await productModel.remove(productId);
  return { message: 'Produto excluído.' };
}

// Returns CSV string from all admin products
async function exportProductsCsv(query) {
  const products = await productModel.list(query, true);

  const headers = [
    'id','nome','sku','slug','preco','preco_promocional','custo',
    'categoria','time','pais','competicao','temporada','tipo','marca','genero',
    'estoque','estoque_minimo','status','destaque','produto_novo','produto_promocional',
    'peso','keywords','created_at',
  ];

  const rows = products.map(p => [
    p.id, csvEsc(p.nome), csvEsc(p.sku), csvEsc(p.slug),
    p.preco, p.preco_promocional ?? '', p.custo ?? '',
    csvEsc(p.categoria_nome), csvEsc(p.time), csvEsc(p.pais),
    csvEsc(p.competicao), csvEsc(p.temporada), csvEsc(p.tipo),
    csvEsc(p.marca), csvEsc(p.genero),
    p.estoque, p.estoque_minimo ?? 0,
    p.status ?? 'ativo', p.destaque ? 1 : 0,
    p.produto_novo ? 1 : 0, p.produto_promocional ? 1 : 0,
    p.peso ?? '', csvEsc(p.keywords),
    p.created_at,
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function csvEsc(v) {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}

module.exports = {
  bulkUpdatePrices,
  createProduct,
  deleteProduct,
  duplicateProduct,
  exportProductsCsv,
  getProduct,
  listProducts,
  listProductsPaginated,
  setProductDestaque,
  setProductStatus,
  updateProduct,
};
