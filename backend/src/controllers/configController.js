function getConfig(req, res) {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
  const liveMode = publishableKey.startsWith('pk_live_');
  const production = process.env.NODE_ENV === 'production';
  res.json({
    stripePublishableKey: production && !liveMode ? '' : publishableKey,
    paymentsEnabled: Boolean(publishableKey) && (!production || liveMode),
    paymentMode: liveMode ? 'live' : 'test',
  });
}

module.exports = {
  getConfig,
};
