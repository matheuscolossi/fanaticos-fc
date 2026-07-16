require('./testEnv');

process.env.DATABASE_URL = '';
process.env.DB_REQUIRE_POSTGRES = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'email-verification-test-secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_local_only';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_only';
process.env.FRONTEND_URL = 'https://loja.example.test';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const database = require('../src/config/database');
const emailService = require('../src/services/emailService');
const authService = require('../src/services/authService');
const stripeService = require('../src/services/stripeService');
const paymentRoutes = require('../src/routes/paymentRoutes');

const jwtSecret = process.env.JWT_SECRET;
const testEmails = [
  'auth-verified@example.test',
  'auth-email-failure@example.test',
  'auth-email-controls@example.test',
];
const sentCodes = new Map();
const originalSend = emailService.enviarCodigoVerificacao;
const originalPasswordResetSend = emailService.enviarRecuperacaoSenha;
let passwordResetUrl;

function registrationData(email, nome = 'Cliente Verificação') {
  return {
    nome,
    email,
    senha: 'SenhaSegura123',
    cpf: '529.982.247-25',
    telefone: '(11) 99999-9999',
  };
}

before(async () => {
  await database.init();
  await database.run(
    `DELETE FROM usuarios WHERE email IN (${testEmails.map(() => '?').join(',')})`,
    testEmails
  );
  emailService.enviarCodigoVerificacao = async (email, code) => {
    sentCodes.set(email, code);
    return { id: `email-${email}` };
  };
});

after(async () => {
  emailService.enviarCodigoVerificacao = originalSend;
  emailService.enviarRecuperacaoSenha = originalPasswordResetSend;
  await database.run(
    `DELETE FROM usuarios WHERE email IN (${testEmails.map(() => '?').join(',')})`,
    testEmails
  );
  await database.close();
});

test('cadastro nunca emite sessão antes da confirmação e guarda somente hash do código', async () => {
  const email = testEmails[0];
  const result = await authService.registerUser(registrationData(email), jwtSecret);
  const user = await database.get('SELECT * FROM usuarios WHERE email = ?', [email]);

  assert.equal(result.requiresVerification, true);
  assert.equal(Object.hasOwn(result, 'token'), false);
  assert.equal(Object.hasOwn(result, 'user'), false);
  assert.equal(Boolean(user.email_verificado), false);
  assert.notEqual(user.codigo_verificacao, sentCodes.get(email));
  assert.match(user.codigo_verificacao, /^[a-f0-9]{64}$/);
});

test('login bloqueia conta não verificada e libera após código válido', async () => {
  const email = testEmails[0];
  await assert.rejects(
    () => authService.loginUser({ email, senha: 'SenhaSegura123' }, jwtSecret),
    (error) => error.statusCode === 403 && error.code === 'EMAIL_NOT_VERIFIED'
  );

  const verified = await authService.verificarCodigoEmail({ email, codigo: sentCodes.get(email) }, jwtSecret);
  assert.ok(verified.token);
  assert.equal(verified.user.email_verificado, true);

  const login = await authService.loginUser({ email, senha: 'SenhaSegura123' }, jwtSecret);
  assert.ok(login.token);
});

test('falha do provedor mantém conta sem sessão e libera reenvio posterior', async () => {
  const email = testEmails[1];
  emailService.enviarCodigoVerificacao = async () => {
    throw new Error('provider unavailable');
  };

  await assert.rejects(
    () => authService.registerUser(registrationData(email, 'Cliente Falha Email'), jwtSecret),
    (error) => error.statusCode === 502 && error.code === 'EMAIL_SEND_FAILED'
  );
  const user = await database.get('SELECT * FROM usuarios WHERE email = ?', [email]);
  assert.ok(user);
  assert.equal(Boolean(user.email_verificado), false);
  assert.equal(user.codigo_verificacao, null);
  assert.equal(user.codigo_ultimo_envio_em, null);

  emailService.enviarCodigoVerificacao = async (recipient, code) => {
    sentCodes.set(recipient, code);
    return { id: 'retry-ok' };
  };
  const resend = await authService.reenviarCodigoEmail({ email }, jwtSecret);
  assert.equal(resend.resendCooldownSeconds, 60);
  assert.ok(sentCodes.get(email));
});

test('reenvio aplica cooldown e limite persistente por janela', async () => {
  const email = testEmails[2];
  await authService.registerUser(registrationData(email, 'Cliente Controles Email'), jwtSecret);

  await assert.rejects(
    () => authService.reenviarCodigoEmail({ email }, jwtSecret),
    (error) => error.statusCode === 429 && error.code === 'VERIFICATION_RESEND_COOLDOWN'
  );

  const oldTimestamp = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  await database.run(
    `UPDATE usuarios SET codigo_ultimo_envio_em = ?, codigo_janela_inicio_em = ?,
       codigo_envios_na_janela = 5 WHERE email = ?`,
    [oldTimestamp, new Date().toISOString(), email]
  );
  await assert.rejects(
    () => authService.reenviarCodigoEmail({ email }, jwtSecret),
    (error) => error.statusCode === 429 && error.code === 'VERIFICATION_RESEND_LIMIT'
  );
});

test('código expirado é recusado e excesso de tentativas invalida o código atual', async () => {
  const email = testEmails[2];
  await database.run(
    `UPDATE usuarios SET codigo_expira_em = ?, codigo_ultimo_envio_em = ?,
       codigo_janela_inicio_em = ?, codigo_envios_na_janela = 0 WHERE email = ?`,
    [
      new Date(Date.now() - 1000).toISOString(),
      new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      email,
    ]
  );
  await assert.rejects(
    () => authService.verificarCodigoEmail({ email, codigo: sentCodes.get(email) }, jwtSecret),
    (error) => error.statusCode === 400 && error.code === 'CODE_EXPIRED'
  );

  await authService.reenviarCodigoEmail({ email }, jwtSecret);
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await assert.rejects(
      () => authService.verificarCodigoEmail({ email, codigo: '000000' }, jwtSecret),
      (error) => error.statusCode === 400 && error.code === 'INVALID_CODE'
    );
  }
  await assert.rejects(
    () => authService.verificarCodigoEmail({ email, codigo: '000000' }, jwtSecret),
    (error) => error.statusCode === 429 && error.code === 'VERIFICATION_ATTEMPTS_EXCEEDED'
  );
  const user = await database.get('SELECT codigo_verificacao FROM usuarios WHERE email = ?', [email]);
  assert.equal(user.codigo_verificacao, null);
});

test('checkout exige verificação na rota e novamente no serviço', async () => {
  const calls = [];
  const authMiddleware = (req, res, next) => next();
  const verifiedEmailMiddleware = (req, res, next) => {
    calls.push('verified');
    next();
  };
  const checkoutRateLimit = (req, res, next) => next();
  const router = paymentRoutes({ authMiddleware, checkoutRateLimit, verifiedEmailMiddleware });
  const checkoutRoute = router.stack.find(
    (layer) => layer.route?.path === '/stripe/create-session' && layer.route.methods.post
  );
  assert.equal(checkoutRoute.route.stack[0].handle, verifiedEmailMiddleware);
  assert.equal(checkoutRoute.route.stack[1].handle, checkoutRateLimit);

  const unverified = await database.get('SELECT id FROM usuarios WHERE email = ?', [testEmails[2]]);
  await assert.rejects(
    () => stripeService.createCheckoutSession({ items: [], userId: unverified.id }),
    (error) => error.statusCode === 403 && error.code === 'EMAIL_NOT_VERIFIED'
  );
  assert.deepEqual(calls, []);
});

test('recuperação usa token aleatório com hash, uso único e resposta anti-enumeração', async () => {
  const email = testEmails[0];
  emailService.enviarRecuperacaoSenha = async (_email, url) => { passwordResetUrl = url; };
  const generic = await authService.requestPasswordReset({ email: 'inexistente@example.test' });
  const requested = await authService.requestPasswordReset({ email });
  assert.deepEqual(requested, generic);

  const token = new URL(passwordResetUrl).searchParams.get('token');
  assert.match(token, /^[a-f0-9]{64}$/);
  const stored = await database.get(
    'SELECT token_hash FROM password_reset_tokens WHERE usuario_id = (SELECT id FROM usuarios WHERE email = ?) ORDER BY id DESC LIMIT 1',
    [email]
  );
  assert.notEqual(stored.token_hash, token);

  await authService.resetPassword({ token, novaSenha: 'NovaSenhaSegura456' });
  const login = await authService.loginUser({ email, senha: 'NovaSenhaSegura456' }, jwtSecret);
  assert.ok(login.token);
  await assert.rejects(
    () => authService.resetPassword({ token, novaSenha: 'OutraSenhaSegura789' }),
    (error) => error.code === 'PASSWORD_RESET_INVALID'
  );
});
