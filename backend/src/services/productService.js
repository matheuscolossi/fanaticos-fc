const productModel = require('../models/productModel');
const { transaction } = require('../config/database');
const { normalizeProductImages } = require('./imageService');
const promocaoService = require('./promocaoService');
const { createHttpError } = require('../utils/http');
const {
  MAX_PRICE,
  validateBulkPrice,
  validateProduct,
  validateProductStatus,
} = require('../validation/productSchemas');

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

function normalizeSizes(value) {
  const sizes = parseJson(value, []);
  if (!Array.isArray(sizes)) return [];
  return [...new Set(sizes.map((size) => String(size || '').trim()).filter(Boolean))].slice(0, 30);
}

async function attachVariants(products, { publicView }) {
  const variants = await productModel.listVariants(products.map((product) => product.id));
  const grouped = new Map();
  for (const variant of variants) {
    const list = grouped.get(String(variant.produto_id)) || [];
    const physical = Number(variant.estoque);
    const reserved = Number(variant.estoque_reservado || 0);
    list.push(publicView
      ? { tamanho: variant.tamanho, estoque: Math.max(0, physical - reserved) }
      : { tamanho: variant.tamanho, estoque: physical, estoque_reservado: reserved });
    grouped.set(String(variant.produto_id), list);
  }
  return products.map((product) => {
    const sizes = normalizeSizes(product.tamanhos);
    const variantsForProduct = grouped.get(String(product.id)) || [];
    variantsForProduct.sort((a, b) => sizes.indexOf(a.tamanho) - sizes.indexOf(b.tamanho));
    return { ...product, variantes: variantsForProduct };
  });
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
  const product = validateProduct(body);

  return {
    ...product,
    slug: product.slug ? slugify(product.slug) : slugify(product.nome),
    imagens: JSON.stringify(await normalizeProductImages(product.imagens)),
    tamanhos: JSON.stringify(product.tamanhos),
    cores: JSON.stringify(product.cores),
    dimensoes: JSON.stringify(product.dimensoes),
  };
}

async function ensureProductExists(productId) {
  const product = await productModel.exists(productId);
  if (!product) throw createHttpError(404, 'Produto não encontrado.', 'PRODUCT_NOT_FOUND');
}

async function listProducts(query) {
  const products = await productModel.list(query, true); // admin mode — all statuses
  return (await attachVariants(products, { publicView: false })).map(serializeProduct);
}

function serializePublicProduct(product, { detail = false, imageLimit = null } = {}) {
  const images = parseJson(product.imagens, []);
  const availableStock = Math.max(0, Number(product.estoque) - Number(product.estoque_reservado || 0));
  const publicProduct = {
    id: product.id,
    nome: product.nome,
    slug: product.slug,
    preco: Number(product.preco),
    preco_promocional: product.preco_promocional == null ? null : Number(product.preco_promocional),
    preco_exibicao: Number(product.preco_exibicao ?? product.preco),
    em_promocao: Boolean(product.em_promocao),
    promocao_destaque: Boolean(product.promocao_destaque),
    promocao_nome: product.promocao_nome || null,
    promocao_fim: product.promocao_fim || null,
    categoria_id: product.categoria_id,
    categoria_nome: product.categoria_nome || null,
    imagens: imageLimit == null ? images : images.slice(0, imageLimit),
    estoque: availableStock,
    tamanhos: parseJson(product.tamanhos, []),
    variantes: Array.isArray(product.variantes)
      ? product.variantes.map((variant) => ({
        tamanho: variant.tamanho,
        estoque: Math.max(0, Number(variant.estoque)),
      }))
      : [],
    destaque: Boolean(product.destaque),
    time: product.time || null,
    pais: product.pais || null,
    competicao: product.competicao || null,
    temporada: product.temporada || null,
    tipo: product.tipo || null,
    marca: product.marca || null,
    genero: product.genero || null,
    produto_novo: Boolean(product.produto_novo),
    produto_promocional: Boolean(product.produto_promocional),
  };

  if (detail) {
    Object.assign(publicProduct, {
      descricao: product.descricao || '',
      descricao_curta: product.descricao_curta || '',
      cores: parseJson(product.cores, []),
      peso: product.peso == null ? null : Number(product.peso),
      dimensoes: parseJson(product.dimensoes, {}),
      info_lavagem: product.info_lavagem || null,
      keywords: product.keywords || null,
      meta_titulo: product.meta_titulo || null,
      meta_descricao: product.meta_descricao || null,
    });
  }

  return publicProduct;
}

// Anexa o melhor preço promocional vigente (preço promocional manual ou promoção
// percentual/fixo/preço fixo ativa) a cada produto, para exibição na loja.
function aplicarInfoPromocional(produto, promocoesAtivas) {
  const { precoFinal, promocaoAplicada } = promocaoService.calcularPrecoComPromocao(produto, promocoesAtivas);
  const precoBase = Number(produto.preco);
  return {
    ...produto,
    preco_exibicao: precoFinal,
    em_promocao: precoFinal < precoBase,
    promocao_destaque: Boolean(promocaoAplicada?.destaque),
    promocao_nome: promocaoAplicada?.nome || null,
    promocao_fim: promocaoAplicada?.mostrar_contador ? promocaoAplicada.data_fim : null,
  };
}

async function listProductsPaginated(query) {
  const { produtos, total, page, totalPages } = await productModel.listPaginated(query);
  const promocoesAtivas = await promocaoService.getPromocoesAtivas();
  const withVariants = await attachVariants(produtos, { publicView: true });
  const comPromocao = withVariants.map(p => aplicarInfoPromocional(p, promocoesAtivas));
  return {
    produtos: comPromocao.map((product) => serializePublicProduct(product, { imageLimit: 1 })),
    total,
    page,
    totalPages,
  };
}

async function getProduct(productId) {
  const product = await productModel.findPublicById(productId);
  if (!product) throw createHttpError(404, 'Produto não encontrado.', 'PRODUCT_NOT_FOUND');
  const promocoesAtivas = await promocaoService.getPromocoesAtivas();
  const [withVariants] = await attachVariants([product], { publicView: true });
  return serializePublicProduct(
    aplicarInfoPromocional(withVariants, promocoesAtivas),
    { detail: true }
  );
}

async function createProduct(data) {
  const product = await normalizeProductPayload(data);
  const result = await transaction(async (db) => {
    const created = await productModel.create(product, db);
    if (product.variantes !== null) {
      await productModel.syncVariants(created.lastID, product.variantes, db);
    }
    return created;
  });
  return { message: 'Produto criado.', id: result.lastID };
}

async function updateProduct(productId, data) {
  await ensureProductExists(productId);
  const product = await normalizeProductPayload(data);
  await transaction(async (db) => {
    if (product.variantes === null) {
      const existingVariants = await productModel.listVariants([productId], db);
      if (existingVariants.length > 0) {
        throw createHttpError(400, 'Informe o estoque de todas as variações existentes.', 'VARIANT_STOCK_REQUIRED');
      }
    }
    if (product.variantes !== null) {
      await productModel.syncVariants(productId, product.variantes, db);
    }
    const result = await productModel.update(productId, product, db);
    if (Number(result.changes) !== 1) {
      throw createHttpError(409, 'O estoque físico não pode ficar abaixo das unidades reservadas.', 'STOCK_BELOW_RESERVED');
    }
  });
  return { message: 'Produto atualizado.' };
}

async function duplicateProduct(productId) {
  await ensureProductExists(productId);
  const result = await productModel.duplicate(productId);
  return { message: 'Produto duplicado.', id: result.lastID };
}

async function bulkUpdatePrices(ids, priceData) {
  const validated = validateBulkPrice(ids, priceData);
  const products = await productModel.findPricesByIds(validated.ids);
  if (products.length !== validated.ids.length) {
    throw createHttpError(404, 'Um ou mais produtos não foram encontrados.', 'PRODUCT_NOT_FOUND');
  }
  if (validated.tipo === 'acrescimo_pct') {
    const multiplier = 1 + validated.valor / 100;
    const exceedsLimit = products.some((product) => Number(product.preco) * multiplier > MAX_PRICE);
    if (exceedsLimit) {
      throw createHttpError(400, 'O reajuste ultrapassa o preço máximo permitido.', 'VALIDATION_ERROR');
    }
  }
  await productModel.bulkUpdatePrice(validated.ids, validated);
  return { message: `${validated.ids.length} produto(s) atualizados.` };
}

async function setProductStatus(productId, status) {
  const normalizedStatus = validateProductStatus(status);
  await ensureProductExists(productId);
  await productModel.setStatus(productId, normalizedStatus);
  return { message: 'Status atualizado.' };
}

async function setProductDestaque(productId, destaque) {
  await ensureProductExists(productId);
  await productModel.setDestaque(productId, destaque);
  return { message: 'Destaque atualizado.' };
}

async function deleteProduct(productId) {
  await ensureProductExists(productId);
  const result = await productModel.remove(productId);
  if (Number(result.changes) !== 1) {
    throw createHttpError(409, 'Produto com estoque reservado não pode ser excluído.', 'PRODUCT_HAS_STOCK_RESERVATION');
  }
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
  normalizeProductPayload,
  setProductDestaque,
  setProductStatus,
  updateProduct,
};
