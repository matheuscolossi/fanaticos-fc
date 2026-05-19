const express = require('express');
const controller = require('../controllers/categoriesController');
const { asyncHandler } = require('../utils/http');

const router = express.Router();

router.get('/', asyncHandler(controller.index));

module.exports = router;
