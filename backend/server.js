const express = require('express');
const cors = require('cors');
const { init } = require('./src/config/database');
const { buildAdminMiddleware, buildAuthMiddleware } = require('./src/middleware/auth');
const { errorHandler } = require('./src/utils/http');
const authRoutes = require('./src/routes/authRoutes');
const categoryRoutes = require('./src/routes/categoryRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const productRoutes = require('./src/routes/productRoutes');
const userRoutes = require('./src/routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error('[api] JWT_SECRET não definido'); process.exit(1); }
const authMiddleware = buildAuthMiddleware(JWT_SECRET);
const adminMiddleware = buildAdminMiddleware(authMiddleware);

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5500,http://127.0.0.1:5500')
  .split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Origem não permitida'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes({ authMiddleware, jwtSecret: JWT_SECRET }));
app.use('/api/categorias', categoryRoutes);
app.use('/api/produtos', productRoutes(adminMiddleware));
app.use('/api/pedidos', orderRoutes({ adminMiddleware, authMiddleware }));
app.use('/api/admin/usuarios', userRoutes({ adminMiddleware }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[api] Fanaticos FC API listening on http://localhost:${PORT}`);
      console.log('[api] Default admin: admin@fanaticosfc.com');
    });
  })
  .catch((err) => {
    console.error('[api:init:error]', err);
    process.exit(1);
  });
