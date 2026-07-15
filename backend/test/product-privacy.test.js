process.env.DATABASE_URL = '';
process.env.DB_REQUIRE_POSTGRES = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'product-privacy-test-secret';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const database = require('../src/config/database');
const productService = require('../src/services/productService');
const productsController = require('../src/controllers/productsController');
const productRoutes = require('../src/routes/productRoutes');

const testSkus = ['privacy-active-sku', 'privacy-inactive-sku'];
const privateFields = [
  'custo',
  'sku',
  'status',
  'estoque_reservado',
  'estoque_minimo',
  'created_at',
];
let activeProductId;
let inactiveProductId;

async function insertProduct({ nome, sku, status }) {
  const category = await database.get('SELECT id FROM categorias ORDER BY id LIMIT 1');
  const result = await database.run(
    `INSERT INTO produtos (
       nome, slug, sku, preco, preco_promocional, custo, categoria_id,
       descricao, imagens, tamanhos, estoque, estoque_reservado, estoque_minimo, status
     ) VALUES (?, ?, ?, 129.9, 119.9, 47.5, ?, ?, JSON_VALUE(?), JSON_VALUE(?), 8, 3, 2, ?)`,
    [
      nome,
      nome.toLowerCase().replace(/\s+/g, '-'),
      sku,
      category.id,
      `Descrição de ${nome}`,
      JSON.stringify(['https://example.test/product.jpg']),
      JSON.stringify(['M']),
      status,
    ]
  );
  return result.lastID;
}

function assertNoPrivateFields(product) {
  for (const field of privateFields) {
    assert.equal(
      Object.hasOwn(product, field),
      false,
      `O DTO público não deve conter ${field}`
    );
  }
}

before(async () => {
  await database.init();
  await database.run(
    `DELETE FROM produtos WHERE sku IN (${testSkus.map(() => '?').join(',')})`,
    testSkus
  );
  activeProductId = await insertProduct({
    nome: 'Produto Público Privacidade',
    sku: testSkus[0],
    status: 'ativo',
  });
  inactiveProductId = await insertProduct({
    nome: 'Produto Inativo Privacidade',
    sku: testSkus[1],
    status: 'inativo',
  });
});

after(async () => {
  await database.run(
    `DELETE FROM produtos WHERE sku IN (${testSkus.map(() => '?').join(',')})`,
    testSkus
  );
  await database.close();
});

test('listagem pública usa DTO explícito e não retorna produtos inativos', async () => {
  const result = await productService.listProductsPaginated({ busca: 'Privacidade', limit: 20 });
  const active = result.produtos.find((product) => Number(product.id) === Number(activeProductId));

  assert.ok(active);
  assert.equal(result.produtos.some((product) => Number(product.id) === Number(inactiveProductId)), false);
  assertNoPrivateFields(active);
  assert.equal(active.estoque, 5);
  assert.deepEqual(active.tamanhos, ['M']);
});

test('detalhe público expõe somente o contrato comercial permitido', async () => {
  const product = await productService.getProduct(activeProductId);

  assert.equal(product.id, activeProductId);
  assert.equal(product.descricao, 'Descrição de Produto Público Privacidade');
  assert.equal(product.estoque, 5);
  assertNoPrivateFields(product);
});

test('detalhe público trata produto inativo como não encontrado', async () => {
  await assert.rejects(
    () => productService.getProduct(inactiveProductId),
    (error) => error.statusCode === 404 && error.code === 'PRODUCT_NOT_FOUND'
  );
});

test('serviço administrativo preserva produtos inativos e campos internos', async () => {
  const products = await productService.listProducts({ busca: 'Privacidade' });
  const inactive = products.find((product) => Number(product.id) === Number(inactiveProductId));

  assert.ok(inactive);
  assert.equal(inactive.status, 'inativo');
  assert.equal(Number(inactive.custo), 47.5);
  assert.equal(inactive.sku, testSkus[1]);
});

test('modo admin da listagem exige a permissão produtos.visualizar', async () => {
  const permissionCalls = [];
  const router = productRoutes({
    perm: (permission) => (req, res, next) => {
      permissionCalls.push(permission);
      next();
    },
  });
  const rootRoute = router.stack.find((layer) => layer.route?.path === '/' && layer.route.methods.get);
  const guard = rootRoute.route.stack[0].handle;

  guard({ query: {} }, {}, () => {});
  assert.deepEqual(permissionCalls, []);

  guard({ query: { admin: 'true' } }, {}, () => {});
  assert.deepEqual(permissionCalls, ['produtos.visualizar']);
});

test('controller recusa modo admin sem identidade administrativa', async () => {
  await assert.rejects(
    () => productsController.index({ query: { admin: 'true' } }, {}),
    (error) => error.statusCode === 403 && error.code === 'ADMIN_ACCESS_REQUIRED'
  );
});
