require('./testEnv');

const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { readFileSync } = require('node:fs');
const { after, before, test } = require('node:test');
const express = require('express');
const { buildHttpSecurityHeaders, HSTS } = require('../src/middleware/httpSecurity');
const { configureRequestBodyParsers } = require('../src/middleware/requestBody');
const { errorHandler } = require('../src/utils/http');

function responseMock() {
  const headers = new Map();
  return {
    headers,
    set(nameOrHeaders, value) {
      if (typeof nameOrHeaders === 'string') {
        headers.set(nameOrHeaders.toLowerCase(), value);
      } else {
        for (const [name, headerValue] of Object.entries(nameOrHeaders)) {
          headers.set(name.toLowerCase(), headerValue);
        }
      }
      return this;
    },
  };
}

function request(server, { body, path: requestPath }) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: server.address().port,
      path: requestPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => resolve({ body: JSON.parse(responseBody), status: res.statusCode }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

let server;

before(() => {
  const app = express();
  configureRequestBodyParsers(app);
  app.post('/normal', (req, res) => res.json({ length: req.body.data.length }));
  app.post('/api/produtos', (req, res) => res.json({ length: req.body.data.length }));
  app.post('/api/pagamentos/stripe/webhook', (req, res) => res.json({ length: req.body.length }));
  app.use(errorHandler);
  server = app.listen(0, '127.0.0.1');
});

after(() => new Promise((resolve) => server.close(resolve)));

test('backend envia CSP, anti-frame, MIME, referrer e HSTS em produção', () => {
  const middleware = buildHttpSecurityHeaders({ production: true });
  const res = responseMock();
  let nextCalled = false;
  middleware({ path: '/api/produtos', secure: false }, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.match(res.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(res.headers.get('strict-transport-security'), HSTS);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
  assert.match(res.headers.get('permissions-policy'), /camera=\(\)/);
});

test('Swagger recebe CSP própria sem permitir enquadramento', () => {
  const middleware = buildHttpSecurityHeaders({ production: false });
  const res = responseMock();
  middleware({ path: '/docs', secure: false }, res, () => {});

  assert.match(res.headers.get('content-security-policy'), /script-src 'self' 'unsafe-inline'/);
  assert.match(res.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(res.headers.has('strict-transport-security'), false);
});

test('JSON comum acima de 100 KB recebe 413 com código explícito', async () => {
  const body = JSON.stringify({ data: 'a'.repeat(110 * 1024) });
  const response = await request(server, { body, path: '/normal' });

  assert.equal(response.status, 413);
  assert.equal(response.body.code, 'PAYLOAD_TOO_LARGE');
});

test('somente rota de produto aceita payload de imagem acima do limite global', async () => {
  const body = JSON.stringify({ data: 'a'.repeat(110 * 1024) });
  const response = await request(server, { body, path: '/api/produtos' });

  assert.equal(response.status, 200);
  assert.equal(response.body.length, 110 * 1024);
});

test('rota de produto também rejeita corpo acima do seu limite de 8 MB', async () => {
  const body = JSON.stringify({ data: 'a'.repeat(8 * 1024 * 1024) });
  const response = await request(server, { body, path: '/api/produtos' });

  assert.equal(response.status, 413);
  assert.equal(response.body.code, 'PAYLOAD_TOO_LARGE');
});

test('webhook Stripe preserva corpo bruto e aplica limite próprio de 1 MB', async () => {
  const acceptedBody = JSON.stringify({ data: 'a'.repeat(100 * 1024) });
  const accepted = await request(server, {
    body: acceptedBody,
    path: '/api/pagamentos/stripe/webhook',
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.length, Buffer.byteLength(acceptedBody));

  const excessiveBody = JSON.stringify({ data: 'a'.repeat(1024 * 1024) });
  const excessive = await request(server, {
    body: excessiveBody,
    path: '/api/pagamentos/stripe/webhook',
  });
  assert.equal(excessive.status, 413);
  assert.equal(excessive.body.code, 'PAYLOAD_TOO_LARGE');
});

test('Vercel publica a política HTTP defensiva no frontend', () => {
  const vercelConfig = JSON.parse(readFileSync(
    path.resolve(__dirname, '../../frontend/vercel.json'),
    'utf8'
  ));
  const headers = Object.fromEntries(vercelConfig.headers[0].headers.map(({ key, value }) => [key, value]));

  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.equal(headers['Strict-Transport-Security'], HSTS);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
});
