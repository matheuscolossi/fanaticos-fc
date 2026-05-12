const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { run, get, all, init } = require('./src/config/database');
const produtosRoutes = require('./src/routes/produtos');

const app = express();
const PORT = 3001;
const JWT_SECRET = 'fanaticosfc_secret_key_2026';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── Middleware de autenticação ──────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function adminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user.perfil !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
    next();
  });
}

// ── AUTH ───────────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    const existing = await get('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'E-mail já cadastrado' });
    const hash = bcrypt.hashSync(senha, 10);
    const result = await run('INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)', [nome, email, hash]);
    res.status(201).json({ message: 'Usuário criado', id: result.lastID });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    const user = await get('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (!user || !bcrypt.compareSync(senha, user.senha))
      return res.status(401).json({ error: 'Credenciais inválidas' });
    const token = jwt.sign(
      { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil },
      JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CATEGORIAS ────────────────────────────────────────────────────────────
app.get('/api/categorias', async (req, res) => {
  try {
    const cats = await all('SELECT * FROM categorias ORDER BY nome');
    res.json(cats);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PRODUTOS ──────────────────────────────────────────────────────────────
app.use('/api/produtos', produtosRoutes(adminMiddleware));

// ── PEDIDOS ───────────────────────────────────────────────────────────────
app.post('/api/pedidos', async (req, res) => {
  try {
    const { itens, total, usuario_id, nome_cliente, email_cliente, telefone_cliente, endereco, metodo_pagamento } = req.body;
    if (!itens || !total) return res.status(400).json({ error: 'Dados do pedido inválidos' });
    const status = metodo_pagamento === 'pix' ? 'aguardando_pagamento' : 'pendente';
    const result = await run(
      `INSERT INTO pedidos (usuario_id, itens, total, nome_cliente, email_cliente, telefone_cliente, endereco, metodo_pagamento, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [usuario_id || null, JSON.stringify(itens), total,
       nome_cliente || null, email_cliente || null, telefone_cliente || null,
       endereco || null, metodo_pagamento || 'whatsapp', status]
    );
    res.status(201).json({ message: 'Pedido registrado', id: result.lastID });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/pedidos', adminMiddleware, async (req, res) => {
  try {
    const pedidos = await all('SELECT * FROM pedidos ORDER BY created_at DESC');
    res.json(pedidos.map(p => ({ ...p, itens: JSON.parse(p.itens) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Rastreamento público por ID (dados limitados)
app.get('/api/pedidos/:id/rastreio', async (req, res) => {
  try {
    const p = await get(
      'SELECT id, status, codigo_rastreio, metodo_pagamento, total, nome_cliente, created_at FROM pedidos WHERE id = ?',
      [req.params.id]
    );
    if (!p) return res.status(404).json({ error: 'Pedido não encontrado' });
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Atualizar pedido (admin): status e código de rastreio
app.put('/api/pedidos/:id', adminMiddleware, async (req, res) => {
  try {
    const { status, codigo_rastreio } = req.body;
    const existing = await get('SELECT id FROM pedidos WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Pedido não encontrado' });
    await run(
      'UPDATE pedidos SET status = COALESCE(?, status), codigo_rastreio = COALESCE(?, codigo_rastreio) WHERE id = ?',
      [status || null, codigo_rastreio !== undefined ? codigo_rastreio : null, req.params.id]
    );
    res.json({ message: 'Pedido atualizado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ADMIN – USUÁRIOS ──────────────────────────────────────────────────────
app.get('/api/admin/usuarios', adminMiddleware, async (req, res) => {
  try {
    const users = await all('SELECT id, nome, email, perfil, created_at FROM usuarios ORDER BY created_at DESC');
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Pedidos do usuário logado (por email ou usuario_id)
app.get('/api/pedidos/meus', authMiddleware, async (req, res) => {
  try {
    const pedidos = await all(
      `SELECT * FROM pedidos WHERE email_cliente = ? OR usuario_id = ? ORDER BY created_at DESC`,
      [req.user.email, req.user.id]
    );
    res.json(pedidos.map(p => ({ ...p, itens: JSON.parse(p.itens || '[]') })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PERFIL DO USUÁRIO ─────────────────────────────────────────────────────
app.get('/api/auth/perfil', authMiddleware, async (req, res) => {
  try {
    const user = await get(
      'SELECT id, nome, email, perfil, telefone, endereco_rua, cidade, cep FROM usuarios WHERE id = ?',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/auth/perfil', authMiddleware, async (req, res) => {
  try {
    const { nome, senhaAtual, novaSenha, telefone, endereco_rua, cidade, cep } = req.body;
    const user = await get('SELECT * FROM usuarios WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (novaSenha) {
      if (!senhaAtual) return res.status(400).json({ error: 'Informe a senha atual' });
      if (!bcrypt.compareSync(senhaAtual, user.senha))
        return res.status(401).json({ error: 'Senha atual incorreta' });
      const hash = bcrypt.hashSync(novaSenha, 10);
      await run('UPDATE usuarios SET nome = ?, senha = ? WHERE id = ?', [nome || user.nome, hash, req.user.id]);
    } else if (telefone !== undefined || endereco_rua !== undefined || cidade !== undefined || cep !== undefined) {
      await run(
        'UPDATE usuarios SET telefone = ?, endereco_rua = ?, cidade = ?, cep = ? WHERE id = ?',
        [telefone ?? user.telefone, endereco_rua ?? user.endereco_rua, cidade ?? user.cidade, cep ?? user.cep, req.user.id]
      );
    } else {
      if (!nome) return res.status(400).json({ error: 'Informe o nome' });
      await run('UPDATE usuarios SET nome = ? WHERE id = ?', [nome, req.user.id]);
    }
    const updated = await get(
      'SELECT id, nome, email, perfil, telefone, endereco_rua, cidade, cep FROM usuarios WHERE id = ?',
      [req.user.id]
    );
    res.json({ message: 'Perfil atualizado', user: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── HEALTH ────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── START ─────────────────────────────────────────────────────────────────
init().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Fanáticos FC API rodando em http://localhost:${PORT}`);
    console.log(`📧 Admin: admin@fanaticosfc.com | Senha: admin123\n`);
  });
}).catch(err => {
  console.error('Erro ao inicializar banco:', err);
  process.exit(1);
});
