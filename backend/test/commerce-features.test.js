require('./testEnv');

const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { after, before, test } = require('node:test');
const database = require('../src/config/database');
const service = require('../src/services/commerceFeaturesService');

let userId;
let adminId;
let productId;
let orderId;

before(async () => {
  await database.init();
  await database.run("DELETE FROM usuarios WHERE email IN ('commerce-user@example.test','commerce-admin@example.test')");
  const user = await database.run(
    `INSERT INTO usuarios (nome, email, senha, perfil, status, email_verificado)
     VALUES (?, ?, ?, 'cliente', 'ativo', 1)`,
    ['Cliente Commerce', 'commerce-user@example.test', bcrypt.hashSync('SenhaSegura123', 4)]
  );
  userId = user.lastID;
  const admin = await database.run(
    `INSERT INTO usuarios (nome, email, senha, perfil, status, email_verificado)
     VALUES (?, ?, ?, 'admin', 'ativo', 1)`,
    ['Admin Commerce', 'commerce-admin@example.test', bcrypt.hashSync('SenhaSegura123', 4)]
  );
  adminId = admin.lastID;
  const category = await database.get('SELECT id FROM categorias ORDER BY id LIMIT 1');
  const product = await database.run(
    `INSERT INTO produtos (nome, sku, slug, preco, categoria_id, imagens, tamanhos, cores, estoque, status)
     VALUES (?, ?, ?, 89.9, ?, JSON_VALUE(?), JSON_VALUE(?), JSON_VALUE(?), 5, 'ativo')`,
    ['Produto Commerce', 'commerce-features-test', 'produto-commerce', category.id, '[]', '[]', '[]']
  );
  productId = product.lastID;
  const order = await database.run(
    `INSERT INTO pedidos (usuario_id, itens, total, status, payment_status, nome_cliente, email_cliente, updated_at)
     VALUES (?, JSON_VALUE(?), 89.9, 'entregue', 'paid', ?, ?, CURRENT_TIMESTAMP)`,
    [userId, JSON.stringify([{ productId, qty: 1 }]), 'Cliente Commerce', 'commerce-user@example.test']
  );
  orderId = order.lastID;
  await database.run(
    `INSERT INTO pedido_itens (pedido_id, produto_id, nome, preco_unitario, quantidade, subtotal)
     VALUES (?, ?, ?, 89.9, 1, 89.9)`,
    [orderId, productId, 'Produto Commerce']
  );
});

after(async () => {
  await database.run('DELETE FROM solicitacoes_troca WHERE pedido_id = ?', [orderId]);
  await database.run('DELETE FROM pedido_eventos WHERE pedido_id = ?', [orderId]);
  await database.run('DELETE FROM pedido_itens WHERE pedido_id = ?', [orderId]);
  await database.run('DELETE FROM pedidos WHERE id = ?', [orderId]);
  await database.run('DELETE FROM produtos WHERE id = ?', [productId]);
  await database.run('DELETE FROM analytics_eventos WHERE usuario_id = ?', [userId]);
  await database.run('DELETE FROM analytics_consents WHERE usuario_id = ?', [userId]);
  await database.run('DELETE FROM usuarios WHERE id IN (?, ?)', [userId, adminId]);
  await database.close();
});

test('favoritos, carrinho e vistos recentemente persistem por conta', async () => {
  await service.addFavorite(userId, productId);
  assert.equal((await service.listFavorites(userId))[0].id, productId);
  const saved = await service.saveServerCart(userId, { items: [{ productId, qty: 2 }] });
  assert.equal(saved.items[0].qty, 2);
  assert.equal((await service.getServerCart(userId)).items[0].productId, productId);
  await service.recordRecentlyViewed(userId, productId);
  assert.equal((await service.listRecentlyViewed(userId))[0].id, productId);
  await service.removeFavorite(userId, productId);
  assert.equal((await service.listFavorites(userId)).length, 0);
});

test('analytics só registra depois do consentimento explícito e remove dados pessoais', async () => {
  const sessionId = 'commerce-session-123456789';
  assert.equal((await service.recordAnalyticsEvent({ id: userId }, { sessionId, evento: 'view_product', dados: {} })).recorded, false);
  await service.saveConsent({ id: userId }, { sessionId, analytics: true, marketing: false });
  assert.equal((await service.recordAnalyticsEvent({ id: userId }, {
    sessionId, evento: 'view_product', dados: { product_id: productId, email: 'nao-persistir@example.test' },
  })).recorded, true);
  const row = await database.get('SELECT dados FROM analytics_eventos WHERE session_id = ?', [sessionId]);
  const data = typeof row.dados === 'string' ? JSON.parse(row.dados) : row.dados;
  assert.equal(data.product_id, String(productId));
  assert.equal('email' in data, false);
});

test('cliente inicia troca e administrador mantém resposta e estado', async () => {
  const created = await service.createReturnRequest(userId, {
    pedidoId: orderId, tipo: 'troca', itens: [productId],
    motivo: 'O tamanho recebido não serviu e desejo realizar a troca.',
  });
  assert.equal(created.status, 'solicitada');
  await service.updateReturnRequest(created.id, { status: 'aprovada', resposta: 'Troca aprovada; siga as instruções enviadas.' }, adminId);
  const requests = await service.listReturnRequests(userId);
  assert.equal(requests[0].status, 'aprovada');
});

test('banners e conteúdo institucional publicam somente itens ativos', async () => {
  const banner = await service.createBanner({
    titulo: 'Campanha de teste', subtitulo: 'Somente teste', imagem_url: 'https://example.test/banner.jpg',
    link_url: '/busca', posicao: 'home_hero', status: 'ativo', ordem: 0,
  });
  assert.ok((await service.listPublicBanners('home_hero')).some((item) => Number(item.id) === Number(banner.id)));
  await service.saveContent({ chave: 'commerce_teste', titulo: 'Sobre', conteudo: 'Conteúdo institucional de teste.', status: 'ativo' });
  assert.ok((await service.listPublicContent()).some((item) => item.chave === 'commerce_teste'));
  await service.deleteBanner(banner.id);
  await database.run("DELETE FROM conteudos_institucionais WHERE chave = 'commerce_teste'");
});
