const { createHttpError, sendCreated } = require('../utils/http');
const {
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
} = require('../services/productService');
const categoryModel = require('../models/categoryModel');
const logService = require('../services/logService');

async function index(req, res) {
  if (req.query.admin === 'true') {
    if (req.user?.perfil !== 'admin') {
      throw createHttpError(403, 'Acesso administrativo obrigatório.', 'ADMIN_ACCESS_REQUIRED');
    }
    return res.json(await listProducts(req.query));
  }
  res.json(await listProductsPaginated(req.query));
}

async function show(req, res) {
  res.json(await getProduct(req.params.id));
}

async function store(req, res) {
  const result = await createProduct(req.body);
  await logService.registrar(req.staffUser, 'Produto cadastrado', req.body.nome);
  sendCreated(res, result);
}

async function update(req, res) {
  const result = await updateProduct(req.params.id, req.body);
  await logService.registrar(req.staffUser, 'Produto editado', `ID ${req.params.id} — ${req.body.nome || ''}`);
  res.json(result);
}

async function destroy(req, res) {
  const result = await deleteProduct(req.params.id);
  await logService.registrar(req.staffUser, 'Produto excluído', `ID ${req.params.id}`);
  res.json(result);
}

async function duplicate(req, res) {
  sendCreated(res, await duplicateProduct(req.params.id));
}

async function bulkPrice(req, res) {
  const { ids, tipo, valor } = req.body;
  res.json(await bulkUpdatePrices(ids, { tipo, valor }));
}

async function exportCsv(req, res) {
  const csv = await exportProductsCsv(req.query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="produtos.csv"');
  res.send('﻿' + csv); // UTF-8 BOM for Excel
}

async function importCsv(req, res) {
  const { produtos } = req.body;
  if (!Array.isArray(produtos) || produtos.length === 0) {
    return res.status(400).json({ error: 'Nenhum produto para importar.' });
  }
  let created = 0, errors = 0;
  for (const row of produtos) {
    try {
      await createProduct(row);
      created++;
    } catch {
      errors++;
    }
  }
  res.json({ message: `Importados: ${created}. Erros: ${errors}.`, created, errors });
}

async function patchStatus(req, res) {
  const { status } = req.body;
  res.json(await setProductStatus(req.params.id, status));
}

async function patchDestaque(req, res) {
  const { destaque } = req.body;
  res.json(await setProductDestaque(req.params.id, destaque));
}

// GET /search?query=&cat=&page=&limit= — formato de rota exigido pelo PDF do trabalho
async function search(req, res) {
  const { query, cat } = req.query;
  const page = req.query.page !== undefined ? Number(req.query.page) : 1;
  const limit = req.query.limit !== undefined ? Number(req.query.limit) : 24;

  if (!Number.isInteger(page) || page < 1) {
    throw createHttpError(400, 'page deve ser um número inteiro >= 1.', 'INVALID_PAGE');
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw createHttpError(400, 'limit deve ser um número inteiro >= 1.', 'INVALID_LIMIT');
  }

  let categoria;
  if (cat) {
    const categoriaEncontrada = /^\d+$/.test(cat)
      ? { id: cat }
      : await categoryModel.findByNomeCI(cat);
    categoria = categoriaEncontrada ? categoriaEncontrada.id : -1; // categoria inexistente -> lista vazia
  }

  res.json(await listProductsPaginated({ busca: query, categoria, page, limit }));
}

module.exports = {
  bulkPrice,
  destroy,
  duplicate,
  exportCsv,
  importCsv,
  index,
  patchDestaque,
  patchStatus,
  search,
  show,
  store,
  update,
};
