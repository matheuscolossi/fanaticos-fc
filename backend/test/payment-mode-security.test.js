require('./testEnv');

const assert = require('node:assert/strict');
const { test } = require('node:test');
const configController = require('../src/controllers/configController');
const { isConfirmedLivePayment } = require('../src/controllers/dashboardController');
const { assertOrderCanEnterFulfillment } = require('../src/services/orderService');
const stripeService = require('../src/services/stripeService');
const { validateOrderUpdate } = require('../src/validation/orderSchemas');

test('producao bloqueia checkout configurado com chave Stripe de teste', () => {
  assert.throws(
    () => stripeService.assertStripeRuntimeMode({ nodeEnv: 'production', secret: 'sk_test_example' }),
    (error) => error.code === 'STRIPE_LIVE_MODE_REQUIRED' && error.statusCode === 503
  );
  assert.doesNotThrow(
    () => stripeService.assertStripeRuntimeMode({ nodeEnv: 'production', secret: 'sk_live_example' })
  );
});

test('producao rejeita webhook de teste mesmo quando ele informa pagamento como pago', () => {
  const testEvent = {
    livemode: false,
    type: 'checkout.session.completed',
    data: { object: { livemode: false, payment_status: 'paid' } },
  };
  assert.throws(
    () => stripeService.assertStripeEventMode(testEvent, {
      nodeEnv: 'production',
      secret: 'sk_live_example',
    }),
    (error) => error.code === 'STRIPE_TEST_EVENT_REJECTED'
  );
});

test('receita considera apenas sessao live com pagamento confirmado', () => {
  assert.equal(isConfirmedLivePayment({ payment_status: 'paid', stripe_session_id: 'cs_live_123' }), true);
  assert.equal(isConfirmedLivePayment({ payment_status: 'paid', stripe_session_id: 'cs_test_123' }), false);
  assert.equal(isConfirmedLivePayment({ payment_status: 'unpaid', stripe_session_id: 'cs_live_123' }), false);
});

test('administrador nao pode declarar manualmente que um pedido foi pago', () => {
  assert.throws(
    () => validateOrderUpdate('aguardando_pagamento', { status: 'pago' }),
    (error) => error.code === 'ORDER_STATUS_TRANSITION_INVALID'
      && error.details?.field === 'status'
  );
});

test('configuracao publica nao entrega chave de teste em producao', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousKey = process.env.STRIPE_PUBLISHABLE_KEY;
  process.env.NODE_ENV = 'production';
  process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_example';
  let payload;
  try {
    configController.getConfig({}, { json(value) { payload = value; } });
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousKey === undefined) delete process.env.STRIPE_PUBLISHABLE_KEY;
    else process.env.STRIPE_PUBLISHABLE_KEY = previousKey;
  }
  assert.equal(payload.stripePublishableKey, '');
  assert.equal(payload.paymentsEnabled, false);
  assert.equal(payload.paymentMode, 'test');
});

test('pedido de teste nao pode avancar para separacao em producao', () => {
  assert.throws(
    () => assertOrderCanEnterFulfillment({
      payment_status: 'paid',
      stripe_session_id: 'cs_test_example',
    }, 'em_separacao', { production: true }),
    (error) => error.code === 'ORDER_LIVE_PAYMENT_REQUIRED'
  );
  assert.doesNotThrow(
    () => assertOrderCanEnterFulfillment({
      payment_status: 'paid',
      stripe_session_id: 'cs_live_example',
    }, 'em_separacao', { production: true })
  );
});
