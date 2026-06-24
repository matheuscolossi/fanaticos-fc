const express = require('express');
const controller = require('../controllers/promocoesController');
const { asyncHandler } = require('../utils/http');

module.exports = (adminMiddleware) => {
  const router = express.Router();

  router.get('/',             adminMiddleware, asyncHandler(controller.index));
  router.get('/:id',          adminMiddleware, asyncHandler(controller.show));
  router.post('/',            adminMiddleware, asyncHandler(controller.store));
  router.put('/:id',          adminMiddleware, asyncHandler(controller.update));
  router.patch('/:id/status', adminMiddleware, asyncHandler(controller.patchStatus));
  router.delete('/:id',       adminMiddleware, asyncHandler(controller.destroy));

  return router;
};
