const express = require('express');
const controller = require('../controllers/funcionariosController');
const { asyncHandler } = require('../utils/http');

module.exports = (permMiddleware) => {
  const router = express.Router();

  router.get('/',             permMiddleware, asyncHandler(controller.index));
  router.post('/',            permMiddleware, asyncHandler(controller.store));
  router.put('/:id',          permMiddleware, asyncHandler(controller.update));
  router.patch('/:id/status', permMiddleware, asyncHandler(controller.patchStatus));

  return router;
};
