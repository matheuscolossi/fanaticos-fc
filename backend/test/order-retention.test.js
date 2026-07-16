require('./testEnv');

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const database = require('../src/config/database');
const orderModel = require('../src/models/orderModel');
const orderService = require('../src/services/orderService');

const sessionId = 'cs_order_retention_test';
const stripeEventId = 'evt_order_retention_test';
const actor = { id: 1, nome: 'Administrador Auditor' };
let orderId;
let productId;

async function cleanup() {
  await database.run(
    'DELETE FROM pedido_eventos WHERE pedido_id IN (SELECT id FROM pedidos WHERE stripe_session_id = ?)',
    [sessionId]
  );
  await database.run('DELETE FROM pedido_itens WHERE pedido_id IN (SELECT id FROM pedidos WHERE stripe_session_id = ?)', [sessionId]);
  await database.run('DELETE FROM pedidos WHERE stripe_session_id = ?', [sessionId]);
  await database.run('DELETE FROM produtos WHERE sku = ?', ['order-retention-test']);
}

before(async () => {
  await database.init();
  await cleanup();
  const category = await database.get('SELECT id FROM categorias ORDER BY id LIMIT 1');
  const product = await database.run(
    `INSERT INTO produtos (nome, sku, preco, categoria_id, imagens, estoque, status)
     VALUES (?, ?, ?, ?, JSON_VALUE(?), ?, ?)`,
    ['Produto retenção pedido', 'order-retention-test', 99.9, category.id, '[]', 0, 'ativo']
  );
  productId = product.lastID;
  const order = await orderModel.createPaidFromStripe({
    usuario_id: null,
    itens: [{ productId, name: 'Produto retenção pedido', price: 99.9, qty: 1 }],
    total: 99.9,
    nome_cliente: 'Cliente Histórico',
    email_cliente: 'historico@example.test',
    telefone_cliente: '11999999999',
    stripe_session_id: sessionId,
    stripe_payment_intent_id: 'pi_order_retention_test',
    stripe_customer_id: 'cus_order_retention_test',
    stripe_event_id: stripeEventId,
    currency: 'BRL',
    shipping_address: {},
  });
  orderId = order.id;
});

after(async () => {
  await cleanup();
  await database.close();
});

test('exclusão física é recusada e pedido pago mantém seus itens', async () => {
  await assert.rejects(
    () => orderService.deleteOrder(orderId, actor),
    (error) => error.statusCode === 405 && error.code === 'ORDER_DELETION_FORBIDDEN'
  );
  await assert.rejects(
    () => database.run('DELETE FROM pedidos WHERE id = ?', [orderId]),
    /FOREIGN KEY constraint failed/
  );
  const order = await database.get('SELECT id, status, total FROM pedidos WHERE id = ?', [orderId]);
  const items = await database.get('SELECT COUNT(*) count FROM pedido_itens WHERE pedido_id = ?', [orderId]);
  assert.equal(order.status, 'pago');
  assert.equal(Number(order.total), 99.9);
  assert.equal(Number(items.count), 1);
  assert.equal(orderModel.remove, undefined);
});

test('arquivamento preserva dados e cria evento de auditoria', async () => {
  await orderService.archiveOrder(orderId, { motivo: 'Pedido concluído e conferido' }, actor);
  const stored = await database.get(
    'SELECT arquivado_em, arquivado_por, motivo_arquivamento FROM pedidos WHERE id = ?',
    [orderId]
  );
  assert.ok(stored.arquivado_em);
  assert.equal(Number(stored.arquivado_por), actor.id);
  assert.equal(stored.motivo_arquivamento, 'Pedido concluído e conferido');
  assert.equal((await orderService.listOrders('active')).some((order) => order.id === orderId), false);

  const [archived] = (await orderService.listOrders('archived')).filter((order) => order.id === orderId);
  assert.ok(archived);
  assert.equal(archived.itens.length, 1);
  assert.ok(archived.historico.some((event) => event.tipo === 'pedido_arquivado'));
  await assert.rejects(
    () => orderService.updateOrder(orderId, { status: 'em_separacao' }, actor),
    (error) => error.code === 'ORDER_ARCHIVED'
  );
});

test('desarquivamento e mudanças de status mantêm trilha com ator e motivo', async () => {
  await orderService.unarchiveOrder(orderId, actor);
  await orderService.updateOrder(orderId, { status: 'em_separacao' }, actor);
  await assert.rejects(
    () => orderService.updateOrder(orderId, { status: 'cancelado' }, actor),
    (error) => error.details?.field === 'motivo_cancelamento'
  );
  await orderService.updateOrder(orderId, {
    status: 'cancelado',
    motivo_cancelamento: 'Cliente solicitou o cancelamento',
  }, actor);

  const stored = await database.get(
    `SELECT status, cancelado_em, cancelado_por, motivo_cancelamento, stock_status
     FROM pedidos WHERE id = ?`,
    [orderId]
  );
  assert.equal(stored.status, 'cancelado');
  assert.ok(stored.cancelado_em);
  assert.equal(Number(stored.cancelado_por), actor.id);
  assert.equal(stored.motivo_cancelamento, 'Cliente solicitou o cancelamento');
  assert.equal(stored.stock_status, 'restored');

  const events = await orderModel.listEvents([orderId]);
  assert.deepEqual(
    events.map((event) => event.tipo),
    [
      'pedido_pago_criado',
      'exclusao_fisica_bloqueada',
      'pedido_arquivado',
      'pedido_desarquivado',
      'status_alterado',
      'pedido_cancelado',
    ]
  );
  assert.equal(events.at(-1).ator_nome, actor.nome);
  assert.equal(events.at(-1).motivo, 'Cliente solicitou o cancelamento');
});
