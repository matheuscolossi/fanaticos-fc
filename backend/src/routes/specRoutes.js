const express = require('express');
const controller = require('../controllers/productsController');
const cartController = require('../controllers/cartController');
const { asyncHandler } = require('../utils/http');

function academicHostOnly(expectedHost) {
  return function academicHostMiddleware(req, res, next) {
    const requestHost = String(req.get('host') || '').trim().toLowerCase().replace(/\.$/, '');
    if (requestHost !== expectedHost) {
      return res.status(404).json({ error: 'Rota não encontrada.', code: 'ROUTE_NOT_FOUND' });
    }
    next();
  };
}

function identifyAcademicActor(req, res, next) {
  req.staffUser = { id: null, nome: 'API acadêmica isolada' };
  next();
}

// As consultas acadêmicas compatíveis com a loja permanecem públicas. As
// mutações só são registradas quando a feature está explicitamente habilitada
// e nunca respondem no host comercial.
module.exports = ({ academicApi, cartRateLimit, isDbReady, optionalAuthMiddleware, publicRateLimit }) => {
  const router = express.Router();

  router.get('/health', (req, res) => {
    res.json({ status: 'ok', db: isDbReady(), timestamp: new Date().toISOString() });
  });

  router.use((req, res, next) => {
    if (!isDbReady()) return res.status(503).json({ error: 'Servidor iniciando, tente novamente em instantes.' });
    next();
  });

  if (academicApi.enabled) {
    const hostOnly = academicHostOnly(academicApi.host);
    const mutationMiddleware = [
      hostOnly,
      academicApi.rateLimit,
      academicApi.basicAuthMiddleware,
      identifyAcademicActor,
    ];
    router.post('/products', ...mutationMiddleware, asyncHandler(controller.store));
    router.delete('/product/:id', ...mutationMiddleware, asyncHandler(controller.destroy));
  }
  router.get('/product/:id', publicRateLimit, asyncHandler(controller.show));
  router.get('/search', publicRateLimit, asyncHandler(controller.search));
  router.post('/cart', optionalAuthMiddleware, cartRateLimit, asyncHandler(cartController.summary));

  return router;
};

module.exports.academicHostOnly = academicHostOnly;
