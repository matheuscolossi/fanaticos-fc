const userService = require('../services/userService');

async function index(req, res) {
  res.json(await userService.listUsers());
}

async function destroy(req, res) {
  res.json(await userService.deleteUser(req.params.id, req.user.id));
}

module.exports = { destroy, index };
