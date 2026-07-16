require('./testEnv');

process.env.DATABASE_URL = '';
process.env.DB_REQUIRE_POSTGRES = '';
process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const database = require('../src/config/database');
const reviewService = require('../src/services/reviewService');
const buildReviewRoutes = require('../src/routes/reviewRoutes');

const buyerEmail = 'reviews-buyer@example.test';
const outsiderEmail = 'reviews-outsider@example.test';
const productSku = 'reviews-product-test';
let buyer;
let outsider;
let productId;
let orderId;
let orderItemId;

async function cleanup() {
  const product = await database.get('SELECT id FROM produtos WHERE sku = ?', [productSku]);
  const users = await database.all(
    'SELECT id FROM usuarios WHERE email IN (?, ?)',
    [buyerEmail, outsiderEmail]
  );
  const userIds = users.map((user) => user.id);
  if (product) await database.run('DELETE FROM avaliacoes WHERE produto_id = ?', [product.id]);
  if (userIds.length) {
    const placeholders = userIds.map(() => '?').join(',');
    const orders = await database.all(
      `SELECT id FROM pedidos WHERE usuario_id IN (${placeholders})`,
      userIds
    );
    const orderIds = orders.map((order) => order.id);
    if (orderIds.length) {
      const orderPlaceholders = orderIds.map(() => '?').join(',');
      await database.run(`DELETE FROM pedido_eventos WHERE pedido_id IN (${orderPlaceholders})`, orderIds);
      await database.run(`DELETE FROM pedido_itens WHERE pedido_id IN (${orderPlaceholders})`, orderIds);
      await database.run(`DELETE FROM pedidos WHERE id IN (${orderPlaceholders})`, orderIds);
    }
    await database.run(`DELETE FROM usuarios WHERE id IN (${placeholders})`, userIds);
  }
  if (product) await database.run('DELETE FROM produtos WHERE id = ?', [product.id]);
}

before(async () => {
  await database.init();
  await cleanup();

  const buyerResult = await database.run(
    `INSERT INTO usuarios (nome, email, senha, perfil, email_verificado)
     VALUES (?, ?, ?, 'cliente', ?)`,
    ['Comprador Real', buyerEmail, 'hash-test', 1]
  );
  const outsiderResult = await database.run(
    `INSERT INTO usuarios (nome, email, senha, perfil, email_verificado)
     VALUES (?, ?, ?, 'cliente', ?)`,
    ['Visitante', outsiderEmail, 'hash-test', 1]
  );
  buyer = { id: buyerResult.lastID, nome: 'Comprador Real', email_verificado: true };
  outsider = { id: outsiderResult.lastID, nome: 'Visitante', email_verificado: true };

  const category = await database.get('SELECT id FROM categorias ORDER BY id LIMIT 1');
  const product = await database.run(
    `INSERT INTO produtos (nome, sku, preco, categoria_id, imagens, estoque, status)
     VALUES (?, ?, ?, ?, JSON_VALUE(?), ?, 'ativo')`,
    ['Produto para avaliação', productSku, 149.9, category?.id || null, '[]', 10]
  );
  productId = product.lastID;

  const order = await database.run(
    `INSERT INTO pedidos (
       usuario_id, itens, total, status, payment_status, stock_status,
       nome_cliente, email_cliente, metodo_pagamento
     ) VALUES (?, JSON_VALUE(?), ?, 'pago', 'paid', 'committed', ?, ?, 'stripe')`,
    [buyer.id, JSON.stringify([{ id: productId, qty: 1 }]), 149.9, buyer.nome, buyerEmail]
  );
  orderId = order.lastID;
  const item = await database.run(
    `INSERT INTO pedido_itens (
       pedido_id, produto_id, nome, preco_unitario, quantidade, variacao, subtotal
     ) VALUES (?, ?, ?, ?, ?, JSON_VALUE(?), ?)`,
    [orderId, productId, 'Produto para avaliação', 149.9, 1, '{}', 149.9]
  );
  orderItemId = item.lastID;
});

after(async () => {
  await cleanup();
  await database.close();
});

test('somente uma compra paga permite criar uma avaliação pendente e vinculada ao pedido', async () => {
  await assert.rejects(
    () => reviewService.createReview(productId, {
      nota: 5,
      comentario: 'Este comentário tem tamanho suficiente para o teste.',
    }, outsider),
    (error) => error.statusCode === 403 && error.code === 'VERIFIED_PURCHASE_REQUIRED'
  );

  const created = await reviewService.createReview(productId, {
    nota: 5,
    titulo: 'Ótima compra',
    comentario: 'Produto excelente, chegou corretamente e veste muito bem.',
    autor_nome: '<img src=x onerror=alert(1)>',
    status: 'aprovada',
    compra_verificada: false,
  }, buyer);

  const stored = await database.get('SELECT * FROM avaliacoes WHERE id = ?', [created.id]);
  assert.equal(stored.autor_nome, buyer.nome);
  assert.equal(stored.status, 'pendente');
  assert.equal(Boolean(stored.compra_verificada), true);
  assert.equal(stored.pedido_id, orderId);
  assert.equal(stored.pedido_item_id, orderItemId);

  await assert.rejects(
    () => reviewService.createReview(productId, {
      nota: 4,
      comentario: 'Uma segunda avaliação não deve ser aceita pelo serviço.',
    }, buyer),
    (error) => error.statusCode === 409 && error.code === 'REVIEW_ALREADY_EXISTS'
  );
});

test('avaliação só fica pública após moderação e o DTO não expõe pedido nem usuário', async () => {
  const beforeApproval = await reviewService.listProductReviews(productId, buyer);
  assert.equal(beforeApproval.avaliacoes.length, 0);
  assert.equal(beforeApproval.pode_avaliar, true);
  assert.equal(beforeApproval.minha_avaliacao.status, 'pendente');

  const stored = await database.get('SELECT id FROM avaliacoes WHERE produto_id = ?', [productId]);
  await reviewService.moderateReview(stored.id, { status: 'aprovada' }, { id: buyer.id });

  const publicResult = await reviewService.listProductReviews(productId);
  assert.equal(publicResult.resumo.total, 1);
  assert.equal(publicResult.resumo.media, 5);
  assert.equal(publicResult.avaliacoes[0].compra_verificada, true);
  assert.equal(publicResult.avaliacoes[0].autor_nome, buyer.nome);
  assert.equal('usuario_id' in publicResult.avaliacoes[0], false);
  assert.equal('pedido_id' in publicResult.avaliacoes[0], false);
  assert.equal('pedido_item_id' in publicResult.avaliacoes[0], false);
});

test('edição reabre a moderação e rejeição exige motivo', async () => {
  const stored = await database.get('SELECT id FROM avaliacoes WHERE produto_id = ?', [productId]);
  await reviewService.updateReview(stored.id, {
    nota: 4,
    titulo: 'Atualização honesta',
    comentario: 'Depois de mais uso, atualizei minha avaliação do produto.',
  }, buyer);

  let updated = await database.get('SELECT status, moderado_por FROM avaliacoes WHERE id = ?', [stored.id]);
  assert.equal(updated.status, 'pendente');
  assert.equal(updated.moderado_por, null);
  assert.equal((await reviewService.listProductReviews(productId)).avaliacoes.length, 0);

  await assert.rejects(
    () => reviewService.moderateReview(stored.id, { status: 'rejeitada' }, { id: buyer.id }),
    (error) => error.statusCode === 400 && error.code === 'VALIDATION_ERROR'
  );
  await reviewService.moderateReview(
    stored.id,
    { status: 'rejeitada', motivo: 'Inclua detalhes mais objetivos sobre o produto.' },
    { id: buyer.id }
  );
  updated = await database.get('SELECT status, motivo_moderacao FROM avaliacoes WHERE id = ?', [stored.id]);
  assert.equal(updated.status, 'rejeitada');
  assert.match(updated.motivo_moderacao, /detalhes mais objetivos/);
});

test('IDs, nota, comentário e decisão de moderação têm validação centralizada', async () => {
  await assert.rejects(
    () => reviewService.listProductReviews('1 OR 1=1'),
    (error) => error.statusCode === 400 && error.details?.field === 'produtoId'
  );
  await assert.rejects(
    () => reviewService.createReview(productId, { nota: Infinity, comentario: 'Comentário válido com tamanho suficiente.' }, buyer),
    (error) => error.statusCode === 400 && error.details?.field === 'nota'
  );
  await assert.rejects(
    () => reviewService.updateReview('-2', { nota: 5, comentario: 'Comentário válido com tamanho suficiente.' }, buyer),
    (error) => error.statusCode === 400 && error.details?.field === 'id'
  );
});

test('rotas separam leitura pública, compra verificada e permissões de moderação', () => {
  const optionalAuthMiddleware = (_req, _res, next) => next();
  const verifiedEmailMiddleware = (_req, _res, next) => next();
  const permissions = [];
  const perm = (key) => {
    permissions.push(key);
    return (_req, _res, next) => next();
  };
  const router = buildReviewRoutes({ optionalAuthMiddleware, perm, verifiedEmailMiddleware });
  const routes = router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({ path: layer.route.path, methods: layer.route.methods, handlers: layer.route.stack.map((item) => item.handle) }));

  const publicRoute = routes.find((route) => route.path === '/produto/:produtoId' && route.methods.get);
  const createRoute = routes.find((route) => route.path === '/produto/:produtoId' && route.methods.post);
  const updateRoute = routes.find((route) => route.path === '/:id' && route.methods.put);
  assert.equal(publicRoute.handlers[0], optionalAuthMiddleware);
  assert.equal(createRoute.handlers[0], verifiedEmailMiddleware);
  assert.equal(updateRoute.handlers[0], verifiedEmailMiddleware);
  assert.deepEqual(permissions, ['avaliacoes.visualizar', 'avaliacoes.moderar']);
});
