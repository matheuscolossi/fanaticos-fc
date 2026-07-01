const logService = require('../services/logService');

async function index(req, res) {
  res.json(await logService.listLogs(req.query));
}

module.exports = { index };
