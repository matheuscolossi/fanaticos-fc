const express = require('express');
const { buildAuthController } = require('../controllers/authController');
const { asyncHandler } = require('../utils/http');

module.exports = ({ authMiddleware, jwtSecret, rateLimiters }) => {
  const router = express.Router();
  const controller = buildAuthController(jwtSecret);

  router.post('/register', rateLimiters.register, asyncHandler(controller.register));
  router.post('/login', rateLimiters.login, asyncHandler(controller.login));
  router.post('/logout', controller.logout);
  router.post('/verificar-email', rateLimiters.verifyEmail, asyncHandler(controller.verificarEmail));
  router.post('/reenviar-codigo', rateLimiters.resendCode, asyncHandler(controller.reenviarCodigo));
  router.get('/perfil', authMiddleware, asyncHandler(controller.profile));
  router.put('/perfil', authMiddleware, asyncHandler(controller.updateProfile));

  return router;
};
