require('./testEnv');

process.env.DATABASE_URL = '';
process.env.DB_REQUIRE_POSTGRES = '';
process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const database = require('../src/config/database');
const rateLimitModel = require('../src/models/rateLimitModel');
const { createRateLimiter } = require('../src/middleware/rateLimit');
const buildAuthRoutes = require('../src/routes/authRoutes');
const buildOrderRoutes = require('../src/routes/orderRoutes');
const buildPaymentRoutes = require('../src/routes/paymentRoutes');
const buildSpecRoutes = require('../src/routes/specRoutes');

const secret = 'rate-limit-test-secret';

function responseMock() {
  const headers = new Map();
  return {
    headers,
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
  };
}

function invoke(middleware, req) {
  const res = responseMock();
  return new Promise((resolve) => {
    middleware(req, res, (error) => resolve({ error, res }));
  });
}

function pass(req, res, next) { next(); }

before(async () => {
  await database.init();
  await rateLimitModel.clearAll();
});

after(async () => {
  await rateLimitModel.clearAll();
  await database.close();
});

test('limite por IP bloqueia excedentes e devolve headers de retry', async () => {
  const limiter = createRateLimiter({
    secret,
    scope: 'test-ip',
    policies: [{ dimension: 'ip', limit: 2, windowMs: 60_000, key: (req) => req.ip }],
  });
  const req = { ip: '203.0.113.10', body: {}, socket: {} };

  assert.equal((await invoke(limiter, req)).error, undefined);
  assert.equal((await invoke(limiter, req)).error, undefined);
  const blocked = await invoke(limiter, req);

  assert.equal(blocked.error.statusCode, 429);
  assert.equal(blocked.error.code, 'RATE_LIMIT_EXCEEDED');
  assert.equal(blocked.res.headers.get('ratelimit-remaining'), '0');
  assert.ok(Number(blocked.res.headers.get('retry-after')) >= 1);
});

test('limite por conta não pode ser contornado trocando o IP', async () => {
  const limiter = createRateLimiter({
    secret,
    scope: 'test-account',
    policies: [{
      dimension: 'account',
      limit: 2,
      windowMs: 60_000,
      key: (req) => String(req.body.email).trim().toLowerCase(),
    }],
  });

  assert.equal((await invoke(limiter, { ip: '203.0.113.11', body: { email: 'ALVO@example.test' } })).error, undefined);
  assert.equal((await invoke(limiter, { ip: '203.0.113.12', body: { email: 'alvo@example.test' } })).error, undefined);
  const blocked = await invoke(limiter, { ip: '203.0.113.13', body: { email: 'alvo@example.test' } });
  assert.equal(blocked.error.code, 'RATE_LIMIT_EXCEEDED');

  const otherAccount = await invoke(limiter, {
    ip: '203.0.113.13',
    body: { email: 'outra@example.test' },
  });
  assert.equal(otherAccount.error, undefined);
});

test('identificadores são persistidos somente como HMAC', async () => {
  const rows = await database.all(
    `SELECT identifier_hash FROM rate_limits
     WHERE scope IN ('test-ip:ip', 'test-account:account')`
  );
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.match(row.identifier_hash, /^[a-f0-9]{64}$/);
    assert.equal(row.identifier_hash.includes('203.0.113'), false);
    assert.equal(row.identifier_hash.includes('@example.test'), false);
  }
});

test('incremento é atômico sob concorrência e nova janela reinicia o limite', async () => {
  const nowMs = Date.now();
  const attempts = await Promise.all(
    Array.from({ length: 12 }, () => rateLimitModel.consume({
      scope: 'test-concurrency',
      identifierHash: 'concurrent-hash',
      windowMs: 60_000,
      limit: 5,
      nowMs,
    }))
  );
  assert.equal(attempts.filter((result) => result.allowed).length, 5);

  const nextWindow = await rateLimitModel.consume({
    scope: 'test-concurrency',
    identifierHash: 'concurrent-hash',
    windowMs: 60_000,
    limit: 5,
    nowMs: nowMs + 60_000,
  });
  assert.equal(nextWindow.allowed, true);
  assert.equal(nextWindow.count, 1);
});

test('todas as rotas sensíveis aplicam o middleware correspondente', () => {
  const rateLimiters = {
    register: function registerRate(req, res, next) { next(); },
    login: function loginRate(req, res, next) { next(); },
    verifyEmail: function verifyRate(req, res, next) { next(); },
    resendCode: function resendRate(req, res, next) { next(); },
  };
  const authRouter = buildAuthRoutes({ authMiddleware: pass, jwtSecret: secret, rateLimiters });
  const routeMiddleware = (router, path, method = 'post') => router.stack.find(
    (layer) => layer.route?.path === path && layer.route.methods[method]
  ).route.stack.map((layer) => layer.handle);

  assert.equal(routeMiddleware(authRouter, '/register')[0], rateLimiters.register);
  assert.equal(routeMiddleware(authRouter, '/login')[0], rateLimiters.login);
  assert.equal(routeMiddleware(authRouter, '/verificar-email')[0], rateLimiters.verifyEmail);
  assert.equal(routeMiddleware(authRouter, '/reenviar-codigo')[0], rateLimiters.resendCode);

  const trackingRateLimit = function trackingRate(req, res, next) { next(); };
  const orderRouter = buildOrderRoutes({
    authMiddleware: pass,
    perm: () => pass,
    trackingRateLimit,
  });
  assert.equal(routeMiddleware(orderRouter, '/:id/rastreio', 'get')[1], trackingRateLimit);

  const cartRateLimit = function cartRate(req, res, next) { next(); };
  const publicRateLimit = function publicReadRate(req, res, next) { next(); };
  const specRouter = buildSpecRoutes({
    academicApi: { enabled: false },
    cartRateLimit,
    isDbReady: () => true,
    optionalAuthMiddleware: pass,
    publicRateLimit,
  });
  assert.equal(routeMiddleware(specRouter, '/cart')[1], cartRateLimit);
  assert.equal(routeMiddleware(specRouter, '/product/:id', 'get')[0], publicRateLimit);
  assert.equal(routeMiddleware(specRouter, '/search', 'get')[0], publicRateLimit);

  const checkoutRateLimit = function checkoutRate(req, res, next) { next(); };
  const paymentRouter = buildPaymentRoutes({
    authMiddleware: pass,
    checkoutRateLimit,
    verifiedEmailMiddleware: pass,
  });
  assert.equal(routeMiddleware(paymentRouter, '/stripe/create-session')[1], checkoutRateLimit);
  assert.equal(routeMiddleware(paymentRouter, '/create-checkout-session')[1], checkoutRateLimit);
});
