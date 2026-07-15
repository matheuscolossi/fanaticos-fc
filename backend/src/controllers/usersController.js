const userService = require('../services/userService');
const logService = require('../services/logService');

async function index(req, res) {
  res.json(await userService.listUsers());
}

async function destroy(req, res) {
  const result = await userService.deleteClient(req.params.id);
  await logService.registrar(req.staffUser, 'Cliente excluído', `ID ${req.params.id}`);
  res.json(result);
}

module.exports = { destroy, index };
