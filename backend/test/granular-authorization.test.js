require('./testEnv');

process.env.DATABASE_URL = '';
process.env.DB_REQUIRE_POSTGRES = '';
process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const database = require('../src/config/database');
const { PERMISSOES_KEYS } = require('../src/constants/permissions');
const { buildPermissionMiddleware } = require('../src/middleware/auth');
const buildCategoryRoutes = require('../src/routes/categoryRoutes');
const buildCouponRoutes = require('../src/routes/couponRoutes');
const buildPromocoesRoutes = require('../src/routes/promocoesRoutes');
const categoryService = require('../src/services/categoryService');

function permissionFactory() {
  return (permission) => {
    const middleware = (req, res, next) => next();
    middleware.permission = permission;
    return middleware;
  };
}

function routeMiddleware(router, path, method) {
  const layer = router.stack.find(
    (candidate) => candidate.route?.path === path && candidate.route.methods[method]
  );
  assert.ok(layer, `${method.toUpperCase()} ${path} não foi registrada`);
  return layer.route.stack.map((routeLayer) => routeLayer.handle);
}

function assertPermission(router, path, method, permission) {
  assert.equal(routeMiddleware(router, path, method)[0].permission, permission);
}

before(async () => {
  await database.init();
  await database.run('DELETE FROM categorias WHERE nome = ?', ['Categoria RBAC inativa']);
});

after(async () => {
  await database.run('DELETE FROM categorias WHERE nome = ?', ['Categoria RBAC inativa']);
  await database.close();
});

test('catálogo canônico contém quatro ações para categorias, cupons e promoções', () => {
  for (const resource of ['categorias', 'cupons', 'promocoes']) {
    for (const action of ['visualizar', 'criar', 'editar', 'excluir']) {
      assert.ok(PERMISSOES_KEYS.includes(`${resource}.${action}`));
    }
  }
});

test('rotas de categorias preservam catálogo público e protegem administração por ação', () => {
  const router = buildCategoryRoutes({ perm: permissionFactory() });

  assert.equal(routeMiddleware(router, '/', 'get')[0].permission, undefined);
  assertPermission(router, '/admin', 'get', 'categorias.visualizar');
  assertPermission(router, '/', 'post', 'categorias.criar');
  assertPermission(router, '/:id', 'put', 'categorias.editar');
  assertPermission(router, '/:id/status', 'patch', 'categorias.editar');
  assertPermission(router, '/:id', 'delete', 'categorias.excluir');
});

test('rotas de cupons não reutilizam cupons.criar para outras ações', () => {
  const router = buildCouponRoutes({ perm: permissionFactory() });

  assertPermission(router, '/', 'get', 'cupons.visualizar');
  assertPermission(router, '/:id', 'get', 'cupons.visualizar');
  assertPermission(router, '/:id/usos', 'get', 'cupons.visualizar');
  assertPermission(router, '/', 'post', 'cupons.criar');
  assertPermission(router, '/:id/duplicar', 'post', 'cupons.criar');
  assertPermission(router, '/:id', 'put', 'cupons.editar');
  assertPermission(router, '/:id/status', 'patch', 'cupons.editar');
  assertPermission(router, '/:id', 'delete', 'cupons.excluir');
});

test('rotas de promoções exigem a permissão correspondente a cada ação', () => {
  const router = buildPromocoesRoutes({ perm: permissionFactory() });

  assertPermission(router, '/', 'get', 'promocoes.visualizar');
  assertPermission(router, '/:id', 'get', 'promocoes.visualizar');
  assertPermission(router, '/', 'post', 'promocoes.criar');
  assertPermission(router, '/:id', 'put', 'promocoes.editar');
  assertPermission(router, '/:id/status', 'patch', 'promocoes.editar');
  assertPermission(router, '/:id', 'delete', 'promocoes.excluir');
});

test('administrador com apenas cupons.criar não consegue visualizar, editar ou excluir', async () => {
  const authMiddleware = (req, res, next) => {
    req.user = { perfil: 'admin', permissoes: ['cupons.criar'] };
    next();
  };
  const invoke = (middleware) => new Promise((resolve) => {
    middleware({}, {}, (error) => resolve(error));
  });

  assert.equal(await invoke(buildPermissionMiddleware(authMiddleware, 'cupons.criar')), undefined);
  for (const permission of ['cupons.visualizar', 'cupons.editar', 'cupons.excluir']) {
    const error = await invoke(buildPermissionMiddleware(authMiddleware, permission));
    assert.equal(error.code, 'PERMISSION_DENIED');
  }
});

test('catálogo público omite categorias inativas e campos administrativos', async () => {
  await database.run(
    `INSERT INTO categorias (nome, status, ordem) VALUES (?, ?, ?)`,
    ['Categoria RBAC inativa', 'inativo', 999]
  );
  const categories = await categoryService.listPublicCategories();

  assert.equal(categories.some((category) => category.nome === 'Categoria RBAC inativa'), false);
  assert.ok(categories.length > 0);
  assert.equal(Object.hasOwn(categories[0], 'status'), false);
  assert.equal(Object.hasOwn(categories[0], 'produtos_count'), false);
});

test('administrador que gerencia contas recebe as novas permissões sem promover os demais', async () => {
  const administrators = await database.all("SELECT permissoes FROM usuarios WHERE perfil = 'admin'");
  const manager = administrators
    .map((administrator) => Array.isArray(administrator.permissoes)
      ? administrator.permissoes
      : JSON.parse(administrator.permissoes || '[]'))
    .find((permissions) => permissions.includes('administradores.gerenciar'));
  assert.ok(manager);

  for (const permission of [
    'categorias.visualizar', 'categorias.criar', 'categorias.editar', 'categorias.excluir',
    'cupons.visualizar', 'cupons.criar', 'cupons.editar', 'cupons.excluir',
    'promocoes.visualizar', 'promocoes.criar', 'promocoes.editar', 'promocoes.excluir',
  ]) {
    assert.ok(manager.includes(permission));
  }
});
