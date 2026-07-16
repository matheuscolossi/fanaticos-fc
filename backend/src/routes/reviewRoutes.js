const express = require('express');
const controller = require('../controllers/reviewsController');
const { asyncHandler } = require('../utils/http');

module.exports = ({ optionalAuthMiddleware, perm, verifiedEmailMiddleware }) => {
  const router = express.Router();

  router.get('/produto/:produtoId', optionalAuthMiddleware, asyncHandler(controller.productReviews));
  router.post('/produto/:produtoId', verifiedEmailMiddleware, asyncHandler(controller.store));
  router.get('/admin', perm('avaliacoes.visualizar'), asyncHandler(controller.adminIndex));
  router.patch('/:id/moderar', perm('avaliacoes.moderar'), asyncHandler(controller.moderate));
  router.put('/:id', verifiedEmailMiddleware, asyncHandler(controller.update));

  return router;
};
