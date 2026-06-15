const express = require('express');
const controller = require('../controllers/productsController');
const { asyncHandler } = require('../utils/http');

module.exports = (adminMiddleware) => {
  const router = express.Router();

  // Admin-only bulk / special routes BEFORE /:id to avoid conflicts
  router.post('/bulk-price',     adminMiddleware, asyncHandler(controller.bulkPrice));
  router.get('/export',          adminMiddleware, asyncHandler(controller.exportCsv));
  router.post('/import',         adminMiddleware, asyncHandler(controller.importCsv));

  router.get('/',    asyncHandler(controller.index));
  router.get('/:id', asyncHandler(controller.show));
  router.post('/',   adminMiddleware, asyncHandler(controller.store));
  router.put('/:id', adminMiddleware, asyncHandler(controller.update));
  router.delete('/:id', adminMiddleware, asyncHandler(controller.destroy));

  router.post('/:id/duplicar',       adminMiddleware, asyncHandler(controller.duplicate));
  router.patch('/:id/status',        adminMiddleware, asyncHandler(controller.patchStatus));
  router.patch('/:id/destaque',      adminMiddleware, asyncHandler(controller.patchDestaque));

  return router;
};
