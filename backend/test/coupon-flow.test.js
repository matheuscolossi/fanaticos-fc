require('./testEnv');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

test('preview do carrinho envia a protecao CSRF exigida para clientes autenticados', async () => {
  let request;
  const source = fs.readFileSync(
    path.join(__dirname, '../../frontend/scripts/api.js'),
    'utf8'
  );
  const context = {
    URL,
    document: {
      addEventListener() {},
      documentElement: { setAttribute() {} },
      getElementById() { return null; },
    },
    fetch: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, json: async () => ({ total: 90 }) };
    },
    localStorage: {
      getItem() { return null; },
      removeItem() {},
      setItem() {},
    },
    window: {
      FANATICOS_API_BASE: '/api',
      location: {
        hostname: 'loja.example.test',
        origin: 'https://loja.example.test',
        protocol: 'https:',
      },
    },
  };

  vm.createContext(context);
  vm.runInContext(source, context);
  await vm.runInContext("fetchCartSummary([{ productId: 1, qty: 1 }], 'OFF10', 'RS')", context);

  assert.equal(request.url, '/cart');
  assert.equal(request.options.credentials, 'include');
  assert.equal(request.options.headers['X-CSRF-Protection'], '1');
});

test('preview do carrinho repassa o cliente autenticado para validar cupons restritos', async (t) => {
  const cartService = require('../src/services/cartService');
  let received;
  t.mock.method(cartService, 'buildCartSummary', async (payload) => {
    received = payload;
    return { total: 90, discount: 10 };
  });

  const controllerPath = require.resolve('../src/controllers/cartController');
  delete require.cache[controllerPath];
  const controller = require(controllerPath);
  const response = { json(payload) { this.payload = payload; } };

  await controller.summary({
    body: { items: [{ productId: 1, qty: 1 }], cupomCode: 'CLIENTE10', uf: 'RS' },
    user: { id: 42 },
  }, response);

  assert.equal(received.usuarioId, 42);
  assert.equal(received.cupomCode, 'CLIENTE10');
  assert.deepEqual(response.payload, { total: 90, discount: 10 });
  delete require.cache[controllerPath];
});
