const express = require('express');
const { buildAuthController } = require('../controllers/authController');
const { asyncHandler } = require('../utils/http');

module.exports = ({ authMiddleware, jwtSecret }) => {
  const router = express.Router();
  const controller = buildAuthController(jwtSecret);

  router.post('/register', asyncHandler(controller.register));
  router.post('/login', asyncHandler(controller.login));
  router.post('/verificar-email', asyncHandler(controller.verificarEmail));
  router.post('/reenviar-codigo', asyncHandler(controller.reenviarCodigo));
  router.get('/perfil', authMiddleware, asyncHandler(controller.profile));
  router.put('/perfil', authMiddleware, asyncHandler(controller.updateProfile));

  return router;
};
