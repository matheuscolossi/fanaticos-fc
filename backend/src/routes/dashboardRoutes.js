const express = require('express');
const { dashboard } = require('../controllers/dashboardController');

module.exports = function dashboardRoutes(adminMiddleware) {
  const router = express.Router();
  router.get('/', adminMiddleware, dashboard);
  return router;
};
