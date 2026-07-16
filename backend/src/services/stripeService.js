const crypto = require('crypto');
const Stripe = require('stripe');
const cartService = require('./cartService');
const orderModel = require('../models/orderModel');
const orderService = require('./orderService');
const paymentModel = require('../models/paymentModel');
const userModel = require('../models/userModel');
const { transaction } = require('../config/database');
const { createHttpError } = require('../utils/http');

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;
const CHECKOUT_RESERVATION_MINUTES = Math.min(
  Math.max(Number(process.env.CHECKOUT_RESERVATION_MINUTES) || 30, 30),
  24 * 60
);

if (!stripeSecret) {
  console.warn('[stripeService] STRIPE_SECRET_KEY não configurado.');
}

function cleanText(value, maxLength = 120) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizePersonalization(value) {
  if (!value || typeof value !== 'object') return null;
  const nome = cleanText(value.nome, 30);
  const numero = cleanText(value.numero, 10);
  return nome || numero ? { nome, numero } : null;
}

function normalizeCartItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    productId: Number(item?.productId ?? item?.id),
    qty: Number(item?.qty),
    tamanho: cleanText(item?.tamanho, 50) || null,
    personalizacao: normalizePersonalization(item?.personalizacao),
  }));
}

function getFrontendBaseUrl() {
  return (process.env.FRONTEND_URL || process.env.CLIENT_BASE_URL || 'http://localhost:5500').replace(/\/$/, '');
}

function formatShippingAddress(shippingDetails) {
  const address = shippingDetails?.address || {};
  return [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postal_code,
    address.country,
  ].filter(Boolean).join(' — ');
}

function getShippingSnapshot(session) {
  const shipping = session.shipping_details || null;
  const address = shipping?.address || session.customer_details?.address || {};
  return {
    formatted: formatShippingAddress(shipping || { address }),
    raw: {
      name: shipping?.name || session.customer_details?.name || null,
      address,
    },
  };
}

function buildLineItem(item) {
  const details = [
    item.tamanho ? `Tamanho: ${item.tamanho}` : '',
    item.personalizacao?.nome ? `Nome: ${item.personalizacao.nome}` : '',
    item.personalizacao?.numero ? `Número: ${item.personalizacao.numero}` : '',
  ].filter(Boolean).join(' · ');

  return {
    price_data: {
      currency: 'brl',
      product_data: {
        name: cleanText(item.name, 250),
        ...(details ? { description: details } : {}),
      },
      unit_amount: cartService.moneyToCents(item.price),
    },
    quantity: item.qty,
  };
}

function buildCheckoutPricing(summary) {
  const lineItems = summary.items.map(buildLineItem);
  const itemsTotalCents = lineItems.reduce(
    (sum, item) => sum + item.price_data.unit_amount * item.quantity,
    0
  );
  const freightCents = cartService.moneyToCents(summary.freight || 0);
  const promotionDiscountCents = cartService.moneyToCents(summary.promocoesDesconto || 0);
  const couponDiscountCents = cartService.moneyToCents(summary.discount || 0);
  const totalDiscountCents = promotionDiscountCents + couponDiscountCents;
  const totalCents = itemsTotalCents + freightCents - totalDiscountCents;

  if (totalDiscountCents < 0 || totalCents !== cartService.moneyToCents(summary.total)) {
    throw createHttpError(
      500,
      'O detalhamento do checkout não corresponde ao total calculado.',
      'CHECKOUT_TOTAL_INCONSISTENT'
    );
  }

  if (freightCents > 0) {
    lineItems.push({
      price_data: {
        currency: 'brl',
        product_data: { name: 'Frete' },
        unit_amount: freightCents,
      },
      quantity: 1,
    });
  }

  return { lineItems, totalCents, totalDiscountCents };
}

async function createStripeSession(sessionParams, pricing, summary, cupomCodigo, checkoutId) {
  if (pricing.totalDiscountCents > 0) {
    const hasPromotionDiscount = Number(summary.promocoesDesconto) > 0;
    const hasCouponDiscount = Number(summary.discount) > 0;
    const discountName = hasPromotionDiscount && hasCouponDiscount
      ? `Promoções + cupom ${cleanText(cupomCodigo, 40)}`
      : hasCouponDiscount
        ? `Cupom ${cleanText(cupomCodigo, 40)}`
        : 'Descontos promocionais';
    const stripeCoupon = await stripe.coupons.create({
      amount_off: pricing.totalDiscountCents,
      currency: 'brl',
      duration: 'once',
      name: discountName,
    }, { idempotencyKey: `checkout-coupon:${checkoutId}` });
    sessionParams.discounts = [{ coupon: stripeCoupon.id }];
  }

  return stripe.checkout.sessions.create(sessionParams, {
    idempotencyKey: `checkout-session:${checkoutId}`,
  });
}

async function releaseCheckoutAfterStripeFailure(checkoutId, session) {
  let canRelease = !session?.id;
  if (session?.id) {
    try {
      await stripe.checkout.sessions.expire(session.id);
      canRelease = true;
    } catch (error) {
      console.error('[stripe] Sessão criada não pôde ser expirada; reserva mantida.', {
        checkoutId,
        sessionId: session.id,
      });
    }
  }
  if (canRelease) {
    await paymentModel.releaseDraftStock(checkoutId, 'checkout_failed');
  }
}

async function createCheckoutSession({ items, customer, cupomCodigo, uf, userId }) {
  if (!stripe) throw createHttpError(500, 'Stripe não está configurado.', 'STRIPE_NOT_CONFIGURED');
  if (!Number.isInteger(Number(userId)) || Number(userId) < 1) {
    throw createHttpError(401, 'Faça login para finalizar a compra.', 'AUTH_REQUIRED');
  }
  const checkoutUser = await userModel.findById(Number(userId));
  if (!checkoutUser) {
    throw createHttpError(401, 'Faça login para finalizar a compra.', 'AUTH_REQUIRED');
  }
  if (checkoutUser.status === 'inativo') {
    throw createHttpError(403, 'Seu acesso foi desativado.', 'ACCESS_DISABLED');
  }
  if (!checkoutUser.email_verificado) {
    throw createHttpError(403, 'Confirme seu e-mail antes de finalizar a compra.', 'EMAIL_NOT_VERIFIED');
  }

  const normalizedItems = normalizeCartItems(items);
  if (!normalizedItems.length) {
    throw createHttpError(400, 'Informe ao menos um item no carrinho.', 'CART_ITEMS_REQUIRED');
  }

  const summary = await cartService.buildCartSummary({
    items: normalizedItems,
    cupomCode: cupomCodigo,
    usuarioId: userId,
    uf,
  });
  if (cupomCodigo && summary.cupomErro) {
    throw createHttpError(400, summary.cupomErro, 'COUPON_INVALID');
  }
  if (summary.total <= 0) {
    throw createHttpError(400, 'O valor do pedido deve ser maior que zero.', 'INVALID_ORDER_TOTAL');
  }

  const pricing = buildCheckoutPricing(summary);

  const checkoutId = crypto.randomUUID();
  const expiresAtUnix = Math.floor(Date.now() / 1000) + CHECKOUT_RESERVATION_MINUTES * 60;
  await paymentModel.createReservedCheckoutDraft({
    id: checkoutId,
    usuario_id: Number(userId),
    itens: summary.items,
    subtotal: summary.subtotal,
    frete: summary.freight,
    desconto: Number(summary.discount || 0),
    total: summary.total,
    currency: 'BRL',
    nome_cliente: cleanText(customer?.name, 120),
    email_cliente: cleanText(customer?.email, 180),
    telefone_cliente: cleanText(customer?.phone, 40),
    endereco: cleanText(customer?.address, 300),
    uf: cleanText(uf, 2).toUpperCase(),
    cupom_codigo: cleanText(cupomCodigo, 50),
  }, new Date(expiresAtUnix * 1000).toISOString());

  const sessionParams = {
    mode: 'payment',
    line_items: pricing.lineItems,
    success_url: `${getFrontendBaseUrl()}/pages/pagamento-sucesso.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getFrontendBaseUrl()}/pages/pagamento-cancelado.html?session_id={CHECKOUT_SESSION_ID}`,
    client_reference_id: checkoutId,
    customer_creation: 'always',
    ...(customer?.email ? { customer_email: cleanText(customer.email, 180) } : {}),
    // O Checkout hospedado exibe os métodos habilitados na conta. Mantemos
    // somente cartão e Pix; ambos são confirmados pelo webhook Stripe.
    payment_method_types: ['card', 'pix'],
    shipping_address_collection: { allowed_countries: ['BR'] },
    phone_number_collection: { enabled: true },
    billing_address_collection: 'required',
    expires_at: expiresAtUnix,
    metadata: {
      checkout_id: checkoutId,
      user_id: String(userId),
    },
  };

  let session;
  try {
    session = await createStripeSession(sessionParams, pricing, summary, cupomCodigo, checkoutId);
    await paymentModel.attachStripeSession(checkoutId, session.id);
    return session;
  } catch (error) {
    await releaseCheckoutAfterStripeFailure(checkoutId, session).catch((releaseError) => {
      console.error('[stripe] Falha ao liberar reserva após erro no Checkout.', { checkoutId });
    });
    throw error;
  }
}

async function fulfillCheckoutSession(session, eventId, db) {
  const checkoutId = session?.metadata?.checkout_id || session?.client_reference_id;
  if (!checkoutId) {
    throw createHttpError(400, 'Checkout sem identificador interno.', 'STRIPE_CHECKOUT_ID_MISSING');
  }

  const draft = await paymentModel.findDraftById(checkoutId, db);
  if (!draft) throw createHttpError(404, 'Checkout interno não encontrado.', 'CHECKOUT_DRAFT_NOT_FOUND');

  const existingOrder = await orderModel.findByStripeSession(session.id, db);
  if (existingOrder) {
    await paymentModel.updateDraftStatus(draft.id, 'paid', db);
    return existingOrder;
  }

  const stripeTotalCents = Number(session.amount_total);
  const draftTotalCents = cartService.moneyToCents(draft.total);
  if (!Number.isSafeInteger(stripeTotalCents) || stripeTotalCents !== draftTotalCents) {
    throw createHttpError(400, 'O total confirmado pelo Stripe não corresponde ao checkout.', 'STRIPE_TOTAL_MISMATCH');
  }

  await paymentModel.commitDraftStock(draft.id, db);

  const shippingAddress = getShippingSnapshot(session);
  const order = await orderService.createPaidOrderFromStripe({
    draft,
    session,
    eventId,
    shippingAddress,
  }, db);
  await paymentModel.updateDraftStatus(draft.id, 'paid', db);
  console.log('[stripe] Pedido confirmado pelo webhook', { orderId: order.id, sessionId: session.id });
  return order;
}

async function processWebhookEvent(event) {
  return transaction(async (db) => {
    const alreadyProcessed = await paymentModel.findWebhookEvent(event.id, db);
    if (alreadyProcessed) return { duplicate: true };

    await paymentModel.createWebhookEvent(event.id, event.type, db);
    const object = event.data.object;

    switch (event.type) {
      case 'checkout.session.completed':
        if (object.payment_status === 'paid') {
          await fulfillCheckoutSession(object, event.id, db);
        } else {
          const checkoutId = object.metadata?.checkout_id || object.client_reference_id;
          if (checkoutId) await paymentModel.updateDraftStatus(checkoutId, 'awaiting_payment', db);
        }
        break;
      case 'checkout.session.async_payment_succeeded':
        await fulfillCheckoutSession(object, event.id, db);
        break;
      case 'checkout.session.async_payment_failed': {
        const checkoutId = object.metadata?.checkout_id || object.client_reference_id;
        if (checkoutId) await paymentModel.releaseDraftStock(checkoutId, 'payment_failed', db);
        break;
      }
      case 'checkout.session.expired': {
        const checkoutId = object.metadata?.checkout_id || object.client_reference_id;
        if (checkoutId) await paymentModel.releaseDraftStock(checkoutId, 'expired', db);
        break;
      }
      case 'payment_intent.payment_failed':
        await orderModel.restoreStockByPaymentIntent(object.id, 'failed', 'cancelado', db, {
          eventId: event.id,
          tipo: 'pagamento_falhou',
          motivo: 'Falha de pagamento informada pelo Stripe',
        });
        break;
      case 'charge.refunded': {
        const paymentIntentId = typeof object.payment_intent === 'string'
          ? object.payment_intent
          : object.payment_intent?.id || null;
        if (paymentIntentId) {
          if (object.refunded === true) {
            await orderModel.restoreStockByPaymentIntent(paymentIntentId, 'refunded', 'cancelado', db, {
              eventId: event.id,
              tipo: 'pagamento_reembolsado',
              motivo: 'Reembolso integral informado pelo Stripe',
            });
          } else {
            await orderModel.updatePaymentStatusByPaymentIntent(
              paymentIntentId,
              'partially_refunded',
              null,
              db,
              {
                eventId: event.id,
                tipo: 'pagamento_reembolsado_parcialmente',
                motivo: 'Reembolso parcial informado pelo Stripe',
              }
            );
          }
        }
        break;
      }
      default:
        break;
    }

    return { duplicate: false };
  });
}

async function handleWebhook(rawBody, signatureHeader) {
  if (!stripe) throw createHttpError(500, 'Stripe não está configurado.', 'STRIPE_NOT_CONFIGURED');
  if (!stripeWebhookSecret) throw createHttpError(500, 'STRIPE_WEBHOOK_SECRET não configurado.', 'STRIPE_WEBHOOK_NOT_CONFIGURED');

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signatureHeader, stripeWebhookSecret);
  } catch (error) {
    throw createHttpError(400, 'Assinatura do webhook Stripe inválida.', 'STRIPE_WEBHOOK_SIGNATURE_INVALID');
  }

  return processWebhookEvent(event);
}

async function getCheckoutStatus(sessionId, userId) {
  if (!sessionId || !String(sessionId).startsWith('cs_')) {
    throw createHttpError(400, 'Sessão Stripe inválida.', 'STRIPE_SESSION_INVALID');
  }

  const order = await orderModel.findPaymentStatusForUser(sessionId, userId);
  if (order) {
    return {
      sessionId,
      orderId: order.id,
      status: order.status,
      paymentStatus: order.payment_status,
      total: Number(order.total),
      currency: order.currency || 'BRL',
    };
  }

  const draft = await paymentModel.findDraftBySessionForUser(sessionId, userId);
  if (!draft) throw createHttpError(404, 'Sessão de checkout não encontrada.', 'CHECKOUT_NOT_FOUND');
  return {
    sessionId,
    orderId: null,
    status: draft.status,
    paymentStatus: draft.status === 'paid' ? 'paid' : 'pending',
    total: Number(draft.total),
    currency: draft.currency || 'BRL',
  };
}

module.exports = {
  buildCheckoutPricing,
  createCheckoutSession,
  getCheckoutStatus,
  handleWebhook,
  normalizeCartItems,
  processWebhookEvent,
};
