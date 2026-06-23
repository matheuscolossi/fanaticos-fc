const { buildCartSummary } = require('../services/cartService');

async function summary(req, res) {
  const { items, cupomCode, uf } = req.body;
  res.json(await buildCartSummary({ items, cupomCode, uf }));
}

module.exports = {
  summary,
};
