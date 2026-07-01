function getConfig(req, res) {
  res.json({
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  });
}

module.exports = {
  getConfig,
};
