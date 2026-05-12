const express = require('express');
const cors = require('cors');
const { init } = require('./src/config/database');
const { buildAdminMiddleware, buildAuthMiddleware } = require('./src/middleware/auth');
const { errorHandler } = require('./src/utils/http');
const authRoutes = require('./src/routes/auth');
const categoriesRoutes = require('./src/routes/categories');
const ordersRoutes = require('./src/routes/orders');
const productsRoutes = require('./src/routes/produtos');
const usersRoutes = require('./src/routes/users');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'fanaticosfc_secret_key_2026';
const authMiddleware = buildAuthMiddleware(JWT_SECRET);
const adminMiddleware = buildAdminMiddleware(authMiddleware);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes({ authMiddleware, jwtSecret: JWT_SECRET }));
app.use('/api/categorias', categoriesRoutes);
app.use('/api/produtos', productsRoutes(adminMiddleware));
app.use('/api/pedidos', ordersRoutes({ adminMiddleware, authMiddleware }));
app.use('/api/admin/usuarios', usersRoutes({ adminMiddleware }));

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
