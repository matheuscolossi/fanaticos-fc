const { sendCreated } = require('../utils/http');
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

async function index(req, res) {
  if (req.query.admin === 'true') {
    return res.json(await listProducts(req.query));
  }
  res.json(await listProductsPaginated(req.query));
}

async function show(req, res) {
  res.json(await getProduct(req.params.id));
}

async function store(req, res) {
  sendCreated(res, await createProduct(req.body));
}

async function update(req, res) {
  res.json(await updateProduct(req.params.id, req.body));
}

async function destroy(req, res) {
  res.json(await deleteProduct(req.params.id));
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

module.exports = {
  bulkPrice,
  destroy,
  duplicate,
  exportCsv,
  importCsv,
  index,
  patchDestaque,
  patchStatus,
  show,
  store,
  update,
};
