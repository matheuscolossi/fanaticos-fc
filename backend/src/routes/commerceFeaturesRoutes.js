const express = require('express');
const controller = require('../controllers/commerceFeaturesController');
const { asyncHandler } = require('../utils/http');

module.exports = ({ authMiddleware, optionalAuthMiddleware, perm, verifiedEmailMiddleware }) => {
  const router = express.Router();

  router.get('/produtos/:produtoId/relacionados', asyncHandler(controller.related));
  router.get('/banners', asyncHandler(controller.publicBanners));
  router.get('/conteudos', asyncHandler(controller.publicContent));
  router.post('/privacidade/consentimento', optionalAuthMiddleware, asyncHandler(controller.consent));
  router.post('/analytics/eventos', optionalAuthMiddleware, asyncHandler(controller.analyticsEvent));

  router.get('/favoritos', authMiddleware, asyncHandler(controller.favorites));
  router.post('/favoritos/:produtoId', authMiddleware, asyncHandler(controller.addFavorite));
  router.delete('/favoritos/:produtoId', authMiddleware, asyncHandler(controller.removeFavorite));
  router.get('/carrinho', authMiddleware, asyncHandler(controller.cart));
  router.put('/carrinho', authMiddleware, asyncHandler(controller.saveCart));
  router.get('/vistos-recentemente', authMiddleware, asyncHandler(controller.recent));
  router.post('/vistos-recentemente/:produtoId', authMiddleware, asyncHandler(controller.recordRecent));
  router.get('/alertas-reposicao', authMiddleware, asyncHandler(controller.alerts));
  router.post('/alertas-reposicao/:produtoId', verifiedEmailMiddleware, asyncHandler(controller.createAlert));
  router.delete('/alertas-reposicao/:id', authMiddleware, asyncHandler(controller.cancelAlert));
  router.get('/trocas', authMiddleware, asyncHandler(controller.returns));
  router.post('/trocas', verifiedEmailMiddleware, asyncHandler(controller.createReturn));

  router.get('/admin/trocas', perm('trocas.visualizar'), asyncHandler(controller.adminReturns));
  router.patch('/admin/trocas/:id', perm('trocas.gerenciar'), asyncHandler(controller.updateReturn));
  router.get('/admin/analytics', perm('analytics.visualizar'), asyncHandler(controller.analyticsSummary));
  router.get('/admin/banners', perm('conteudo.visualizar'), asyncHandler(controller.adminBanners));
  router.post('/admin/banners', perm('conteudo.gerenciar'), asyncHandler(controller.createBanner));
  router.put('/admin/banners/:id', perm('conteudo.gerenciar'), asyncHandler(controller.updateBanner));
  router.delete('/admin/banners/:id', perm('conteudo.gerenciar'), asyncHandler(controller.deleteBanner));
  router.get('/admin/conteudos', perm('conteudo.visualizar'), asyncHandler(controller.adminContent));
  router.put('/admin/conteudos', perm('conteudo.gerenciar'), asyncHandler(controller.saveContent));

  return router;
};
