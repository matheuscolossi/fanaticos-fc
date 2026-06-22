const { buildCartSummary } = require('../services/cartService');

async function summary(req, res) {
  const { items, cupomCode } = req.body;
  res.json(await buildCartSummary({ items, cupomCode }));
}

module.exports = {
  summary,
};
