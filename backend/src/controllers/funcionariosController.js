const funcionarioService = require('../services/funcionarioService');
const logService = require('../services/logService');
const { sendCreated } = require('../utils/http');

async function index(req, res) {
  res.json(await funcionarioService.listFuncionarios());
}

async function store(req, res) {
  const result = await funcionarioService.createFuncionario(req.body);
  await logService.registrar(req.staffUser, 'Funcionário cadastrado', `${req.body.nome} (${req.body.email})`);
  sendCreated(res, result);
}

async function update(req, res) {
  const result = await funcionarioService.updateFuncionario(req.params.id, req.body);
  await logService.registrar(req.staffUser, 'Funcionário atualizado', `ID ${req.params.id} — ${req.body.nome}`);
  res.json(result);
}

async function patchStatus(req, res) {
  const result = await funcionarioService.setFuncionarioStatus(req.params.id, req.body.status, req.staffUser.id);
  await logService.registrar(req.staffUser, `Acesso de funcionário ${req.body.status === 'ativo' ? 'reativado' : 'desativado'}`, `ID ${req.params.id}`);
  res.json(result);
}

module.exports = { index, patchStatus, store, update };
