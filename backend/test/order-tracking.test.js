require('./testEnv');

process.env.DATABASE_URL = '';
process.env.DB_REQUIRE_POSTGRES = '';
process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const database = require('../src/config/database');
const ordersController = require('../src/controllers/ordersController');
const orderModel = require('../src/models/orderModel');
const buildOrderRoutes = require('../src/routes/orderRoutes');
const { getTrackingForUser } = require('../src/services/orderService');

const ownerEmail = 'tracking-owner@test.local';
const strangerEmail = 'tracking-stranger@test.local';
let owner;
let stranger;
let orderId;

before(async () => {
  await database.init();
  await database.run('DELETE FROM logs_acoes WHERE usuario_nome IN (?, ?)', ['Tracking Owner', 'Tracking Stranger']);
  await database.run('DELETE FROM pedidos WHERE email_cliente IN (?, ?)', [ownerEmail, strangerEmail]);
  await database.run('DELETE FROM usuarios WHERE email IN (?, ?)', [ownerEmail, strangerEmail]);

  const ownerResult = await database.run(
    'INSERT INTO usuarios (nome, email, senha, email_verificado) VALUES (?, ?, ?, ?)',
    ['Tracking Owner', ownerEmail, 'hash-only-for-test', 1]
  );
  const strangerResult = await database.run(
    'INSERT INTO usuarios (nome, email, senha, email_verificado) VALUES (?, ?, ?, ?)',
    ['Tracking Stranger', strangerEmail, 'hash-only-for-test', 1]
  );
  owner = { id: ownerResult.lastID, nome: 'Tracking Owner', email: ownerEmail };
  stranger = { id: strangerResult.lastID, nome: 'Tracking Stranger', email: strangerEmail };

  const orderResult = await orderModel.create({
    usuario_id: owner.id,
    itens: '[]',
    total: 199.9,
    nome_cliente: 'Nome que não deve sair no rastreamento',
    email_cliente: ownerEmail,
    telefone_cliente: '11999999999',
    endereco: 'Endereço privado',
    metodo_pagamento: 'stripe',
    status: 'enviado',
  });
  orderId = orderResult.lastID;
  await orderModel.updateTracking(orderId, { codigo_rastreio: 'TRACK-TEST-123' });
});

after(async () => {
  await database.run('DELETE FROM logs_acoes WHERE usuario_id IN (?, ?)', [owner.id, stranger.id]);
  await database.run('DELETE FROM pedidos WHERE id = ?', [orderId]);
  await database.run('DELETE FROM usuarios WHERE id IN (?, ?)', [owner.id, stranger.id]);
  await database.close();
});

test('permite rastrear somente o pedido da própria conta e reduz a resposta', async () => {
  const tracking = await getTrackingForUser(String(orderId), owner);
  assert.deepEqual(Object.keys(tracking).sort(), ['codigo_rastreio', 'created_at', 'id', 'status']);
  assert.equal(tracking.id, orderId);
  assert.equal(tracking.status, 'enviado');
  assert.equal(tracking.codigo_rastreio, 'TRACK-TEST-123');
  assert.equal('nome_cliente' in tracking, false);
  assert.equal('total' in tracking, false);
});

test('protege a rota de rastreamento com autenticação', () => {
  const authMiddleware = (req, res, next) => next();
  const trackingRateLimit = (req, res, next) => next();
  const router = buildOrderRoutes({
    authMiddleware,
    perm: () => (req, res, next) => next(),
    trackingRateLimit,
  });
  const trackingRoute = router.stack.find((layer) => layer.route?.path === '/:id/rastreio');
  assert.ok(trackingRoute);
  assert.equal(trackingRoute.route.stack[0].handle, authMiddleware);
  assert.equal(trackingRoute.route.stack[1].handle, trackingRateLimit);
});

test('pedido de terceiro e ID inexistente retornam o mesmo erro', async () => {
  const assertNotFound = (error) => {
    assert.equal(error.statusCode, 404);
    assert.equal(error.code, 'ORDER_TRACKING_NOT_FOUND');
    assert.equal(error.message, 'Pedido não encontrado para esta conta.');
    return true;
  };

  await assert.rejects(() => getTrackingForUser(String(orderId), stranger), assertNotFound);
  await assert.rejects(() => getTrackingForUser('999999999', stranger), assertNotFound);
});

test('registra tentativa autenticada de consultar pedido de terceiro', async () => {
  await assert.rejects(
    () => ordersController.tracking(
      { params: { id: String(orderId) }, user: stranger, ip: '127.0.0.1' },
      { json() { throw new Error('A resposta não deveria ser enviada.'); } }
    ),
    (error) => error.code === 'ORDER_TRACKING_NOT_FOUND'
  );

  const log = await database.get(
    'SELECT acao, detalhes FROM logs_acoes WHERE usuario_id = ? ORDER BY id DESC LIMIT 1',
    [stranger.id]
  );
  assert.equal(log.acao, 'Tentativa de rastreamento negada');
  assert.match(log.detalhes, new RegExp(`Pedido solicitado: ${orderId}`));
});
