process.env.DATABASE_URL = '';
process.env.DB_REQUIRE_POSTGRES = '';
process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const database = require('../src/config/database');
const orderModel = require('../src/models/orderModel');
const buildUserRoutes = require('../src/routes/userRoutes');
const { deleteClient, listUsers } = require('../src/services/userService');

const clientEmail = 'authorization-client@test.local';
const adminEmail = 'authorization-admin@test.local';
const clientLogAction = 'Teste autorização cliente';
const adminLogAction = 'Teste autorização administrador';
let clientId;
let adminId;
let clientOrderId;
let adminOrderId;

before(async () => {
  await database.init();
  await database.run('DELETE FROM logs_acoes WHERE acao IN (?, ?)', [clientLogAction, adminLogAction]);
  await database.run('DELETE FROM pedidos WHERE email_cliente IN (?, ?)', [clientEmail, adminEmail]);
  await database.run('DELETE FROM usuarios WHERE email IN (?, ?)', [clientEmail, adminEmail]);

  const client = await database.run(
    "INSERT INTO usuarios (nome, email, senha, perfil, email_verificado) VALUES (?, ?, ?, 'cliente', ?)",
    ['Authorization Client', clientEmail, 'hash-only-for-test', 1]
  );
  const admin = await database.run(
    "INSERT INTO usuarios (nome, email, senha, perfil, email_verificado) VALUES (?, ?, ?, 'admin', ?)",
    ['Authorization Admin', adminEmail, 'hash-only-for-test', 1]
  );
  clientId = client.lastID;
  adminId = admin.lastID;

  const clientOrder = await orderModel.create({
    usuario_id: clientId,
    itens: '[]',
    total: 10,
    email_cliente: clientEmail,
    metodo_pagamento: 'stripe',
    status: 'pago',
  });
  const adminOrder = await orderModel.create({
    usuario_id: adminId,
    itens: '[]',
    total: 20,
    email_cliente: adminEmail,
    metodo_pagamento: 'stripe',
    status: 'pago',
  });
  clientOrderId = clientOrder.lastID;
  adminOrderId = adminOrder.lastID;

  await database.run(
    'INSERT INTO logs_acoes (usuario_id, usuario_nome, acao) VALUES (?, ?, ?)',
    [clientId, 'Authorization Client', clientLogAction]
  );
  await database.run(
    'INSERT INTO logs_acoes (usuario_id, usuario_nome, acao) VALUES (?, ?, ?)',
    [adminId, 'Authorization Admin', adminLogAction]
  );
});

after(async () => {
  await database.run('DELETE FROM logs_acoes WHERE acao IN (?, ?)', [clientLogAction, adminLogAction]);
  await database.run('DELETE FROM pedidos WHERE id IN (?, ?)', [clientOrderId, adminOrderId]);
  await database.run('DELETE FROM usuarios WHERE id IN (?, ?)', [clientId, adminId]);
  await database.close();
});

test('clientes.gerenciar lista somente contas de clientes', async () => {
  const users = await listUsers();
  const listedClient = users.find((user) => Number(user.id) === Number(clientId));
  const listedAdmin = users.find((user) => Number(user.id) === Number(adminId));

  assert.ok(listedClient);
  assert.equal(listedAdmin, undefined);
  assert.equal('perfil' in listedClient, false);
});

test('a rota aplica clientes.gerenciar a todas as operações', () => {
  const requestedPermissions = [];
  const permissionMiddleware = (req, res, next) => next();
  const router = buildUserRoutes({
    perm(key) {
      requestedPermissions.push(key);
      return permissionMiddleware;
    },
  });

  assert.deepEqual(requestedPermissions, ['clientes.gerenciar']);
  assert.equal(router.stack[0].handle, permissionMiddleware);
});

test('a rota de clientes não exclui nem altera relações de administrador', async () => {
  await assert.rejects(
    () => deleteClient(String(adminId)),
    (error) => error.statusCode === 404 && error.code === 'CLIENT_NOT_FOUND'
  );

  assert.ok(await database.get("SELECT id FROM usuarios WHERE id = ? AND perfil = 'admin'", [adminId]));
  assert.equal((await database.get('SELECT usuario_id FROM pedidos WHERE id = ?', [adminOrderId])).usuario_id, adminId);
  assert.equal((await database.get('SELECT usuario_id FROM logs_acoes WHERE acao = ?', [adminLogAction])).usuario_id, adminId);
});

test('exclui cliente e preserva o histórico desvinculado em transação', async () => {
  const result = await deleteClient(String(clientId));
  assert.equal(result.message, 'Cliente excluído.');
  assert.equal(await database.get('SELECT id FROM usuarios WHERE id = ?', [clientId]), undefined);
  assert.equal((await database.get('SELECT usuario_id FROM pedidos WHERE id = ?', [clientOrderId])).usuario_id, null);
  assert.equal((await database.get('SELECT usuario_id FROM logs_acoes WHERE acao = ?', [clientLogAction])).usuario_id, null);
});
