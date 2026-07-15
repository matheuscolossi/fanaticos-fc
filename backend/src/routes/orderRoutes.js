const express = require('express');
const controller = require('../controllers/ordersController');
const { asyncHandler } = require('../utils/http');

module.exports = ({ authMiddleware, perm, trackingRateLimit }) => {
  const router = express.Router();

  router.post('/', authMiddleware, asyncHandler(controller.store));
  router.get('/', perm('pedidos.visualizar'), asyncHandler(controller.index));
  router.get('/meus', authMiddleware, asyncHandler(controller.myOrders));
  router.get('/:id/rastreio', authMiddleware, trackingRateLimit, asyncHandler(controller.tracking));
  router.put('/:id', perm('pedidos.alterar'), asyncHandler(controller.update));
  router.delete('/:id', perm('pedidos.alterar'), asyncHandler(controller.destroy));

  return router;
};
