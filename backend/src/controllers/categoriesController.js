const categoryModel = require('../models/categoryModel');

async function index(req, res) {
  res.json(await categoryModel.list());
}

module.exports = { index };
