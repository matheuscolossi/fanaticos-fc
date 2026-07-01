const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });

const DEFAULT_CATEGORIES = [
  'Brasileirão',
  'Times Internacionais',
  'Seleções',
  'Retrô',
  'Feminina',
  'Goleiro',
  'Treino',
  'Regata',
  'Jogador',
];

let isPostgres = Boolean(process.env.DATABASE_URL);
let sqliteDb = null;
let pgPool = null;

function toPostgresSql(sql) {
  let index = 0;
  return sql.replace(/JSON_VALUE\(\?\)|\?/g, (match) => {
    index += 1;
    return match.startsWith('JSON_VALUE') ? `$${index}::jsonb` : `$${index}`;
  });
}

function toSqliteSql(sql) {
  return sql.replace(/JSON_VALUE\(\?\)/g, '?');
}

function shouldReturnId(sql) {
  return /^\s*INSERT\s+/i.test(sql) && !/\bRETURNING\b/i.test(sql);
}

async function initPostgresClient() {
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS) || 15000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await pgPool.query('SELECT 1');
  console.log('[database] Connected: PostgreSQL');
}

function canFallbackToSqlite() {
  return process.env.DB_REQUIRE_POSTGRES !== 'true' && process.env.NODE_ENV !== 'production';
}

async function tryInitPostgresClient(retries = 4, delayMs = 5000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (pgPool) { await pgPool.end().catch(() => {}); pgPool = null; }
      await initPostgresClient();
      return;
    } catch (err) {
      console.warn(`[database] PostgreSQL attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs * attempt));
      } else {
        if (!canFallbackToSqlite()) throw err;
        isPostgres = false;
        console.warn('[database] Falling back to local SQLite.');
        await initSqliteClient();
      }
    }
  }
}

async function initSqliteClient() {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(__dirname, '../../data/fanaticos.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  sqliteDb = await new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });

  console.log('[database] Connected: SQLite', dbPath);
}

function runSqlite(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.run(toSqliteSql(sql), params, function onRun(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getSqlite(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.get(toSqliteSql(sql), params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allSqlite(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(toSqliteSql(sql), params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function runPostgres(sql, params = []) {
  const finalSql = toPostgresSql(shouldReturnId(sql) ? `${sql} RETURNING id` : sql);
  const result = await pgPool.query(finalSql, params);
  return { lastID: result.rows[0]?.id, changes: result.rowCount };
}

async function getPostgres(sql, params = []) {
  const result = await pgPool.query(toPostgresSql(sql), params);
  return result.rows[0];
}

async function allPostgres(sql, params = []) {
  const result = await pgPool.query(toPostgresSql(sql), params);
  return result.rows;
}

function run(sql, params = []) {
  return isPostgres ? runPostgres(sql, params) : runSqlite(sql, params);
}

function get(sql, params = []) {
  return isPostgres ? getPostgres(sql, params) : getSqlite(sql, params);
}

function all(sql, params = []) {
  return isPostgres ? allPostgres(sql, params) : allSqlite(sql, params);
}

async function close() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }

  if (sqliteDb) {
    await new Promise((resolve, reject) => {
      sqliteDb.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    sqliteDb = null;
  }
}

async function createPostgresSchema() {
  await run(`
    CREATE TABLE IF NOT EXISTS categorias (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS produtos (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      preco NUMERIC(10,2) NOT NULL,
      categoria_id INTEGER REFERENCES categorias(id),
      descricao TEXT,
      imagens JSONB DEFAULT '[]'::jsonb,
      estoque INTEGER DEFAULT 0,
      destaque BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL,
      perfil TEXT DEFAULT 'cliente',
      telefone TEXT,
      endereco_rua TEXT,
      cidade TEXT,
      cep TEXT,
      cargo TEXT,
      permissoes JSONB DEFAULT '[]'::jsonb,
      status TEXT DEFAULT 'ativo',
      ultimo_acesso TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER REFERENCES usuarios(id),
      itens JSONB NOT NULL,
      total NUMERIC(10,2) NOT NULL,
      status TEXT DEFAULT 'pendente',
      nome_cliente TEXT,
      email_cliente TEXT,
      telefone_cliente TEXT,
      endereco TEXT,
      metodo_pagamento TEXT DEFAULT 'whatsapp',
      codigo_rastreio TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS cupons (
      id SERIAL PRIMARY KEY,
      codigo TEXT NOT NULL UNIQUE,
      descricao TEXT,
      tipo_desconto TEXT NOT NULL DEFAULT 'percentual',
      valor NUMERIC(10,2) NOT NULL,
      valor_minimo_compra NUMERIC(10,2) DEFAULT 0,
      desconto_maximo NUMERIC(10,2),
      data_inicio TIMESTAMPTZ,
      data_fim TIMESTAMPTZ,
      limite_uso_total INTEGER,
      limite_uso_por_usuario INTEGER,
      produtos_ids JSONB DEFAULT '[]'::jsonb,
      categorias_ids JSONB DEFAULT '[]'::jsonb,
      clientes_ids JSONB DEFAULT '[]'::jsonb,
      frete_gratis BOOLEAN DEFAULT false,
      status TEXT DEFAULT 'ativo',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS promocoes (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      tipo TEXT NOT NULL DEFAULT 'percentual',
      valor NUMERIC(10,2),
      compre_qtd INTEGER,
      leve_qtd INTEGER,
      regras_progressivas JSONB DEFAULT '[]'::jsonb,
      produtos_ids JSONB DEFAULT '[]'::jsonb,
      categorias_ids JSONB DEFAULT '[]'::jsonb,
      data_inicio TIMESTAMPTZ,
      data_fim TIMESTAMPTZ,
      destaque BOOLEAN DEFAULT false,
      mostrar_contador BOOLEAN DEFAULT false,
      status TEXT DEFAULT 'ativo',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS logs_acoes (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER REFERENCES usuarios(id),
      usuario_nome TEXT,
      acao TEXT NOT NULL,
      detalhes TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
}

async function createSqliteSchema() {
  await run('PRAGMA foreign_keys = ON');
  await run('PRAGMA journal_mode = WAL');

  await run(`CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    preco REAL NOT NULL,
    categoria_id INTEGER,
    descricao TEXT,
    imagens TEXT DEFAULT '[]',
    estoque INTEGER DEFAULT 0,
    destaque INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha TEXT NOT NULL,
    perfil TEXT DEFAULT 'cliente',
    telefone TEXT,
    endereco_rua TEXT,
    cidade TEXT,
    cep TEXT,
    cargo TEXT,
    permissoes TEXT DEFAULT '[]',
    status TEXT DEFAULT 'ativo',
    ultimo_acesso DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    itens TEXT NOT NULL,
    total REAL NOT NULL,
    status TEXT DEFAULT 'pendente',
    nome_cliente TEXT,
    email_cliente TEXT,
    telefone_cliente TEXT,
    endereco TEXT,
    metodo_pagamento TEXT DEFAULT 'whatsapp',
    codigo_rastreio TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS cupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    descricao TEXT,
    tipo_desconto TEXT NOT NULL DEFAULT 'percentual',
    valor REAL NOT NULL,
    valor_minimo_compra REAL DEFAULT 0,
    desconto_maximo REAL,
    data_inicio DATETIME,
    data_fim DATETIME,
    limite_uso_total INTEGER,
    limite_uso_por_usuario INTEGER,
    produtos_ids TEXT DEFAULT '[]',
    categorias_ids TEXT DEFAULT '[]',
    clientes_ids TEXT DEFAULT '[]',
    frete_gratis INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ativo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS promocoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    tipo TEXT NOT NULL DEFAULT 'percentual',
    valor REAL,
    compre_qtd INTEGER,
    leve_qtd INTEGER,
    regras_progressivas TEXT DEFAULT '[]',
    produtos_ids TEXT DEFAULT '[]',
    categorias_ids TEXT DEFAULT '[]',
    data_inicio DATETIME,
    data_fim DATETIME,
    destaque INTEGER DEFAULT 0,
    mostrar_contador INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ativo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS logs_acoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    usuario_nome TEXT,
    acao TEXT NOT NULL,
    detalhes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  )`);
}

async function runOptionalMigration(sql) {
  try {
    await run(sql);
  } catch {
    // Existing local databases may already have these columns.
  }
}

async function runMigrations() {
  if (isPostgres) {
    await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cpf TEXT');
    await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone TEXT');
    await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS endereco_rua TEXT');
    await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cidade TEXT');
    await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cep TEXT');
    await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN DEFAULT false');
    await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo_verificacao TEXT');
    await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo_expira_em TIMESTAMP');
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nome_cliente TEXT');
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS email_cliente TEXT');
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS telefone_cliente TEXT');
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS endereco TEXT');
    await runOptionalMigration("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS metodo_pagamento TEXT DEFAULT 'whatsapp'");
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS codigo_rastreio TEXT');
    // Extended product fields
    await runOptionalMigration('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS slug TEXT');
    await runOptionalMigration('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS sku TEXT');
    await runOptionalMigration('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS descricao_curta TEXT');
    await runOptionalMigration('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS time TEXT');
    await runOptionalMigration('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS pais TEXT');
    await runOptionalMigration('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS competicao TEXT');
    await runOptionalMigration('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS temporada TEXT');
    await runOptionalMigration("ALTER TABLE produtos ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'torcedor'");
    await runOptionalMigration('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS marca TEXT');
    await runOptionalMigration("ALTER TABLE produtos ADD COLUMN IF NOT EXISTS genero TEXT DEFAULT 'masculino'");
    await runOptionalMigration('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS preco_promocional NUMERIC(10,2)');
    await runOptionalMigration('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS custo NUMERIC(10,2)');
    await runOptionalMigration('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS estoque_minimo INTEGER DEFAULT 0');
    await runOptionalMigration("ALTER TABLE produtos ADD COLUMN IF NOT EXISTS tamanhos JSONB DEFAULT '[]'::jsonb");
    await runOptionalMigration("ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cores JSONB DEFAULT '[]'::jsonb");
    await runOptionalMigration("ALTER TABLE produtos ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo'");
    await runOptionalMigration('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS produto_novo BOOLEAN DEFAULT false');
    await runOptionalMigration('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS produto_promocional BOOLEAN DEFAULT false');
    await runOptionalMigration('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS peso NUMERIC(8,3)');
    await runOptionalMigration("ALTER TABLE produtos ADD COLUMN IF NOT EXISTS dimensoes JSONB DEFAULT '{}'::jsonb");
    await runOptionalMigration('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS info_lavagem TEXT');
    await runOptionalMigration('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS keywords TEXT');
    await runOptionalMigration('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS meta_titulo TEXT');
    await runOptionalMigration('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS meta_descricao TEXT');
    // Extended category fields
    await runOptionalMigration('ALTER TABLE categorias ADD COLUMN IF NOT EXISTS imagem TEXT');
    await runOptionalMigration('ALTER TABLE categorias ADD COLUMN IF NOT EXISTS categoria_pai_id INTEGER REFERENCES categorias(id)');
    await runOptionalMigration('ALTER TABLE categorias ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 0');
    await runOptionalMigration("ALTER TABLE categorias ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo'");
    // Rastreio de cupom aplicado no pedido
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cupom_codigo TEXT');
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cupom_desconto NUMERIC(10,2)');
    // Funcionários/administradores: cargo, permissões granulares, acesso e auditoria
    await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cargo TEXT');
    await runOptionalMigration("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permissoes JSONB DEFAULT '[]'::jsonb");
    await runOptionalMigration("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo'");
    await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMPTZ');
    return;
  }

  await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN cpf TEXT');
  await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN telefone TEXT');
  await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN endereco_rua TEXT');
  await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN cidade TEXT');
  await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN cep TEXT');
  await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN email_verificado INTEGER DEFAULT 0');
  await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN codigo_verificacao TEXT');
  await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN codigo_expira_em TEXT');
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN nome_cliente TEXT');
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN email_cliente TEXT');
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN telefone_cliente TEXT');
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN endereco TEXT');
  await runOptionalMigration("ALTER TABLE pedidos ADD COLUMN metodo_pagamento TEXT DEFAULT 'whatsapp'");
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN codigo_rastreio TEXT');
  // Extended product fields
  await runOptionalMigration('ALTER TABLE produtos ADD COLUMN slug TEXT');
  await runOptionalMigration('ALTER TABLE produtos ADD COLUMN sku TEXT');
  await runOptionalMigration('ALTER TABLE produtos ADD COLUMN descricao_curta TEXT');
  await runOptionalMigration('ALTER TABLE produtos ADD COLUMN time TEXT');
  await runOptionalMigration('ALTER TABLE produtos ADD COLUMN pais TEXT');
  await runOptionalMigration('ALTER TABLE produtos ADD COLUMN competicao TEXT');
  await runOptionalMigration('ALTER TABLE produtos ADD COLUMN temporada TEXT');
  await runOptionalMigration("ALTER TABLE produtos ADD COLUMN tipo TEXT DEFAULT 'torcedor'");
  await runOptionalMigration('ALTER TABLE produtos ADD COLUMN marca TEXT');
  await runOptionalMigration("ALTER TABLE produtos ADD COLUMN genero TEXT DEFAULT 'masculino'");
  await runOptionalMigration('ALTER TABLE produtos ADD COLUMN preco_promocional REAL');
  await runOptionalMigration('ALTER TABLE produtos ADD COLUMN custo REAL');
  await runOptionalMigration('ALTER TABLE produtos ADD COLUMN estoque_minimo INTEGER DEFAULT 0');
  await runOptionalMigration("ALTER TABLE produtos ADD COLUMN tamanhos TEXT DEFAULT '[]'");
  await runOptionalMigration("ALTER TABLE produtos ADD COLUMN cores TEXT DEFAULT '[]'");
  await runOptionalMigration("ALTER TABLE produtos ADD COLUMN status TEXT DEFAULT 'ativo'");
  await runOptionalMigration('ALTER TABLE produtos ADD COLUMN produto_novo INTEGER DEFAULT 0');
  await runOptionalMigration('ALTER TABLE produtos ADD COLUMN produto_promocional INTEGER DEFAULT 0');
  await runOptionalMigration('ALTER TABLE produtos ADD COLUMN peso REAL');
  await runOptionalMigration("ALTER TABLE produtos ADD COLUMN dimensoes TEXT DEFAULT '{}'");
  await runOptionalMigration('ALTER TABLE produtos ADD COLUMN info_lavagem TEXT');
  await runOptionalMigration('ALTER TABLE produtos ADD COLUMN keywords TEXT');
  await runOptionalMigration('ALTER TABLE produtos ADD COLUMN meta_titulo TEXT');
  await runOptionalMigration('ALTER TABLE produtos ADD COLUMN meta_descricao TEXT');
  // Extended category fields
  await runOptionalMigration('ALTER TABLE categorias ADD COLUMN imagem TEXT');
  await runOptionalMigration('ALTER TABLE categorias ADD COLUMN categoria_pai_id INTEGER REFERENCES categorias(id)');
  await runOptionalMigration('ALTER TABLE categorias ADD COLUMN ordem INTEGER DEFAULT 0');
  await runOptionalMigration("ALTER TABLE categorias ADD COLUMN status TEXT DEFAULT 'ativo'");
  // Rastreio de cupom aplicado no pedido
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN cupom_codigo TEXT');
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN cupom_desconto REAL');
  // Funcionários/administradores: cargo, permissões granulares, acesso e auditoria
  await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN cargo TEXT');
  await runOptionalMigration("ALTER TABLE usuarios ADD COLUMN permissoes TEXT DEFAULT '[]'");
  await runOptionalMigration("ALTER TABLE usuarios ADD COLUMN status TEXT DEFAULT 'ativo'");
  await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN ultimo_acesso DATETIME');
}

async function seedDefaults() {
  const cats = await get('SELECT COUNT(*) as c FROM categorias');
  if (Number(cats.c) === 0) {
    for (const nome of DEFAULT_CATEGORIES) {
      await run('INSERT INTO categorias (nome) VALUES (?)', [nome]);
    }
    console.log('[database] Default categories inserted.');
  }

  const admin = await get("SELECT COUNT(*) as c FROM usuarios WHERE perfil='admin'");
  if (Number(admin.c) === 0) {
    const { PERMISSOES_KEYS } = require('../constants/permissions');
    const hash = bcrypt.hashSync(process.env.DEFAULT_ADMIN_PASSWORD || 'admin123', 10);
    await run(
      `INSERT INTO usuarios (nome, email, senha, perfil, cargo, permissoes, status) VALUES (?, ?, ?, ?, ?, JSON_VALUE(?), ?)`,
      [
        'Administrador',
        process.env.DEFAULT_ADMIN_EMAIL || 'admin@fanaticosfc.com',
        hash,
        'admin',
        'Administrador',
        JSON.stringify(PERMISSOES_KEYS),
        'ativo',
      ]
    );
    console.log('[database] Default admin created.');
  }

  // Migra admins criados antes do sistema de permissões granulares (cargo
  // ainda nulo) para terem acesso total — evita travar quem já era admin.
  const adminsLegados = await all("SELECT id FROM usuarios WHERE perfil = 'admin' AND cargo IS NULL");
  if (adminsLegados.length > 0) {
    const { PERMISSOES_KEYS } = require('../constants/permissions');
    for (const u of adminsLegados) {
      await run(
        `UPDATE usuarios SET cargo = ?, permissoes = JSON_VALUE(?), status = 'ativo' WHERE id = ?`,
        ['Administrador', JSON.stringify(PERMISSOES_KEYS), u.id]
      );
    }
    console.log(`[database] ${adminsLegados.length} admin(s) legado(s) migrado(s) com todas as permissões.`);
  }

  const cupons = await get('SELECT COUNT(*) as c FROM cupons');
  if (Number(cupons.c) === 0) {
    await run(
      `INSERT INTO cupons (codigo, descricao, tipo_desconto, valor, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['URI10', 'Cupom de exemplo — 10% de desconto', 'percentual', 10, 'ativo']
    );
    console.log('[database] Default coupon (URI10) inserted.');
  }
}

async function init() {
  if (isPostgres) await tryInitPostgresClient();
  else await initSqliteClient();

  if (isPostgres) await createPostgresSchema();
  else await createSqliteSchema();

  await runMigrations();
  await seedDefaults();
  console.log('[database] Initialized.');
}

module.exports = { all, close, get, init, isPostgres, run };
