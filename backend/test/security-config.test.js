require('./testEnv');

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSecurityConfig } = require('../src/config/security');

function validEnvironment() {
  return {
    JWT_SECRET: 'StrongJwtSecret9-With-Enough-Random-Characters',
    DEFAULT_ADMIN_EMAIL: 'owner@example.test',
    DEFAULT_ADMIN_PASSWORD: 'OwnerPassword!Secure9',
    BASIC_AUTH_USER: 'catalog-api-client',
    BASIC_AUTH_PASS: 'CatalogCredential!Secure8',
  };
}

test('falha quando qualquer credencial obrigatória está ausente', () => {
  for (const name of [
    'JWT_SECRET',
    'DEFAULT_ADMIN_EMAIL',
    'DEFAULT_ADMIN_PASSWORD',
    'BASIC_AUTH_USER',
    'BASIC_AUTH_PASS',
  ]) {
    const env = validEnvironment();
    delete env[name];
    assert.throws(
      () => loadSecurityConfig(env),
      (error) => error.code === 'SECURITY_CONFIGURATION_INVALID' && error.message.includes(name)
    );
  }
});

test('recusa segredos fracos mesmo quando todas as variáveis existem', () => {
  const weakAdmin = validEnvironment();
  weakAdmin.DEFAULT_ADMIN_PASSWORD = 'senha-curta';
  assert.throws(
    () => loadSecurityConfig(weakAdmin),
    (error) => error.code === 'SECURITY_CONFIGURATION_INVALID'
  );

  const weakJwt = validEnvironment();
  weakJwt.JWT_SECRET = 'somente-letras-minusculas-sem-entropia';
  assert.throws(
    () => loadSecurityConfig(weakJwt),
    (error) => error.code === 'SECURITY_CONFIGURATION_INVALID'
  );
});

test('exige credenciais distintas para administrador e Basic Auth', () => {
  const sameUser = validEnvironment();
  sameUser.BASIC_AUTH_USER = sameUser.DEFAULT_ADMIN_EMAIL;
  assert.throws(
    () => loadSecurityConfig(sameUser),
    (error) => error.code === 'SECURITY_CONFIGURATION_INVALID'
  );

  const samePassword = validEnvironment();
  samePassword.BASIC_AUTH_PASS = samePassword.DEFAULT_ADMIN_PASSWORD;
  assert.throws(
    () => loadSecurityConfig(samePassword),
    (error) => error.code === 'SECURITY_CONFIGURATION_INVALID'
  );
});

test('aceita apenas a configuração completa, forte e separada', () => {
  const config = loadSecurityConfig(validEnvironment());
  assert.equal(config.adminEmail, 'owner@example.test');
  assert.equal(config.basicAuthUser, 'catalog-api-client');
  assert.notEqual(config.adminPassword, config.basicAuthPass);
});

