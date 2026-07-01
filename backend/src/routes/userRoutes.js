const express = require('express');
const controller = require('../controllers/usersController');
const { asyncHandler } = require('../utils/http');

module.exports = ({ perm }) => {
  const router = express.Router();

  router.get('/', perm('clientes.gerenciar'), asyncHandler(controller.index));
  router.delete('/:id', perm('clientes.gerenciar'), asyncHandler(controller.destroy));

  return router;
};
