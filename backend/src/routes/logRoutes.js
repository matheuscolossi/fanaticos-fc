const express = require('express');
const controller = require('../controllers/logsController');
const { asyncHandler } = require('../utils/http');

module.exports = (permMiddleware) => {
  const router = express.Router();
  router.get('/', permMiddleware, asyncHandler(controller.index));
  return router;
};
