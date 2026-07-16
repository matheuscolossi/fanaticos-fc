const express = require('express');
const controller = require('../controllers/categoriesController');
const { asyncHandler } = require('../utils/http');

module.exports = ({ perm }) => {
  const router = express.Router();

  // A vitrine continua pública, mas recebe apenas o DTO comercial de categorias ativas.
  router.get('/', asyncHandler(controller.publicIndex));
  router.get('/admin', perm('categorias.visualizar'), asyncHandler(controller.index));
  router.post('/', perm('categorias.criar'), asyncHandler(controller.store));
  router.put('/:id', perm('categorias.editar'), asyncHandler(controller.update));
  router.patch('/:id/status', perm('categorias.editar'), asyncHandler(controller.patchStatus));
  router.delete('/:id', perm('categorias.excluir'), asyncHandler(controller.destroy));

  return router;
};
