require('./testEnv');

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const bcrypt = require('bcryptjs');
const database = require('../src/config/database');
const authService = require('../src/services/authService');
const emailService = require('../src/services/emailService');
const productService = require('../src/services/productService');
const {
  normalizeCep,
  validateRegistration,
} = require('../src/validation/userSchemas');

const testEmail = 'backend-validation@example.test';
const originalSendVerification = emailService.enviarCodigoVerificacao;

function productPayload(overrides = {}) {
  return {
    nome: 'Camisa validada',
    preco: 149.9,
    preco_promocional: 129.9,
    custo: 70,
    estoque: 10,
    estoque_minimo: 2,
    imagens: [],
    tamanhos: [],
    cores: [],
    status: 'ativo',
    tipo: 'torcedor',
    genero: 'unissex',
    peso: 0.35,
    ...overrides,
  };
}

function rejectsValidation(work, field) {
  return assert.rejects(
    work,
    (error) => error.statusCode === 400 && error.code === 'VALIDATION_ERROR' && error.details?.field === field
  );
}

before(async () => {
  await database.init();
  await database.run('DELETE FROM usuarios WHERE email = ?', [testEmail]);
});

after(async () => {
  emailService.enviarCodigoVerificacao = originalSendVerification;
  await database.run('DELETE FROM usuarios WHERE email = ?', [testEmail]);
  await database.close();
});

test('schema de produto rejeita preços negativos, infinitos e valores numéricos inválidos', async () => {
  for (const preco of [-1, 0, Infinity, 'infinito', 10.001]) {
    await rejectsValidation(() => productService.normalizeProductPayload(productPayload({ preco })), 'preco');
  }
  await rejectsValidation(
    () => productService.normalizeProductPayload(productPayload({ preco_promocional: -1 })),
    'preco_promocional'
  );
  await rejectsValidation(
    () => productService.normalizeProductPayload(productPayload({ preco_promocional: 200 })),
    'preco_promocional'
  );
  await rejectsValidation(
    () => productService.normalizeProductPayload(productPayload({ custo: Number.NaN })),
    'custo'
  );
});

test('schema de produto rejeita estoques, enumerações, peso e textos fora dos limites', async () => {
  await rejectsValidation(
    () => productService.normalizeProductPayload(productPayload({ estoque: -1 })),
    'estoque'
  );
  await rejectsValidation(
    () => productService.normalizeProductPayload(productPayload({ estoque_minimo: 1.5 })),
    'estoque_minimo'
  );
  await rejectsValidation(
    () => productService.normalizeProductPayload(productPayload({ status: 'publicado' })),
    'status'
  );
  await rejectsValidation(
    () => productService.normalizeProductPayload(productPayload({ tipo: 'qualquer' })),
    'tipo'
  );
  await rejectsValidation(
    () => productService.normalizeProductPayload(productPayload({ genero: 'qualquer' })),
    'genero'
  );
  await rejectsValidation(
    () => productService.normalizeProductPayload(productPayload({ peso: Infinity })),
    'peso'
  );
  await rejectsValidation(
    () => productService.normalizeProductPayload(productPayload({ nome: 'x'.repeat(201) })),
    'nome'
  );
});

test('preço em lote e alteração de status usam os mesmos limites centralizados', async () => {
  await rejectsValidation(
    () => productService.bulkUpdatePrices([1], { tipo: 'fixo', valor: -5 }),
    'valor'
  );
  await rejectsValidation(
    () => productService.bulkUpdatePrices([1], { tipo: 'desconto_pct', valor: 100 }),
    'valor'
  );
  await rejectsValidation(
    () => productService.bulkUpdatePrices(['abc'], { tipo: 'fixo', valor: 10 }),
    'ids'
  );
  await rejectsValidation(() => productService.setProductStatus(1, 'arquivado'), 'status');
});

test('dados pessoais são validados e canonicalizados pelo schema central', () => {
  const normalized = validateRegistration({
    nome: '  Maria   da Silva  ',
    email: '  MARIA@EXAMPLE.COM  ',
    senha: 'SenhaSegura123',
    cpf: '529.982.247-25',
    telefone: '(11) 99999-9999',
  });
  assert.deepEqual(normalized, {
    nome: 'Maria da Silva',
    email: 'maria@example.com',
    senha: 'SenhaSegura123',
    cpf: '52998224725',
    telefone: '11999999999',
  });
  assert.equal(normalizeCep('99700-398'), '99700398');
  assert.throws(
    () => validateRegistration({ ...normalized, email: 'email-invalido' }),
    (error) => error.details?.field === 'email'
  );
  assert.throws(
    () => validateRegistration({ ...normalized, cpf: '111.111.111-11' }),
    (error) => error.details?.field === 'cpf'
  );
  assert.throws(
    () => validateRegistration({ ...normalized, telefone: '123' }),
    (error) => error.details?.field === 'telefone'
  );
  assert.throws(() => normalizeCep('999'), (error) => error.details?.field === 'cep');
});

test('authService persiste CPF, telefone e e-mail somente no formato canônico', async () => {
  emailService.enviarCodigoVerificacao = async () => ({ id: 'validation-email' });
  await authService.registerUser({
    nome: '  Cliente   Canonizado ',
    email: ' BACKEND-VALIDATION@EXAMPLE.TEST ',
    senha: 'SenhaSegura123',
    cpf: '529.982.247-25',
    telefone: '(11) 99999-9999',
  }, process.env.JWT_SECRET);
  const user = await database.get(
    'SELECT nome, email, cpf, telefone FROM usuarios WHERE email = ?',
    [testEmail]
  );
  assert.deepEqual(user, {
    nome: 'Cliente Canonizado',
    email: testEmail,
    cpf: '52998224725',
    telefone: '11999999999',
  });
});

test('constraints do SQLite bloqueiam gravação direta que contorne os services', async () => {
  await assert.rejects(
    () => database.run(
      `INSERT INTO produtos (nome, preco, estoque, status, tipo, genero)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['Produto inválido direto', -1, 0, 'ativo', 'torcedor', 'masculino']
    ),
    /produtos_dados_invalidos/
  );
  await assert.rejects(
    () => database.run(
      `INSERT INTO usuarios (nome, email, senha, cpf, telefone)
       VALUES (?, ?, ?, ?, ?)`,
      ['Usuário Direto', 'DIRETO@EXAMPLE.TEST', bcrypt.hashSync('Senha123', 4), '529.982.247-25', '11999999999']
    ),
    /usuarios_dados_invalidos/
  );
});
