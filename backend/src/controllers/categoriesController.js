const categoryService = require('../services/categoryService');
const { sendCreated } = require('../utils/http');

async function index(req, res) {
  res.json(await categoryService.listCategories());
}

async function store(req, res) {
  sendCreated(res, await categoryService.createCategory(req.body));
}

async function update(req, res) {
  res.json(await categoryService.updateCategory(req.params.id, req.body));
}

async function patchStatus(req, res) {
  res.json(await categoryService.setCategoryStatus(req.params.id, req.body.status));
}

async function destroy(req, res) {
  res.json(await categoryService.deleteCategory(req.params.id, req.body?.transferir_para));
}

module.exports = { destroy, index, patchStatus, store, update };
