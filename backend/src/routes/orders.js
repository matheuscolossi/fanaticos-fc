const express = require('express');
const { asyncHandler, sendCreated } = require('../utils/http');
const {
  createOrder,
  getTrackingById,
  listOrders,
  listOrdersByUser,
  updateOrder,
} = require('../services/orderService');

module.exports = ({ adminMiddleware, authMiddleware }) => {
  const router = express.Router();

  router.post('/', asyncHandler(async (req, res) => {
    sendCreated(res, await createOrder(req.body));
  }));

  router.get('/', adminMiddleware, asyncHandler(async (req, res) => {
    res.json(await listOrders());
  }));

  router.get('/meus', authMiddleware, asyncHandler(async (req, res) => {
    res.json(await listOrdersByUser(req.user));
  }));

  router.get('/:id/rastreio', asyncHandler(async (req, res) => {
    res.json(await getTrackingById(req.params.id));
  }));

  router.put('/:id', adminMiddleware, asyncHandler(async (req, res) => {
    res.json(await updateOrder(req.params.id, req.body));
  }));

  return router;
};
