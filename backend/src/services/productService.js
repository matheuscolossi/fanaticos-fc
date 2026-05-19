const productModel = require('../models/productModel');
const { normalizeProductImages } = require('./imageService');
const { createHttpError } = require('../utils/http');

function parseImages(value) {
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value || '[]');
  } catch {
    return [];
  }
}

function serializeProduct(product) {
  return { ...product, imagens: parseImages(product.imagens) };
}

async function normalizeProductPayload(body) {
  const { nome, preco, categoria_id, descricao, imagens, estoque, destaque } = body;
  const numericPrice = Number(preco);
  const imageList = parseImages(imagens);

  if (!nome || Number.isNaN(numericPrice)) {
    throw createHttpError(400, 'Product name and valid price are required.', 'VALIDATION_ERROR');
  }

  return {
    nome,
    preco: numericPrice,
    categoria_id: categoria_id || null,
    descricao: descricao || '',
    imagens: JSON.stringify(await normalizeProductImages(imageList)),
    estoque: Number(estoque) || 0,
    destaque: Boolean(destaque),
  };
}

async function ensureProductExists(productId) {
  const product = await productModel.exists(productId);
  if (!product) throw createHttpError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
}

async function listProducts(query) {
  const products = await productModel.list(query);
  return products.map(serializeProduct);
}

async function getProduct(productId) {
  const product = await productModel.findById(productId);
  if (!product) throw createHttpError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
  return serializeProduct(product);
}

async function createProduct(data) {
  const product = await normalizeProductPayload(data);
  const result = await productModel.create(product);
  return { message: 'Product created.', id: result.lastID };
}

async function updateProduct(productId, data) {
  await ensureProductExists(productId);
  const product = await normalizeProductPayload(data);
  await productModel.update(productId, product);
  return { message: 'Product updated.' };
}

async function deleteProduct(productId) {
  await ensureProductExists(productId);
  await productModel.remove(productId);
  return { message: 'Product deleted.' };
}

module.exports = {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
};
