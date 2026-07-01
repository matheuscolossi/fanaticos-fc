const express = require('express');
const controller = require('../controllers/productsController');
const { asyncHandler } = require('../utils/http');

module.exports = ({ perm }) => {
  const router = express.Router();

  // Admin-only bulk / special routes BEFORE /:id to avoid conflicts
  router.post('/bulk-price',     perm('estoque.gerenciar'), asyncHandler(controller.bulkPrice));
  router.get('/export',          perm('estoque.gerenciar'), asyncHandler(controller.exportCsv));
  router.post('/import',         perm('estoque.gerenciar'), asyncHandler(controller.importCsv));

  router.get('/',    asyncHandler(controller.index));
  router.get('/:id', asyncHandler(controller.show));
  router.post('/',   perm('produtos.cadastrar'), asyncHandler(controller.store));
  router.put('/:id', perm('produtos.editar'), asyncHandler(controller.update));
  router.delete('/:id', perm('produtos.excluir'), asyncHandler(controller.destroy));

  router.post('/:id/duplicar',       perm('produtos.cadastrar'), asyncHandler(controller.duplicate));
  router.patch('/:id/status',        perm('produtos.editar'), asyncHandler(controller.patchStatus));
  router.patch('/:id/destaque',      perm('produtos.editar'), asyncHandler(controller.patchDestaque));

  return router;
};
