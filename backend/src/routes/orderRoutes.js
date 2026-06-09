const express = require('express');
const controller = require('../controllers/ordersController');
const { asyncHandler } = require('../utils/http');

module.exports = ({ adminMiddleware, authMiddleware }) => {
  const router = express.Router();

  router.post('/', authMiddleware, asyncHandler(controller.store));
  router.get('/', adminMiddleware, asyncHandler(controller.index));
  router.get('/meus', authMiddleware, asyncHandler(controller.myOrders));
  router.get('/:id/rastreio', asyncHandler(controller.tracking));
  router.put('/:id', adminMiddleware, asyncHandler(controller.update));

  return router;
};
