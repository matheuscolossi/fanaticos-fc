require('./testEnv');

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const database = require('../src/config/database');
const orderService = require('../src/services/orderService');

const userEmail = 'whatsapp-checkout@test.local';
const productSku = 'whatsapp-checkout-test';
const previousResendKey = process.env.RESEND_API_KEY;
let userId;
let productId;
let orderId;

async function cleanup() {
  const orders = await database.all('SELECT id FROM pedidos WHERE email_cliente = ?', [userEmail]);
  for (const order of orders) {
    await database.run('DELETE FROM pedido_eventos WHERE pedido_id = ?', [order.id]);
    await database.run('DELETE FROM pedido_itens WHERE pedido_id = ?', [order.id]);
    await database.run('DELETE FROM pedidos WHERE id = ?', [order.id]);
  }
  await database.run('DELETE FROM usuarios WHERE email = ?', [userEmail]);
  await database.run('DELETE FROM produtos WHERE sku = ?', [productSku]);
}

before(async () => {
  process.env.RESEND_API_KEY = '';
  await database.init();
  await cleanup();
  const category = await database.get('SELECT id FROM categorias ORDER BY id LIMIT 1');
  const user = await database.run(
    `INSERT INTO usuarios (nome, email, senha, telefone, email_verificado)
     VALUES (?, ?, ?, ?, ?)`,
    ['Cliente WhatsApp', userEmail, 'hash-only-for-test', '54999999999', 1]
  );
  userId = user.lastID;
  const product = await database.run(
    `INSERT INTO produtos (nome, sku, preco, categoria_id, imagens, estoque, status)
     VALUES (?, ?, ?, ?, JSON_VALUE(?), ?, ?)`,
    ['Camisa WhatsApp', productSku, 75, category.id, '[]', 5, 'ativo']
  );
  productId = product.lastID;
});

after(async () => {
  await cleanup();
  await database.close();
  if (previousResendKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = previousResendKey;
});

test('cria pedido WhatsApp com total oficial, baixa estoque e permite confirmar o pagamento', async () => {
  const created = await orderService.createOrder({
    usuario_id: userId,
    itens: [{ productId, qty: 2 }],
    nome_cliente: 'Cliente WhatsApp',
    telefone_cliente: '(54) 99999-9999',
    endereco: 'Rua de Teste, 123 — Caxias do Sul / RS — CEP: 95000-000',
    uf: 'RS',
    metodo_pagamento: 'whatsapp',
  });
  orderId = created.id;

  assert.equal(created.subtotal, 150);
  assert.equal(created.freight, 15);
  assert.equal(created.total, 165);

  const stored = await database.get(
    `SELECT metodo_pagamento, status, payment_status, stock_status, total
     FROM pedidos WHERE id = ?`,
    [orderId]
  );
  assert.deepEqual(stored, {
    metodo_pagamento: 'whatsapp',
    status: 'aguardando_pagamento',
    payment_status: 'unpaid',
    stock_status: 'committed',
    total: 165,
  });
  assert.equal(
    Number((await database.get('SELECT estoque FROM produtos WHERE id = ?', [productId])).estoque),
    3
  );
  assert.equal(
    Number((await database.get('SELECT COUNT(*) AS total FROM pedido_itens WHERE pedido_id = ?', [orderId])).total),
    1
  );

  const actor = { id: 1, nome: 'Administrador' };
  await orderService.updateOrder(orderId, { status: 'pago' }, actor);
  const paid = await database.get('SELECT status, payment_status FROM pedidos WHERE id = ?', [orderId]);
  assert.deepEqual(paid, { status: 'pago', payment_status: 'paid' });
  assert.doesNotThrow(() => orderService.assertOrderCanEnterFulfillment({
    payment_status: paid.payment_status,
    metodo_pagamento: 'whatsapp',
  }, 'em_separacao', { production: true }));
});
