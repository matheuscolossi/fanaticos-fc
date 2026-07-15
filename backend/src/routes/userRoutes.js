const express = require('express');
const controller = require('../controllers/usersController');
const { asyncHandler } = require('../utils/http');

module.exports = ({ perm }) => {
  const router = express.Router();

  // Este router administra exclusivamente clientes. Contas administrativas
  // pertencem a /api/admin/funcionarios e exigem administradores.gerenciar.
  router.use(perm('clientes.gerenciar'));
  router.get('/', asyncHandler(controller.index));
  router.delete('/:id', asyncHandler(controller.destroy));

  return router;
};
