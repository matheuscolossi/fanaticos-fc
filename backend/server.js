const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./src/docs/openapi');
const { init } = require('./src/config/database');
const {
  buildAdminMiddleware,
  buildAuthMiddleware,
  buildBasicAuthMiddleware,
  buildOptionalAuthMiddleware,
  buildPermissionMiddleware,
  buildVerifiedEmailMiddleware,
} = require('./src/middleware/auth');
const { buildSecurityRateLimiters } = require('./src/middleware/rateLimit');
const { loadSecurityConfig } = require('./src/config/security');
const { errorHandler } = require('./src/utils/http');
const authRoutes = require('./src/routes/authRoutes');
const categoryRoutes = require('./src/routes/categoryRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const productRoutes = require('./src/routes/productRoutes');
const userRoutes = require('./src/routes/userRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const couponRoutes = require('./src/routes/couponRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const configRoutes = require('./src/routes/configRoutes');
const promocoesRoutes = require('./src/routes/promocoesRoutes');
const funcionariosRoutes = require('./src/routes/funcionariosRoutes');
const logRoutes = require('./src/routes/logRoutes');
const specRoutes = require('./src/routes/specRoutes');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;
let securityConfig;
try {
  securityConfig = loadSecurityConfig(process.env);
} catch (error) {
  console.error(`[api:config:error] ${error.message}`);
  process.exit(1);
}
const JWT_SECRET = securityConfig.jwtSecret;
const authMiddleware = buildAuthMiddleware(JWT_SECRET);
const optionalAuthMiddleware = buildOptionalAuthMiddleware(authMiddleware);
const verifiedEmailMiddleware = buildVerifiedEmailMiddleware(authMiddleware);
const rateLimiters = buildSecurityRateLimiters(process.env.RATE_LIMIT_SECRET || JWT_SECRET);
const adminMiddleware = buildAdminMiddleware(authMiddleware);
const perm = (key) => buildPermissionMiddleware(authMiddleware, key);
const basicAuthMiddleware = buildBasicAuthMiddleware(
  securityConfig.basicAuthUser,
  securityConfig.basicAuthPass
);

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5500,http://127.0.0.1:5500')
  .split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Origem não permitida'));
  },
  credentials: true,
}));

// Cabeçalhos de defesa em profundidade para a API. A CSP principal do frontend
// é enviada pelo Vercel (frontend/vercel.json).
app.use((req, res, next) => {
  if (req.path.startsWith('/docs')) {
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'");
    return next();
  }
  res.set({
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
  next();
});

// O Stripe exige o corpo exatamente como recebido para validar a assinatura.
// Este parser precisa ficar antes do express.json() global.
app.use('/api/pagamentos/stripe/webhook', express.raw({ type: 'application/json' }));
app.use('/api/pagamentos/webhook', express.raw({ type: 'application/json' }));
app.use('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }));
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));

// Sessões em cookie SameSite=None precisam de proteção explícita contra CSRF.
// Requisições mutáveis do site enviam este cabeçalho e só origens permitidas passam.
app.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (!String(req.headers.cookie || '').includes('fc_session=')) return next();
  const origin = req.headers.origin;
  if (!origin || !allowedOrigins.includes(origin) || req.get('X-CSRF-Protection') !== '1') {
    return res.status(403).json({ error: 'Requisição bloqueada pela proteção CSRF.', code: 'CSRF_BLOCKED' });
  }
  next();
});

// Documentação mínima da API (Swagger/OpenAPI), exigida pelo PDF do trabalho
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Sempre disponível — usada pelo keep-alive e pelo Render para health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: dbReady, timestamp: new Date().toISOString() });
});

// Bloqueia rotas de dados enquanto o banco não está pronto
let dbReady = false;
app.use('/api', (req, res, next) => {
  if (!dbReady) return res.status(503).json({ error: 'Servidor iniciando, tente novamente em instantes.' });
  next();
});

app.use('/api/auth', authRoutes({ authMiddleware, jwtSecret: JWT_SECRET, rateLimiters }));
app.use('/api/categorias', categoryRoutes(adminMiddleware));
app.use('/api/produtos', productRoutes({ adminMiddleware, perm }));
app.use('/api/pedidos', orderRoutes({
  adminMiddleware,
  authMiddleware,
  perm,
  trackingRateLimit: rateLimiters.tracking,
}));
app.use('/api/pagamentos', paymentRoutes({
  authMiddleware,
  checkoutRateLimit: rateLimiters.checkout,
  verifiedEmailMiddleware,
}));
app.use('/api/payments', paymentRoutes({
  authMiddleware,
  checkoutRateLimit: rateLimiters.checkout,
  verifiedEmailMiddleware,
}));
app.use('/api/config', configRoutes());
app.use('/api/admin/usuarios', userRoutes({ adminMiddleware, perm }));
app.use('/api/admin/dashboard', dashboardRoutes(perm('financeiro.visualizar')));
app.use('/api/cupons', couponRoutes(perm('cupons.criar')));
app.use('/api/promocoes', promocoesRoutes(adminMiddleware));
app.use('/api/admin/funcionarios', funcionariosRoutes(perm('administradores.gerenciar')));
app.use('/api/admin/logs', logRoutes(perm('administradores.gerenciar')));

// Rotas no formato exigido pelo PDF do trabalho (sem prefixo /api) — usadas pelo
// professor no Postman. O site continua usando as rotas /api/produtos acima.
app.use('/', specRoutes({
  basicAuthMiddleware,
  cartRateLimit: rateLimiters.cart,
  isDbReady: () => dbReady,
  optionalAuthMiddleware,
}));

app.use(errorHandler);

// Porta abre imediatamente — Render considera o deploy bem-sucedido
app.listen(PORT, () => {
  console.log(`[api] Fanaticos FC API listening on http://localhost:${PORT}`);
});

// Banco conecta em segundo plano com retentativas infinitas
async function connectWithRetry(delaySec = 30) {
  try {
    await init();
    dbReady = true;
    console.log('[api] Database ready.');
  } catch (err) {
    console.error(`[api:init:error] ${err.message} — retrying in ${delaySec}s`);
    setTimeout(() => connectWithRetry(Math.min(delaySec * 2, 300)), delaySec * 1000);
  }
}

connectWithRetry();
