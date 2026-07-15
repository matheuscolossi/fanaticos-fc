require('./testEnv');

const assert = require('node:assert/strict');
const { test } = require('node:test');
const openapiSpec = require('../src/docs/openapi');
const { buildCommercialOpenapiSpec, loadAcademicApiConfig } = require('../src/config/academicApi');
const buildSpecRoutes = require('../src/routes/specRoutes');

function pass(req, res, next) { next(); }

function findRoute(router, path, method) {
  return router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
}

function buildRouter(academicApi) {
  return buildSpecRoutes({
    academicApi,
    cartRateLimit: pass,
    isDbReady: () => true,
    optionalAuthMiddleware: pass,
  });
}

test('mutações acadêmicas não são registradas por padrão', () => {
  const config = loadAcademicApiConfig({});
  const router = buildRouter(config);

  assert.equal(config.enabled, false);
  assert.equal(findRoute(router, '/products', 'post'), undefined);
  assert.equal(findRoute(router, '/product/:id', 'delete'), undefined);
  assert.ok(findRoute(router, '/product/:id', 'get'));
  assert.ok(findRoute(router, '/search', 'get'));
  assert.ok(findRoute(router, '/cart', 'post'));
});

test('produção exige host acadêmico separado do host comercial', () => {
  assert.throws(
    () => loadAcademicApiConfig({ ENABLE_ACADEMIC_API: 'true', NODE_ENV: 'production' }),
    (error) => error.code === 'ACADEMIC_API_CONFIGURATION_INVALID'
  );
  assert.throws(
    () => loadAcademicApiConfig({
      ENABLE_ACADEMIC_API: 'true',
      ACADEMIC_API_HOST: 'api.example.test',
      COMMERCIAL_API_HOST: 'api.example.test',
      NODE_ENV: 'production',
    }),
    (error) => error.code === 'ACADEMIC_API_CONFIGURATION_INVALID'
  );

  const config = loadAcademicApiConfig({
    ENABLE_ACADEMIC_API: 'true',
    ACADEMIC_API_HOST: 'academic-api.example.test',
    COMMERCIAL_API_HOST: 'api.example.test',
    NODE_ENV: 'production',
  });
  assert.deepEqual(config, { enabled: true, host: 'academic-api.example.test' });
});

test('documentação comercial não publica mutações nem Basic Auth acadêmicos', () => {
  const commercialSpec = buildCommercialOpenapiSpec(openapiSpec);

  assert.equal(commercialSpec.paths['/products'], undefined);
  assert.equal(commercialSpec.paths['/product/{id}'].delete, undefined);
  assert.ok(commercialSpec.paths['/product/{id}'].get);
  assert.equal(commercialSpec.components.securitySchemes.basicAuth, undefined);
});

test('host comercial recebe 404 antes de autenticação ou mutação', () => {
  const hostOnly = buildSpecRoutes.academicHostOnly('academic-api.example.test');
  let nextCalled = false;
  const response = {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  hostOnly({ get: () => 'shop.example.test' }, response, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 404);
  assert.equal(response.payload.code, 'ROUTE_NOT_FOUND');
});

test('host acadêmico habilita Basic Auth, rate limit e identidade de auditoria', () => {
  const calls = [];
  const basicAuthMiddleware = (req, res, next) => { calls.push('basic'); next(); };
  const rateLimit = (req, res, next) => { calls.push('rate'); next(); };
  const router = buildRouter({
    enabled: true,
    host: 'academic-api.example.test',
    basicAuthMiddleware,
    rateLimit,
  });
  const route = findRoute(router, '/products', 'post');
  const handles = route.route.stack.map((layer) => layer.handle);

  assert.equal(handles[1], rateLimit);
  assert.equal(handles[2], basicAuthMiddleware);
  const req = {};
  handles[3](req, {}, () => { calls.push('audit'); });
  assert.deepEqual(req.staffUser, { id: null, nome: 'API acadêmica isolada' });
  assert.deepEqual(calls, ['audit']);
});
