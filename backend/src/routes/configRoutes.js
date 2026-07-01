const express = require('express');
const controller = require('../controllers/configController');

module.exports = () => {
  const router = express.Router();

  router.get('/', controller.getConfig);

  return router;
};
