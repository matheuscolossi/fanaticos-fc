const express = require('express');
const { all } = require('../config/database');
const { asyncHandler } = require('../utils/http');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json(await all('SELECT * FROM categorias ORDER BY nome'));
}));

module.exports = router;
