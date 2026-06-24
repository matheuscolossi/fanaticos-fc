const promocaoService = require('../services/promocaoService');
const { sendCreated } = require('../utils/http');

async function index(req, res) {
  res.json(await promocaoService.listPromocoes(req.query));
}

async function show(req, res) {
  res.json(await promocaoService.getPromocao(req.params.id));
}

async function store(req, res) {
  sendCreated(res, await promocaoService.createPromocao(req.body));
}

async function update(req, res) {
  res.json(await promocaoService.updatePromocao(req.params.id, req.body));
}

async function patchStatus(req, res) {
  res.json(await promocaoService.setPromocaoStatus(req.params.id, req.body.status));
}

async function destroy(req, res) {
  res.json(await promocaoService.deletePromocao(req.params.id));
}

module.exports = { destroy, index, patchStatus, show, store, update };
