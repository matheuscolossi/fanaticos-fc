const express = require('express');

const BODY_LIMITS = Object.freeze({
  defaultJson: '100kb',
  productWithImages: '8mb',
  categoryWithImage: '3mb',
  // O envelope JSON acrescenta bytes ao texto; o serviço limita o CSV a 2 MB.
  productCsvImport: '3mb',
  stripeWebhook: '1mb',
});

function configureRequestBodyParsers(app) {
  const productWithImages = express.json({ limit: BODY_LIMITS.productWithImages });
  const categoryWithImage = express.json({ limit: BODY_LIMITS.categoryWithImage });
  const productCsvImport = express.json({ limit: BODY_LIMITS.productCsvImport });
  const stripeWebhook = express.raw({
    limit: BODY_LIMITS.stripeWebhook,
    type: 'application/json',
  });

  // Exceções limitadas às operações que realmente recebem base64 ou CSV.
  app.post('/api/produtos', productWithImages);
  app.put('/api/produtos/:id', productWithImages);
  app.post('/api/categorias', categoryWithImage);
  app.put('/api/categorias/:id', categoryWithImage);
  app.post('/api/produtos/import', productCsvImport);

  // O Stripe exige os bytes originais para validar a assinatura do webhook.
  app.use('/api/pagamentos/stripe/webhook', stripeWebhook);
  app.use('/api/pagamentos/webhook', stripeWebhook);
  app.use('/api/payments/stripe/webhook', stripeWebhook);
  app.use('/api/payments/webhook', stripeWebhook);

  app.use(express.json({ limit: BODY_LIMITS.defaultJson }));
}

module.exports = { BODY_LIMITS, configureRequestBodyParsers };
