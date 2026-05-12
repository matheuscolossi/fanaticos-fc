const express = require('express');
const { all } = require('../config/database');
const { asyncHandler } = require('../utils/http');

module.exports = ({ adminMiddleware }) => {
  const router = express.Router();

  router.get('/', adminMiddleware, asyncHandler(async (req, res) => {
    res.json(await all('SELECT id, nome, email, perfil, created_at FROM usuarios ORDER BY created_at DESC'));
  }));

  return router;
};
