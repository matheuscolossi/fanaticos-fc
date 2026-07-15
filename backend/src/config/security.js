function configurationError(message) {
  const error = new Error(message);
  error.code = 'SECURITY_CONFIGURATION_INVALID';
  return error;
}

function required(env, name) {
  const value = env[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw configurationError(`A variável ${name} é obrigatória.`);
  }
  return value;
}

function validateEmail(value, name) {
  if (value !== value.trim() || !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(value)) {
    throw configurationError(`A variável ${name} deve conter um e-mail válido, sem espaços externos.`);
  }
}

function validateCredential(value, name, minLength = 16) {
  const hasRequiredClasses = /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
  if (value.length < minLength || value.length > 256 || !hasRequiredClasses) {
    throw configurationError(
      `A variável ${name} deve ter entre ${minLength} e 256 caracteres, com maiúscula, minúscula, número e símbolo.`
    );
  }
}

function validateJwtSecret(value) {
  if (
    value.length < 32
    || value.length > 512
    || !/[a-z]/.test(value)
    || !/[A-Z]/.test(value)
    || !/\d/.test(value)
  ) {
    throw configurationError(
      'A variável JWT_SECRET deve ter entre 32 e 512 caracteres e conter maiúsculas, minúsculas e números.'
    );
  }
}

function loadSecurityConfig(env = process.env) {
  const jwtSecret = required(env, 'JWT_SECRET');
  const adminEmail = required(env, 'DEFAULT_ADMIN_EMAIL');
  const adminPassword = required(env, 'DEFAULT_ADMIN_PASSWORD');
  const basicAuthUser = required(env, 'BASIC_AUTH_USER');
  const basicAuthPass = required(env, 'BASIC_AUTH_PASS');

  validateJwtSecret(jwtSecret);
  validateEmail(adminEmail, 'DEFAULT_ADMIN_EMAIL');
  validateCredential(adminPassword, 'DEFAULT_ADMIN_PASSWORD');
  if (basicAuthUser !== basicAuthUser.trim() || basicAuthUser.length < 6 || basicAuthUser.length > 254) {
    throw configurationError('A variável BASIC_AUTH_USER deve ter entre 6 e 254 caracteres, sem espaços externos.');
  }
  validateCredential(basicAuthPass, 'BASIC_AUTH_PASS');

  if (basicAuthUser.toLowerCase() === adminEmail.toLowerCase() || basicAuthPass === adminPassword) {
    throw configurationError('As credenciais de administrador e HTTP Basic Auth devem ser diferentes.');
  }

  return { adminEmail, adminPassword, basicAuthPass, basicAuthUser, jwtSecret };
}

module.exports = { loadSecurityConfig };
