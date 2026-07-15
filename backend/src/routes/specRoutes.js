const express = require('express');
const controller = require('../controllers/productsController');
const cartController = require('../controllers/cartController');
const { asyncHandler } = require('../utils/http');

// Rotas espelho exigidas literalmente pelo PDF do trabalho (URI - Programação Web).
// Reaproveitam a mesma lógica de /api/produtos, apenas com o nome/forma de rota
// que o professor testa no Postman: POST /products, DELETE /product/:id,
// GET /product/:id, GET /search?query=&cat=&page=&limit=, GET /health.
module.exports = ({ basicAuthMiddleware, cartRateLimit, isDbReady, optionalAuthMiddleware }) => {
  const router = express.Router();

  router.get('/health', (req, res) => {
    res.json({ status: 'ok', db: isDbReady(), timestamp: new Date().toISOString() });
  });

  router.use((req, res, next) => {
    if (!isDbReady()) return res.status(503).json({ error: 'Servidor iniciando, tente novamente em instantes.' });
    next();
  });

  router.post('/products', basicAuthMiddleware, asyncHandler(controller.store));
  router.delete('/product/:id', basicAuthMiddleware, asyncHandler(controller.destroy));
  router.get('/product/:id', asyncHandler(controller.show));
  router.get('/search', asyncHandler(controller.search));
  router.post('/cart', optionalAuthMiddleware, cartRateLimit, asyncHandler(cartController.summary));

  return router;
};
