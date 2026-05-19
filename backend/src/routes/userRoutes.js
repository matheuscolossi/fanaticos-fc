const express = require('express');
const controller = require('../controllers/usersController');
const { asyncHandler } = require('../utils/http');

module.exports = ({ adminMiddleware }) => {
  const router = express.Router();

  router.get('/', adminMiddleware, asyncHandler(controller.index));

  return router;
};
