require('./testEnv');

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const database = require('../src/config/database');
const cartService = require('../src/services/cartService');
const inventoryModel = require('../src/models/inventoryModel');
const productService = require('../src/services/productService');

let productId;

before(async () => {
  await database.init();
  await database.run("DELETE FROM produtos WHERE sku = 'color-variant-test'");
  const created = await productService.createProduct({
    nome: 'Camisa com grade de cor', sku: 'color-variant-test', preco: 100,
    imagens: [], tamanhos: ['P', 'M'], cores: ['Azul', 'Vermelha'], status: 'ativo',
    variantes: [{ tamanho: 'P', estoque: 3 }, { tamanho: 'M', estoque: 4 }],
    variantes_cores: [
      { tamanho: 'P', cor: 'Azul', estoque: 1 },
      { tamanho: 'P', cor: 'Vermelha', estoque: 2 },
      { tamanho: 'M', cor: 'Azul', estoque: 3 },
      { tamanho: 'M', cor: 'Vermelha', estoque: 1 },
    ],
  });
  productId = created.id;
});

after(async () => {
  await database.run('DELETE FROM produtos WHERE id = ?', [productId]);
  await database.close();
});

test('API e carrinho usam o saldo da combinação tamanho/cor', async () => {
  const product = await productService.getProduct(productId);
  assert.equal(product.estoque, 7);
  assert.deepEqual(product.variantes_cores, [
    { tamanho: 'M', cor: 'Azul', estoque: 3 },
    { tamanho: 'M', cor: 'Vermelha', estoque: 1 },
    { tamanho: 'P', cor: 'Azul', estoque: 1 },
    { tamanho: 'P', cor: 'Vermelha', estoque: 2 },
  ]);
  await assert.rejects(
    () => cartService.buildCartSummary({ items: [{ productId, qty: 2, tamanho: 'P', cor: 'Azul' }] }),
    (error) => error.code === 'INSUFFICIENT_VARIANT_STOCK'
  );
  const cart = await cartService.buildCartSummary({ items: [{ productId, qty: 2, tamanho: 'P', cor: 'Vermelha' }] });
  assert.equal(cart.items[0].cor, 'Vermelha');
});

test('reserva, baixa e devolução movimentam somente a combinação comprada', async () => {
  const items = [{ productId, qty: 1, tamanho: 'M', cor: 'Azul' }];
  await database.transaction(async (db) => inventoryModel.reserve(items, db));
  let variant = await database.get(
    'SELECT estoque, estoque_reservado FROM produto_variantes_cores WHERE produto_id = ? AND tamanho = ? AND cor = ?',
    [productId, 'M', 'Azul']
  );
  assert.deepEqual([variant.estoque, variant.estoque_reservado], [3, 1]);

  await database.transaction(async (db) => inventoryModel.commit(items, db, { reserved: true }));
  variant = await database.get(
    'SELECT estoque, estoque_reservado FROM produto_variantes_cores WHERE produto_id = ? AND tamanho = ? AND cor = ?',
    [productId, 'M', 'Azul']
  );
  assert.deepEqual([variant.estoque, variant.estoque_reservado], [2, 0]);

  await database.transaction(async (db) => inventoryModel.restore(items, db));
  variant = await database.get(
    'SELECT estoque, estoque_reservado FROM produto_variantes_cores WHERE produto_id = ? AND tamanho = ? AND cor = ?',
    [productId, 'M', 'Azul']
  );
  assert.deepEqual([variant.estoque, variant.estoque_reservado], [3, 0]);
  const untouched = await database.get(
    'SELECT estoque FROM produto_variantes_cores WHERE produto_id = ? AND tamanho = ? AND cor = ?',
    [productId, 'M', 'Vermelha']
  );
  assert.equal(untouched.estoque, 1);
});
