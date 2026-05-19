const express = require('express');
const controller = require('../controllers/productsController');
const { asyncHandler } = require('../utils/http');

module.exports = (adminMiddleware) => {
  const router = express.Router();

  router.get('/', asyncHandler(controller.index));
  router.get('/:id', asyncHandler(controller.show));
  router.post('/', adminMiddleware, asyncHandler(controller.store));
  router.put('/:id', adminMiddleware, asyncHandler(controller.update));
  router.delete('/:id', adminMiddleware, asyncHandler(controller.destroy));

  return router;
};
