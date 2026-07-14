const express = require('express');
const controller = require('../controllers/stripeController');
const { asyncHandler } = require('../utils/http');

module.exports = ({ authMiddleware }) => {
  const router = express.Router();

  router.post('/stripe/create-session', authMiddleware, asyncHandler(controller.createStripeSession));
  router.get('/stripe/session/:sessionId', authMiddleware, asyncHandler(controller.stripeSessionStatus));
  router.post('/stripe/webhook', controller.stripeWebhook);

  // Aliases em inglês para integrações externas e documentação.
  router.post('/create-checkout-session', authMiddleware, asyncHandler(controller.createStripeSession));
  router.get('/session/:sessionId', authMiddleware, asyncHandler(controller.stripeSessionStatus));
  router.post('/webhook', controller.stripeWebhook);

  return router;
};
