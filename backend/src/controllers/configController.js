function getConfig(req, res) {
  const configuredNumber = String(process.env.WHATSAPP_NUMBER || '5554991138217').replace(/\D/g, '');
  res.json({
    paymentMethod: 'whatsapp',
    whatsappNumber: configuredNumber,
  });
}

module.exports = {
  getConfig,
};
