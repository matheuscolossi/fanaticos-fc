const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./src/docs/openapi');
const { init } = require('./src/config/database');
const { buildCommercialOpenapiSpec, loadAcademicApiConfig } = require('./src/config/academicApi');
const {
  buildAdminMiddleware,
  buildAuthMiddleware,
  buildBasicAuthMiddleware,
  buildOptionalAuthMiddleware,
  buildPermissionMiddleware,
  buildVerifiedEmailMiddleware,
} = require('./src/middleware/auth');
const { buildSecurityRateLimiters } = require('./src/middleware/rateLimit');
const { buildHttpSecurityHeaders } = require('./src/middleware/httpSecurity');
const { configureRequestBodyParsers } = require('./src/middleware/requestBody');
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
const reviewRoutes = require('./src/routes/reviewRoutes');
const commerceFeaturesRoutes = require('./src/routes/commerceFeaturesRoutes');
const { processAbandonedCarts, processRestockAlerts } = require('./src/services/commerceFeaturesService');
const specRoutes = require('./src/routes/specRoutes');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;
let academicApiConfig;
let securityConfig;
try {
  academicApiConfig = loadAcademicApiConfig(process.env);
  securityConfig = loadSecurityConfig(process.env, {
    requireBasicAuth: academicApiConfig.enabled,
  });
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
const basicAuthMiddleware = academicApiConfig.enabled
  ? buildBasicAuthMiddleware(securityConfig.basicAuthUser, securityConfig.basicAuthPass)
  : null;
const commercialOpenapiSpec = buildCommercialOpenapiSpec(openapiSpec);

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5500,http://127.0.0.1:5500')
  .split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Origem não permitida'));
  },
  credentials: true,
}));

// A CSP principal do frontend é enviada pelo Vercel (frontend/vercel.json).
app.use(buildHttpSecurityHeaders());
configureRequestBodyParsers(app);

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
app.use('/docs', swaggerUi.serve, swaggerUi.setup(commercialOpenapiSpec));

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
app.use('/api', rateLimiters.api);

app.use('/api/auth', authRoutes({ authMiddleware, jwtSecret: JWT_SECRET, rateLimiters }));
app.use('/api/categorias', categoryRoutes({ perm }));
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
app.use('/api/cupons', couponRoutes({ perm }));
app.use('/api/promocoes', promocoesRoutes({ perm }));
app.use('/api/avaliacoes', reviewRoutes({
  optionalAuthMiddleware,
  perm,
  verifiedEmailMiddleware,
}));
app.use('/api/recursos', commerceFeaturesRoutes({
  authMiddleware,
  optionalAuthMiddleware,
  perm,
  verifiedEmailMiddleware,
}));
app.use('/api/admin/funcionarios', funcionariosRoutes(perm('administradores.gerenciar')));
app.use('/api/admin/logs', logRoutes(perm('administradores.gerenciar')));

// Rotas no formato exigido pelo PDF do trabalho (sem prefixo /api) — usadas pelo
// professor no Postman. O site continua usando as rotas /api/produtos acima.
app.use('/', specRoutes({
  academicApi: {
    ...academicApiConfig,
    basicAuthMiddleware,
    rateLimit: rateLimiters.academicMutation,
  },
  cartRateLimit: rateLimiters.cart,
  isDbReady: () => dbReady,
  optionalAuthMiddleware,
  publicRateLimit: rateLimiters.publicRead,
}));

// Mantém o contrato JSON da API inclusive para versões de frontend que
// solicitarem uma rota ainda não publicada no backend.
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Rota da API não encontrada.',
    code: 'API_ROUTE_NOT_FOUND',
  });
});

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
    if (process.env.NODE_ENV === 'production') {
      processAbandonedCarts().catch((error) => console.error('[cart:abandonment:error]', error.message));
      processRestockAlerts().catch((error) => console.error('[restock:error]', error.message));
    }
  } catch (err) {
    console.error(`[api:init:error] ${err.message} — retrying in ${delaySec}s`);
    setTimeout(() => connectWithRetry(Math.min(delaySec * 2, 300)), delaySec * 1000);
  }
}

connectWithRetry();

if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    if (dbReady) processAbandonedCarts().catch((error) => console.error('[cart:abandonment:error]', error.message));
    if (dbReady) processRestockAlerts().catch((error) => console.error('[restock:error]', error.message));
  }, 15 * 60 * 1000).unref();
}
