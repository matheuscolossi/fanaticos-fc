const { sendCreated } = require('../utils/http');
const stripeService = require('../services/stripeService');

async function createStripeSession(req, res) {
  const {
    itens,
    nome_cliente,
    email_cliente,
    telefone_cliente,
    endereco,
    uf,
    cupom_codigo,
  } = req.body;

  const clientBaseUrl = process.env.CLIENT_BASE_URL || process.env.FRONTEND_URL || 'https://fanaticosmantos.com.br';
  const successUrl = `${clientBaseUrl}/carrinho?checkout=success`;
  const cancelUrl = `${clientBaseUrl}/carrinho?checkout=cancel`;

  const session = await stripeService.createCheckoutSession({
    items: itens,
    customer: {
      name: nome_cliente,
      email: email_cliente,
      phone: telefone_cliente,
      address: endereco,
    },
    cupomCodigo: cupom_codigo,
    uf,
    userId: req.user?.id,
    successUrl,
    cancelUrl,
  });

  sendCreated(res, { sessionId: session.id, url: session.url });
}

async function stripeWebhook(req, res) {
  try {
    await stripeService.handleWebhook(req.body, req.headers['stripe-signature']);
    res.json({ received: true });
  } catch (err) {
    console.error('[stripe:webhook:error]', err.message || err);
    res.status(400).send(`Webhook error: ${err.message || 'Invalid payload'}`);
  }
}

module.exports = {
  createStripeSession,
  stripeWebhook,
};
