const userModel = require('../models/userModel');

async function index(req, res) {
  res.json(await userModel.listAdminsView());
}

module.exports = { index };
