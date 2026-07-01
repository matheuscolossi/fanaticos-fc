const Stripe = require('stripe');
const couponService = require('./couponService');
const cartService = require('./cartService');
const orderService = require('./orderService');
const { createHttpError } = require('../utils/http');

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecret) {
  console.warn('[stripeService] STRIPE_SECRET_KEY não configurado. Rotas Stripe ficarão indisponíveis.');
}

const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: '2024-08-01' }) : null;

function normalizeCartItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map(i => ({
    productId: Number(i.productId ?? i.id),
    qty: Number(i.qty ?? 0),
  }));
}

async function createCheckoutSession({ items, customer, cupomCodigo, uf, userId, successUrl, cancelUrl }) {
  if (!stripe) throw createHttpError(500, 'Stripe não está configurado.', 'STRIPE_NOT_CONFIGURED');

  const normalizedItems = normalizeCartItems(items);
  if (!normalizedItems.length) {
    throw createHttpError(400, 'Informe ao menos um item no carrinho.', 'CART_ITEMS_REQUIRED');
  }

  const summary = await cartService.buildCartSummary({ items: normalizedItems, cupomCode: cupomCodigo, usuarioId: userId, uf });
  if (summary.total <= 0) {
    throw createHttpError(400, 'O valor do pedido deve ser maior que zero para pagamento com Stripe.', 'INVALID_ORDER_TOTAL');
  }

  const lineItems = summary.items.map((item) => ({
    price_data: {
      currency: 'brl',
      product_data: {
        name: item.name,
      },
      unit_amount: Math.round(Number(item.price) * 100),
    },
    quantity: item.qty,
  }));

  if (summary.freight > 0) {
    lineItems.push({
      price_data: {
        currency: 'brl',
        product_data: { name: 'Frete' },
        unit_amount: Math.round(summary.freight * 100),
      },
      quantity: 1,
    });
  }

  const sessionParams = {
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      user_id: userId ? String(userId) : 'null',
      customer_name: customer?.name || '',
      customer_email: customer?.email || '',
      customer_phone: customer?.phone || '',
      address: customer?.address || '',
      cupom_codigo: cupomCodigo || '',
      uf: uf || '',
      items: JSON.stringify(normalizedItems),
    },
  };

  if (customer?.email) {
    sessionParams.customer_email = customer.email;
  }

  if (cupomCodigo && summary.discount > 0) {
    const stripeCoupon = await stripe.coupons.create({
      amount_off: Math.round(summary.discount * 100),
      currency: 'brl',
      duration: 'once',
      name: `Cupom ${cupomCodigo}`,
    });
    sessionParams.discounts = [{ coupon: stripeCoupon.id }];
  }

  return stripe.checkout.sessions.create(sessionParams);
}

async function createOrderFromCheckoutSession(session) {
  if (!session || session.payment_status !== 'paid') {
    throw createHttpError(400, 'Sessão Stripe inválida ou não paga.', 'STRIPE_SESSION_INVALID');
  }

  const metadata = session.metadata || {}; // Stripe metadata volta como objeto com strings
  let items = [];
  try {
    items = JSON.parse(metadata.items || '[]');
  } catch (err) {
    throw createHttpError(400, 'Falha ao ler os itens do pedido Stripe.', 'STRIPE_METADATA_INVALID');
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw createHttpError(400, 'Itens do pedido Stripe inválidos.', 'STRIPE_METADATA_INVALID');
  }

  const total = Number(session.amount_total || 0) / 100;
  const cupomDesconto = Number(session.total_details?.amount_discount || 0) / 100;

  return orderService.createPaidOrderFromStripe({
    itens: items.map((item) => ({ productId: Number(item.productId), qty: Number(item.qty) })),
    total,
    usuario_id: metadata.user_id && metadata.user_id !== 'null' ? Number(metadata.user_id) : null,
    nome_cliente: metadata.customer_name || null,
    email_cliente: metadata.customer_email || null,
    telefone_cliente: metadata.customer_phone || null,
    endereco: metadata.address || null,
    metodo_pagamento: 'stripe',
    cupom_codigo: metadata.cupom_codigo || null,
    cupom_desconto: cupomDesconto,
  });
}

async function handleWebhook(rawBody, signatureHeader) {
  if (!stripe) throw createHttpError(500, 'Stripe não está configurado.', 'STRIPE_NOT_CONFIGURED');
  if (!stripeWebhookSecret) throw createHttpError(500, 'Stripe webhook secret não está configurada.', 'STRIPE_WEBHOOK_NOT_CONFIGURED');

  const event = stripe.webhooks.constructEvent(rawBody, signatureHeader, stripeWebhookSecret);
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    await createOrderFromCheckoutSession(session);
  }

  return event;
}

module.exports = {
  createCheckoutSession,
  handleWebhook,
};
