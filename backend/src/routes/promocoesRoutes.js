const express = require('express');
const controller = require('../controllers/promocoesController');
const { asyncHandler } = require('../utils/http');

module.exports = ({ perm }) => {
  const router = express.Router();

  router.get('/',             perm('promocoes.visualizar'), asyncHandler(controller.index));
  router.get('/:id',          perm('promocoes.visualizar'), asyncHandler(controller.show));
  router.post('/',            perm('promocoes.criar'), asyncHandler(controller.store));
  router.put('/:id',          perm('promocoes.editar'), asyncHandler(controller.update));
  router.patch('/:id/status', perm('promocoes.editar'), asyncHandler(controller.patchStatus));
  router.delete('/:id',       perm('promocoes.excluir'), asyncHandler(controller.destroy));

  return router;
};
