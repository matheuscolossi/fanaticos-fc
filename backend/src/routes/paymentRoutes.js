const express = require('express');
const controller = require('../controllers/stripeController');
const { asyncHandler } = require('../utils/http');

module.exports = ({ authMiddleware }) => {
  const router = express.Router();

  router.post('/stripe/create-session', authMiddleware, asyncHandler(controller.createStripeSession));
  router.post('/stripe/webhook', express.raw({ type: 'application/json' }), controller.stripeWebhook);

  return router;
};
