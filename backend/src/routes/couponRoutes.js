const express = require('express');
const controller = require('../controllers/couponsController');
const { asyncHandler } = require('../utils/http');

module.exports = ({ perm }) => {
  const router = express.Router();

  router.get('/',              perm('cupons.visualizar'), asyncHandler(controller.index));
  router.get('/:id',           perm('cupons.visualizar'), asyncHandler(controller.show));
  router.get('/:id/usos',      perm('cupons.visualizar'), asyncHandler(controller.usage));
  router.post('/',             perm('cupons.criar'), asyncHandler(controller.store));
  router.post('/:id/duplicar', perm('cupons.criar'), asyncHandler(controller.duplicate));
  router.put('/:id',           perm('cupons.editar'), asyncHandler(controller.update));
  router.patch('/:id/status',  perm('cupons.editar'), asyncHandler(controller.patchStatus));
  router.delete('/:id',        perm('cupons.excluir'), asyncHandler(controller.destroy));

  return router;
};
