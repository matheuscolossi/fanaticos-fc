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

test('receita considera Stripe live legado e WhatsApp com pagamento confirmado', () => {
  assert.equal(isConfirmedLivePayment({ payment_status: 'paid', stripe_session_id: 'cs_live_123' }), true);
  assert.equal(isConfirmedLivePayment({ payment_status: 'paid', stripe_session_id: 'cs_test_123' }), false);
  assert.equal(isConfirmedLivePayment({ payment_status: 'unpaid', stripe_session_id: 'cs_live_123' }), false);
  assert.equal(isConfirmedLivePayment({ payment_status: 'paid', metodo_pagamento: 'whatsapp' }), true);
  assert.equal(isConfirmedLivePayment({ payment_status: 'unpaid', metodo_pagamento: 'whatsapp' }), false);
});

test('administrador pode confirmar o pagamento combinado pelo WhatsApp', () => {
  assert.equal(
    validateOrderUpdate('aguardando_pagamento', { status: 'pago' }).status,
    'pago'
  );
});

test('configuracao publica anuncia somente o checkout pelo WhatsApp', () => {
  const previousNumber = process.env.WHATSAPP_NUMBER;
  process.env.WHATSAPP_NUMBER = '+55 (54) 99113-8217';
  let payload;
  try {
    configController.getConfig({}, { json(value) { payload = value; } });
  } finally {
    if (previousNumber === undefined) delete process.env.WHATSAPP_NUMBER;
    else process.env.WHATSAPP_NUMBER = previousNumber;
  }
  assert.deepEqual(payload, {
    paymentMethod: 'whatsapp',
    whatsappNumber: '5554991138217',
  });
});

test('pedido de teste nao pode avancar para separacao em producao', () => {
  assert.throws(
    () => assertOrderCanEnterFulfillment({
      payment_status: 'paid',
      stripe_session_id: 'cs_test_example',
    }, 'em_separacao', { production: true }),
    (error) => error.code === 'ORDER_PAYMENT_REQUIRED'
  );
  assert.doesNotThrow(
    () => assertOrderCanEnterFulfillment({
      payment_status: 'paid',
      stripe_session_id: 'cs_live_example',
    }, 'em_separacao', { production: true })
  );
  assert.doesNotThrow(
    () => assertOrderCanEnterFulfillment({
      payment_status: 'paid',
      metodo_pagamento: 'whatsapp',
    }, 'em_separacao', { production: true })
  );
});
