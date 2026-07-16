const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { normalizeEmail } = require('../validation/userSchemas');

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
let sqliteTransactionQueue = Promise.resolve();

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

async function transaction(work) {
  if (isPostgres) {
    const client = await pgPool.connect();
    const tx = {
      run: async (sql, params = []) => {
        const finalSql = toPostgresSql(shouldReturnId(sql) ? `${sql} RETURNING id` : sql);
        const result = await client.query(finalSql, params);
        return { lastID: result.rows[0]?.id, changes: result.rowCount };
      },
      get: async (sql, params = []) => {
        const result = await client.query(toPostgresSql(sql), params);
        return result.rows[0];
      },
      all: async (sql, params = []) => {
        const result = await client.query(toPostgresSql(sql), params);
        return result.rows;
      },
    };

    try {
      await client.query('BEGIN');
      const result = await work(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  const execute = async () => {
    await runSqlite('BEGIN IMMEDIATE TRANSACTION');
    const tx = { run: runSqlite, get: getSqlite, all: allSqlite };
    try {
      const result = await work(tx);
      await runSqlite('COMMIT');
      return result;
    } catch (error) {
      await runSqlite('ROLLBACK').catch(() => {});
      throw error;
    }
  };
  const queued = sqliteTransactionQueue.then(execute, execute);
  sqliteTransactionQueue = queued.catch(() => {});
  return queued;
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
      estoque_reservado INTEGER NOT NULL DEFAULT 0,
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
      email_verificado BOOLEAN DEFAULT false,
      codigo_verificacao TEXT,
      codigo_expira_em TIMESTAMPTZ,
      codigo_ultimo_envio_em TIMESTAMPTZ,
      codigo_janela_inicio_em TIMESTAMPTZ,
      codigo_envios_na_janela INTEGER NOT NULL DEFAULT 0,
      codigo_tentativas INTEGER NOT NULL DEFAULT 0,
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
      metodo_pagamento TEXT DEFAULT 'stripe',
      codigo_rastreio TEXT,
      stripe_session_id TEXT,
      stripe_payment_intent_id TEXT,
      stripe_customer_id TEXT,
      stripe_event_id TEXT,
      payment_status TEXT DEFAULT 'unpaid',
      currency TEXT DEFAULT 'BRL',
      shipping_address JSONB,
      stock_status TEXT NOT NULL DEFAULT 'none',
      cancelado_em TIMESTAMPTZ,
      cancelado_por INTEGER,
      motivo_cancelamento TEXT,
      arquivado_em TIMESTAMPTZ,
      arquivado_por INTEGER,
      motivo_arquivamento TEXT,
      updated_at TIMESTAMPTZ DEFAULT now(),
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS produto_variantes (
      id SERIAL PRIMARY KEY,
      produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
      tamanho TEXT NOT NULL,
      estoque INTEGER NOT NULL DEFAULT 0,
      estoque_reservado INTEGER NOT NULL DEFAULT 0,
      UNIQUE (produto_id, tamanho)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS pedido_itens (
      id SERIAL PRIMARY KEY,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE RESTRICT,
      produto_id INTEGER,
      nome TEXT NOT NULL,
      preco_unitario NUMERIC(10,2) NOT NULL,
      quantidade INTEGER NOT NULL,
      tamanho TEXT,
      variacao JSONB DEFAULT '{}'::jsonb,
      subtotal NUMERIC(10,2) NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS pedido_eventos (
      id SERIAL PRIMARY KEY,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE RESTRICT,
      tipo TEXT NOT NULL,
      status_anterior TEXT,
      status_novo TEXT,
      ator_id INTEGER,
      ator_nome TEXT,
      motivo TEXT,
      detalhes JSONB DEFAULT '{}'::jsonb,
      chave_idempotencia TEXT UNIQUE,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS avaliacoes (
      id SERIAL PRIMARY KEY,
      produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE RESTRICT,
      pedido_item_id INTEGER REFERENCES pedido_itens(id) ON DELETE RESTRICT,
      autor_nome TEXT NOT NULL,
      nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
      titulo TEXT,
      comentario TEXT NOT NULL,
      compra_verificada BOOLEAN NOT NULL DEFAULT true CHECK (compra_verificada = true),
      status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'rejeitada')),
      motivo_moderacao TEXT,
      moderado_por INTEGER,
      moderado_em TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (usuario_id, produto_id)
    )
  `);
  await run('CREATE INDEX IF NOT EXISTS avaliacoes_produto_status_idx ON avaliacoes(produto_id, status, created_at)');
  await run('CREATE INDEX IF NOT EXISTS avaliacoes_status_idx ON avaliacoes(status, created_at)');

  await run(`
    CREATE TABLE IF NOT EXISTS checkout_drafts (
      id TEXT PRIMARY KEY,
      usuario_id INTEGER REFERENCES usuarios(id),
      itens JSONB NOT NULL,
      subtotal NUMERIC(10,2) NOT NULL,
      frete NUMERIC(10,2) NOT NULL DEFAULT 0,
      desconto NUMERIC(10,2) NOT NULL DEFAULT 0,
      total NUMERIC(10,2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'BRL',
      nome_cliente TEXT,
      email_cliente TEXT,
      telefone_cliente TEXT,
      endereco TEXT,
      uf TEXT,
      cupom_codigo TEXT,
      status TEXT NOT NULL DEFAULT 'created',
      stripe_session_id TEXT,
      stock_status TEXT NOT NULL DEFAULT 'none',
      stock_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS stripe_webhook_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
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

  await run(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      scope TEXT NOT NULL,
      identifier_hash TEXT NOT NULL,
      window_key BIGINT NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (scope, identifier_hash, window_key)
    )
  `);
  await run('CREATE INDEX IF NOT EXISTS rate_limits_expires_idx ON rate_limits(expires_at)');
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
    estoque_reservado INTEGER NOT NULL DEFAULT 0,
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
    email_verificado INTEGER DEFAULT 0,
    codigo_verificacao TEXT,
    codigo_expira_em DATETIME,
    codigo_ultimo_envio_em DATETIME,
    codigo_janela_inicio_em DATETIME,
    codigo_envios_na_janela INTEGER NOT NULL DEFAULT 0,
    codigo_tentativas INTEGER NOT NULL DEFAULT 0,
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
    metodo_pagamento TEXT DEFAULT 'stripe',
    codigo_rastreio TEXT,
    stripe_session_id TEXT,
    stripe_payment_intent_id TEXT,
    stripe_customer_id TEXT,
    stripe_event_id TEXT,
    payment_status TEXT DEFAULT 'unpaid',
    currency TEXT DEFAULT 'BRL',
    shipping_address TEXT,
    stock_status TEXT NOT NULL DEFAULT 'none',
    cancelado_em DATETIME,
    cancelado_por INTEGER,
    motivo_cancelamento TEXT,
    arquivado_em DATETIME,
    arquivado_por INTEGER,
    motivo_arquivamento TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS produto_variantes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id INTEGER NOT NULL,
    tamanho TEXT NOT NULL,
    estoque INTEGER NOT NULL DEFAULT 0,
    estoque_reservado INTEGER NOT NULL DEFAULT 0,
    UNIQUE (produto_id, tamanho),
    FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
  )`);

  await run(`CREATE TABLE IF NOT EXISTS pedido_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    produto_id INTEGER,
    nome TEXT NOT NULL,
    preco_unitario REAL NOT NULL,
    quantidade INTEGER NOT NULL,
    tamanho TEXT,
    variacao TEXT DEFAULT '{}',
    subtotal REAL NOT NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE RESTRICT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS pedido_eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    status_anterior TEXT,
    status_novo TEXT,
    ator_id INTEGER,
    ator_nome TEXT,
    motivo TEXT,
    detalhes TEXT DEFAULT '{}',
    chave_idempotencia TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE RESTRICT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS avaliacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id INTEGER NOT NULL,
    usuario_id INTEGER,
    pedido_id INTEGER NOT NULL,
    pedido_item_id INTEGER,
    autor_nome TEXT NOT NULL,
    nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
    titulo TEXT,
    comentario TEXT NOT NULL,
    compra_verificada INTEGER NOT NULL DEFAULT 1 CHECK (compra_verificada = 1),
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'rejeitada')),
    motivo_moderacao TEXT,
    moderado_por INTEGER,
    moderado_em DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (usuario_id, produto_id),
    FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE RESTRICT,
    FOREIGN KEY (pedido_item_id) REFERENCES pedido_itens(id) ON DELETE RESTRICT
  )`);
  await run('CREATE INDEX IF NOT EXISTS avaliacoes_produto_status_idx ON avaliacoes(produto_id, status, created_at)');
  await run('CREATE INDEX IF NOT EXISTS avaliacoes_status_idx ON avaliacoes(status, created_at)');

  await run(`CREATE TABLE IF NOT EXISTS checkout_drafts (
    id TEXT PRIMARY KEY,
    usuario_id INTEGER,
    itens TEXT NOT NULL,
    subtotal REAL NOT NULL,
    frete REAL NOT NULL DEFAULT 0,
    desconto REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BRL',
    nome_cliente TEXT,
    email_cliente TEXT,
    telefone_cliente TEXT,
    endereco TEXT,
    uf TEXT,
    cupom_codigo TEXT,
    status TEXT NOT NULL DEFAULT 'created',
    stripe_session_id TEXT,
    stock_status TEXT NOT NULL DEFAULT 'none',
    stock_expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
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

  await run(`CREATE TABLE IF NOT EXISTS rate_limits (
    scope TEXT NOT NULL,
    identifier_hash TEXT NOT NULL,
    window_key INTEGER NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (scope, identifier_hash, window_key)
  )`);
  await run('CREATE INDEX IF NOT EXISTS rate_limits_expires_idx ON rate_limits(expires_at)');
}

async function runOptionalMigration(sql) {
  try {
    await run(sql);
  } catch {
    // Existing local databases may already have these columns.
  }
}

async function installPostgresValidationConstraints() {
  // Canonicaliza registros legados antes de começar a exigir o formato novo.
  await runOptionalMigration(`UPDATE usuarios SET email = LOWER(BTRIM(email))
    WHERE email <> LOWER(BTRIM(email))
      AND NOT EXISTS (
        SELECT 1 FROM usuarios outro
        WHERE outro.id <> usuarios.id AND LOWER(BTRIM(outro.email)) = LOWER(BTRIM(usuarios.email))
      )`);
  await runOptionalMigration(`UPDATE usuarios SET cpf = REGEXP_REPLACE(cpf, '[^0-9]', '', 'g')
    WHERE cpf IS NOT NULL AND LENGTH(REGEXP_REPLACE(cpf, '[^0-9]', '', 'g')) = 11`);
  await runOptionalMigration(`UPDATE usuarios SET telefone = REGEXP_REPLACE(telefone, '[^0-9]', '', 'g')
    WHERE telefone IS NOT NULL AND LENGTH(REGEXP_REPLACE(telefone, '[^0-9]', '', 'g')) IN (10, 11)`);
  await runOptionalMigration(`UPDATE usuarios SET cep = REGEXP_REPLACE(cep, '[^0-9]', '', 'g')
    WHERE cep IS NOT NULL AND LENGTH(REGEXP_REPLACE(cep, '[^0-9]', '', 'g')) = 8`);

  await run(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'produtos_dados_validos_ck') THEN
      ALTER TABLE produtos ADD CONSTRAINT produtos_dados_validos_ck CHECK (
        nome IS NOT NULL AND CHAR_LENGTH(BTRIM(nome)) BETWEEN 1 AND 200
        AND preco IS NOT NULL AND preco BETWEEN 0.01 AND 99999999.99
        AND (preco_promocional IS NULL OR preco_promocional BETWEEN 0.01 AND preco)
        AND (custo IS NULL OR custo BETWEEN 0 AND 99999999.99)
        AND estoque IS NOT NULL AND estoque BETWEEN 0 AND 1000000
        AND estoque_minimo IS NOT NULL AND estoque_minimo BETWEEN 0 AND 1000000
        AND estoque_reservado IS NOT NULL AND estoque_reservado BETWEEN 0 AND estoque
        AND status IS NOT NULL AND status IN ('ativo', 'inativo')
        AND tipo IS NOT NULL AND tipo IN ('torcedor', 'jogador', 'retro', 'infantil')
        AND genero IS NOT NULL AND genero IN ('masculino', 'feminino', 'infantil', 'unissex')
        AND (peso IS NULL OR peso BETWEEN 0 AND 10000)
      ) NOT VALID;
    END IF;
  END $$`);
  await run(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'produto_variantes_dados_validos_ck') THEN
      ALTER TABLE produto_variantes ADD CONSTRAINT produto_variantes_dados_validos_ck CHECK (
        CHAR_LENGTH(BTRIM(tamanho)) BETWEEN 1 AND 20
        AND estoque BETWEEN 0 AND 1000000
        AND estoque_reservado BETWEEN 0 AND estoque
      ) NOT VALID;
    END IF;
  END $$`);
  await run(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_dados_canonicos_ck') THEN
      ALTER TABLE usuarios ADD CONSTRAINT usuarios_dados_canonicos_ck CHECK (
        CHAR_LENGTH(BTRIM(nome)) BETWEEN 2 AND 100
        AND CHAR_LENGTH(email) BETWEEN 3 AND 254
        AND email = LOWER(BTRIM(email))
        AND email ~ '^[^[:space:]@<>"()]+@[^[:space:]@<>"()]+\\.[^[:space:]@<>"()]+$'
        AND (cpf IS NULL OR cpf ~ '^[0-9]{11}$')
        AND (telefone IS NULL OR telefone ~ '^[0-9]{10,11}$')
        AND (cep IS NULL OR cep ~ '^[0-9]{8}$')
        AND (endereco_rua IS NULL OR CHAR_LENGTH(endereco_rua) <= 200)
        AND (cidade IS NULL OR CHAR_LENGTH(cidade) <= 100)
      ) NOT VALID;
    END IF;
  END $$`);
}

async function installSqliteValidationTriggers() {
  const stripFormatting = (column) =>
    `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${column}, '.', ''), '-', ''), '(', ''), ')', ''), ' ', ''), '+', '')`;
  await runOptionalMigration(`UPDATE usuarios SET email = LOWER(TRIM(email))
    WHERE email <> LOWER(TRIM(email))
      AND NOT EXISTS (
        SELECT 1 FROM usuarios outro
        WHERE outro.id <> usuarios.id AND LOWER(TRIM(outro.email)) = LOWER(TRIM(usuarios.email))
      )`);
  await runOptionalMigration(`UPDATE usuarios SET cpf = ${stripFormatting('cpf')}
    WHERE cpf IS NOT NULL AND LENGTH(${stripFormatting('cpf')}) = 11`);
  await runOptionalMigration(`UPDATE usuarios SET telefone = ${stripFormatting('telefone')}
    WHERE telefone IS NOT NULL AND LENGTH(${stripFormatting('telefone')}) IN (10, 11)`);
  await runOptionalMigration(`UPDATE usuarios SET cep = ${stripFormatting('cep')}
    WHERE cep IS NOT NULL AND LENGTH(${stripFormatting('cep')}) = 8`);

  const productRule = `
    NEW.nome IS NULL OR LENGTH(TRIM(NEW.nome)) NOT BETWEEN 1 AND 200
    OR NEW.preco IS NULL OR TYPEOF(NEW.preco) NOT IN ('integer', 'real') OR NEW.preco < 0.01 OR NEW.preco > 99999999.99
    OR (NEW.preco_promocional IS NOT NULL AND (TYPEOF(NEW.preco_promocional) NOT IN ('integer', 'real') OR NEW.preco_promocional < 0.01 OR NEW.preco_promocional > NEW.preco))
    OR (NEW.custo IS NOT NULL AND (TYPEOF(NEW.custo) NOT IN ('integer', 'real') OR NEW.custo < 0 OR NEW.custo > 99999999.99))
    OR TYPEOF(NEW.estoque) <> 'integer' OR NEW.estoque < 0 OR NEW.estoque > 1000000
    OR TYPEOF(NEW.estoque_minimo) <> 'integer' OR NEW.estoque_minimo < 0 OR NEW.estoque_minimo > 1000000
    OR TYPEOF(NEW.estoque_reservado) <> 'integer' OR NEW.estoque_reservado < 0 OR NEW.estoque_reservado > NEW.estoque
    OR NEW.status IS NULL OR NEW.status NOT IN ('ativo', 'inativo')
    OR NEW.tipo IS NULL OR NEW.tipo NOT IN ('torcedor', 'jogador', 'retro', 'infantil')
    OR NEW.genero IS NULL OR NEW.genero NOT IN ('masculino', 'feminino', 'infantil', 'unissex')
    OR (NEW.peso IS NOT NULL AND (TYPEOF(NEW.peso) NOT IN ('integer', 'real') OR NEW.peso < 0 OR NEW.peso > 10000))`;
  const userRule = `
    NEW.nome IS NULL OR LENGTH(TRIM(NEW.nome)) NOT BETWEEN 2 AND 100
    OR NEW.email IS NULL OR LENGTH(NEW.email) NOT BETWEEN 3 AND 254
    OR NEW.email <> LOWER(TRIM(NEW.email)) OR NEW.email NOT LIKE '%_@_%._%'
    OR (NEW.cpf IS NOT NULL AND (LENGTH(NEW.cpf) <> 11 OR NEW.cpf GLOB '*[^0-9]*'))
    OR (NEW.telefone IS NOT NULL AND (LENGTH(NEW.telefone) NOT IN (10, 11) OR NEW.telefone GLOB '*[^0-9]*'))
    OR (NEW.cep IS NOT NULL AND (LENGTH(NEW.cep) <> 8 OR NEW.cep GLOB '*[^0-9]*'))
    OR (NEW.endereco_rua IS NOT NULL AND LENGTH(NEW.endereco_rua) > 200)
    OR (NEW.cidade IS NOT NULL AND LENGTH(NEW.cidade) > 100)`;
  const variantRule = `
    NEW.tamanho IS NULL OR LENGTH(TRIM(NEW.tamanho)) NOT BETWEEN 1 AND 20
    OR TYPEOF(NEW.estoque) <> 'integer' OR NEW.estoque < 0 OR NEW.estoque > 1000000
    OR TYPEOF(NEW.estoque_reservado) <> 'integer' OR NEW.estoque_reservado < 0 OR NEW.estoque_reservado > NEW.estoque`;

  for (const trigger of [
    'produtos_validar_insert',
    'produtos_validar_update',
    'usuarios_validar_insert',
    'usuarios_validar_update',
    'produto_variantes_validar_insert',
    'produto_variantes_validar_update',
  ]) {
    await run(`DROP TRIGGER IF EXISTS ${trigger}`);
  }
  await run(`CREATE TRIGGER IF NOT EXISTS produtos_validar_insert
    BEFORE INSERT ON produtos WHEN ${productRule}
    BEGIN SELECT RAISE(ABORT, 'produtos_dados_invalidos'); END`);
  await run(`CREATE TRIGGER IF NOT EXISTS produtos_validar_update
    BEFORE UPDATE ON produtos WHEN ${productRule}
    BEGIN SELECT RAISE(ABORT, 'produtos_dados_invalidos'); END`);
  await run(`CREATE TRIGGER IF NOT EXISTS usuarios_validar_insert
    BEFORE INSERT ON usuarios WHEN ${userRule}
    BEGIN SELECT RAISE(ABORT, 'usuarios_dados_invalidos'); END`);
  await run(`CREATE TRIGGER IF NOT EXISTS usuarios_validar_update
    BEFORE UPDATE OF nome, email, cpf, telefone, cep, endereco_rua, cidade ON usuarios WHEN ${userRule}
    BEGIN SELECT RAISE(ABORT, 'usuarios_dados_invalidos'); END`);
  await run(`CREATE TRIGGER IF NOT EXISTS produto_variantes_validar_insert
    BEFORE INSERT ON produto_variantes WHEN ${variantRule}
    BEGIN SELECT RAISE(ABORT, 'produto_variantes_dados_invalidos'); END`);
  await run(`CREATE TRIGGER IF NOT EXISTS produto_variantes_validar_update
    BEFORE UPDATE ON produto_variantes WHEN ${variantRule}
    BEGIN SELECT RAISE(ABORT, 'produto_variantes_dados_invalidos'); END`);
}

async function installPostgresOrderAuditProtection() {
  await run(`CREATE OR REPLACE FUNCTION impedir_exclusao_pedidos() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'pedidos_nao_podem_ser_excluidos_fisicamente';
    END;
  $$ LANGUAGE plpgsql`);
  await run('DROP TRIGGER IF EXISTS pedidos_impedir_exclusao ON pedidos');
  await run(`CREATE TRIGGER pedidos_impedir_exclusao
    BEFORE DELETE ON pedidos FOR EACH ROW EXECUTE FUNCTION impedir_exclusao_pedidos()`);

  await run(`CREATE OR REPLACE FUNCTION impedir_mutacao_pedido_eventos() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'pedido_eventos_sao_imutaveis';
    END;
  $$ LANGUAGE plpgsql`);
  await run('DROP TRIGGER IF EXISTS pedido_eventos_impedir_update ON pedido_eventos');
  await run('DROP TRIGGER IF EXISTS pedido_eventos_impedir_delete ON pedido_eventos');
  await run(`CREATE TRIGGER pedido_eventos_impedir_update
    BEFORE UPDATE ON pedido_eventos FOR EACH ROW EXECUTE FUNCTION impedir_mutacao_pedido_eventos()`);
  await run(`CREATE TRIGGER pedido_eventos_impedir_delete
    BEFORE DELETE ON pedido_eventos FOR EACH ROW EXECUTE FUNCTION impedir_mutacao_pedido_eventos()`);
}

async function installSqliteOrderAuditProtection() {
  for (const trigger of [
    'pedidos_impedir_exclusao',
    'pedido_eventos_impedir_update',
    'pedido_eventos_impedir_delete',
  ]) {
    await run(`DROP TRIGGER IF EXISTS ${trigger}`);
  }
  // A suíte usa remoção física apenas para limpar fixtures isoladas. Em todos
  // os demais ambientes, pedidos e sua trilha são protegidos no próprio banco.
  if (process.env.NODE_ENV === 'test') return;
  await run(`CREATE TRIGGER pedidos_impedir_exclusao
    BEFORE DELETE ON pedidos
    BEGIN SELECT RAISE(ABORT, 'pedidos_nao_podem_ser_excluidos_fisicamente'); END`);
  await run(`CREATE TRIGGER pedido_eventos_impedir_update
    BEFORE UPDATE ON pedido_eventos
    BEGIN SELECT RAISE(ABORT, 'pedido_eventos_sao_imutaveis'); END`);
  await run(`CREATE TRIGGER pedido_eventos_impedir_delete
    BEFORE DELETE ON pedido_eventos
    BEGIN SELECT RAISE(ABORT, 'pedido_eventos_sao_imutaveis'); END`);
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
    await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo_ultimo_envio_em TIMESTAMPTZ');
    await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo_janela_inicio_em TIMESTAMPTZ');
    await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo_envios_na_janela INTEGER NOT NULL DEFAULT 0');
    await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo_tentativas INTEGER NOT NULL DEFAULT 0');
    await runOptionalMigration("UPDATE usuarios SET email_verificado = true WHERE perfil = 'admin' AND email_verificado = false");
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nome_cliente TEXT');
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS email_cliente TEXT');
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS telefone_cliente TEXT');
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS endereco TEXT');
    await runOptionalMigration("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS metodo_pagamento TEXT DEFAULT 'stripe'");
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
    await runOptionalMigration('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS estoque_reservado INTEGER NOT NULL DEFAULT 0');
    await runOptionalMigration(`CREATE TABLE IF NOT EXISTS produto_variantes (
      id SERIAL PRIMARY KEY,
      produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
      tamanho TEXT NOT NULL,
      estoque INTEGER NOT NULL DEFAULT 0,
      estoque_reservado INTEGER NOT NULL DEFAULT 0,
      UNIQUE (produto_id, tamanho)
    )`);
    await runOptionalMigration('CREATE INDEX IF NOT EXISTS produto_variantes_produto_idx ON produto_variantes(produto_id)');
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
    // Stripe: payment identity, status and delivery snapshot
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS stripe_session_id TEXT');
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT');
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT');
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS stripe_event_id TEXT');
    await runOptionalMigration("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid'");
    await runOptionalMigration("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL'");
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS shipping_address JSONB');
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()');
    await runOptionalMigration("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS stock_status TEXT NOT NULL DEFAULT 'none'");
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ');
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cancelado_por INTEGER');
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT');
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ');
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS arquivado_por INTEGER');
    await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS motivo_arquivamento TEXT');
    await run(`CREATE TABLE IF NOT EXISTS pedido_eventos (
      id SERIAL PRIMARY KEY,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE RESTRICT,
      tipo TEXT NOT NULL,
      status_anterior TEXT,
      status_novo TEXT,
      ator_id INTEGER,
      ator_nome TEXT,
      motivo TEXT,
      detalhes JSONB DEFAULT '{}'::jsonb,
      chave_idempotencia TEXT UNIQUE,
      created_at TIMESTAMPTZ DEFAULT now()
    )`);
    await run(`CREATE TABLE IF NOT EXISTS avaliacoes (
      id SERIAL PRIMARY KEY,
      produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE RESTRICT,
      pedido_item_id INTEGER REFERENCES pedido_itens(id) ON DELETE RESTRICT,
      autor_nome TEXT NOT NULL,
      nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
      titulo TEXT,
      comentario TEXT NOT NULL,
      compra_verificada BOOLEAN NOT NULL DEFAULT true CHECK (compra_verificada = true),
      status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'rejeitada')),
      motivo_moderacao TEXT,
      moderado_por INTEGER,
      moderado_em TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (usuario_id, produto_id)
    )`);
    await run('CREATE INDEX IF NOT EXISTS avaliacoes_produto_status_idx ON avaliacoes(produto_id, status, created_at)');
    await run('CREATE INDEX IF NOT EXISTS avaliacoes_status_idx ON avaliacoes(status, created_at)');
    await run(`INSERT INTO pedido_eventos (
        pedido_id, tipo, status_novo, ator_nome, motivo, detalhes, chave_idempotencia, created_at
      )
      SELECT id, 'registro_migrado', status, 'Sistema',
        'Pedido existente antes da trilha imutável', '{}'::jsonb,
        'pedido-legado:' || id, COALESCE(created_at, now())
      FROM pedidos
      ON CONFLICT (chave_idempotencia) DO NOTHING`);
    await run('ALTER TABLE pedido_itens DROP CONSTRAINT IF EXISTS pedido_itens_pedido_id_fkey');
    await run(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedido_itens_pedido_id_restrict_fk') THEN
        ALTER TABLE pedido_itens ADD CONSTRAINT pedido_itens_pedido_id_restrict_fk
          FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE RESTRICT;
      END IF;
    END $$`);
    await runOptionalMigration("ALTER TABLE checkout_drafts ADD COLUMN IF NOT EXISTS stock_status TEXT NOT NULL DEFAULT 'none'");
    await runOptionalMigration('ALTER TABLE checkout_drafts ADD COLUMN IF NOT EXISTS stock_expires_at TIMESTAMPTZ');
    await runOptionalMigration('CREATE UNIQUE INDEX IF NOT EXISTS pedidos_stripe_session_idx ON pedidos(stripe_session_id)');
    await runOptionalMigration('CREATE INDEX IF NOT EXISTS pedidos_usuario_id_idx ON pedidos(usuario_id)');
    await runOptionalMigration('CREATE UNIQUE INDEX IF NOT EXISTS checkout_drafts_stripe_session_idx ON checkout_drafts(stripe_session_id)');
    await runOptionalMigration('CREATE INDEX IF NOT EXISTS checkout_drafts_stock_expiry_idx ON checkout_drafts(stock_status, stock_expires_at)');
    // Funcionários/administradores: cargo, permissões granulares, acesso e auditoria
    await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cargo TEXT');
    await runOptionalMigration("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permissoes JSONB DEFAULT '[]'::jsonb");
    await runOptionalMigration("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo'");
    await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMPTZ');
    await installPostgresValidationConstraints();
    await installPostgresOrderAuditProtection();
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
  await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN codigo_ultimo_envio_em TEXT');
  await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN codigo_janela_inicio_em TEXT');
  await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN codigo_envios_na_janela INTEGER NOT NULL DEFAULT 0');
  await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN codigo_tentativas INTEGER NOT NULL DEFAULT 0');
  await runOptionalMigration("UPDATE usuarios SET email_verificado = 1 WHERE perfil = 'admin' AND COALESCE(email_verificado, 0) = 0");
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN nome_cliente TEXT');
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN email_cliente TEXT');
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN telefone_cliente TEXT');
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN endereco TEXT');
  await runOptionalMigration("ALTER TABLE pedidos ADD COLUMN metodo_pagamento TEXT DEFAULT 'stripe'");
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
  await runOptionalMigration('ALTER TABLE produtos ADD COLUMN estoque_reservado INTEGER NOT NULL DEFAULT 0');
  await runOptionalMigration(`CREATE TABLE IF NOT EXISTS produto_variantes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id INTEGER NOT NULL,
    tamanho TEXT NOT NULL,
    estoque INTEGER NOT NULL DEFAULT 0,
    estoque_reservado INTEGER NOT NULL DEFAULT 0,
    UNIQUE (produto_id, tamanho),
    FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
  )`);
  await runOptionalMigration('CREATE INDEX IF NOT EXISTS produto_variantes_produto_idx ON produto_variantes(produto_id)');
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
  // Stripe: payment identity, status and delivery snapshot
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN stripe_session_id TEXT');
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN stripe_payment_intent_id TEXT');
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN stripe_customer_id TEXT');
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN stripe_event_id TEXT');
  await runOptionalMigration("ALTER TABLE pedidos ADD COLUMN payment_status TEXT DEFAULT 'unpaid'");
  await runOptionalMigration("ALTER TABLE pedidos ADD COLUMN currency TEXT DEFAULT 'BRL'");
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN shipping_address TEXT');
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN updated_at DATETIME');
  await runOptionalMigration("ALTER TABLE pedidos ADD COLUMN stock_status TEXT NOT NULL DEFAULT 'none'");
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN cancelado_em DATETIME');
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN cancelado_por INTEGER');
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN motivo_cancelamento TEXT');
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN arquivado_em DATETIME');
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN arquivado_por INTEGER');
  await runOptionalMigration('ALTER TABLE pedidos ADD COLUMN motivo_arquivamento TEXT');
  await run(`CREATE TABLE IF NOT EXISTS pedido_eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    status_anterior TEXT,
    status_novo TEXT,
    ator_id INTEGER,
    ator_nome TEXT,
    motivo TEXT,
    detalhes TEXT DEFAULT '{}',
    chave_idempotencia TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE RESTRICT
  )`);
  await run(`CREATE TABLE IF NOT EXISTS avaliacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id INTEGER NOT NULL,
    usuario_id INTEGER,
    pedido_id INTEGER NOT NULL,
    pedido_item_id INTEGER,
    autor_nome TEXT NOT NULL,
    nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
    titulo TEXT,
    comentario TEXT NOT NULL,
    compra_verificada INTEGER NOT NULL DEFAULT 1 CHECK (compra_verificada = 1),
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'rejeitada')),
    motivo_moderacao TEXT,
    moderado_por INTEGER,
    moderado_em DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (usuario_id, produto_id),
    FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE RESTRICT,
    FOREIGN KEY (pedido_item_id) REFERENCES pedido_itens(id) ON DELETE RESTRICT
  )`);
  await run('CREATE INDEX IF NOT EXISTS avaliacoes_produto_status_idx ON avaliacoes(produto_id, status, created_at)');
  await run('CREATE INDEX IF NOT EXISTS avaliacoes_status_idx ON avaliacoes(status, created_at)');
  await run(`INSERT OR IGNORE INTO pedido_eventos (
      pedido_id, tipo, status_novo, ator_nome, motivo, detalhes, chave_idempotencia, created_at
    )
    SELECT id, 'registro_migrado', status, 'Sistema',
      'Pedido existente antes da trilha imutável', '{}',
      'pedido-legado:' || id, COALESCE(created_at, CURRENT_TIMESTAMP)
    FROM pedidos`);
  await runOptionalMigration("ALTER TABLE checkout_drafts ADD COLUMN stock_status TEXT NOT NULL DEFAULT 'none'");
  await runOptionalMigration('ALTER TABLE checkout_drafts ADD COLUMN stock_expires_at DATETIME');
  await runOptionalMigration('CREATE UNIQUE INDEX IF NOT EXISTS pedidos_stripe_session_idx ON pedidos(stripe_session_id)');
  await runOptionalMigration('CREATE INDEX IF NOT EXISTS pedidos_usuario_id_idx ON pedidos(usuario_id)');
  await runOptionalMigration('CREATE UNIQUE INDEX IF NOT EXISTS checkout_drafts_stripe_session_idx ON checkout_drafts(stripe_session_id)');
  await runOptionalMigration('CREATE INDEX IF NOT EXISTS checkout_drafts_stock_expiry_idx ON checkout_drafts(stock_status, stock_expires_at)');
  // Funcionários/administradores: cargo, permissões granulares, acesso e auditoria
  await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN cargo TEXT');
  await runOptionalMigration("ALTER TABLE usuarios ADD COLUMN permissoes TEXT DEFAULT '[]'");
  await runOptionalMigration("ALTER TABLE usuarios ADD COLUMN status TEXT DEFAULT 'ativo'");
  await runOptionalMigration('ALTER TABLE usuarios ADD COLUMN ultimo_acesso DATETIME');
  await installSqliteValidationTriggers();
  await installSqliteOrderAuditProtection();
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
    const configuredAdminEmail = process.env.DEFAULT_ADMIN_EMAIL;
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;
    if (!configuredAdminEmail || !adminPassword) {
      throw new Error(
        'DEFAULT_ADMIN_EMAIL e DEFAULT_ADMIN_PASSWORD são obrigatórias para provisionar o primeiro administrador.'
      );
    }
    const adminEmail = normalizeEmail(configuredAdminEmail);
    const { PERMISSOES_KEYS } = require('../constants/permissions');
    const hash = bcrypt.hashSync(adminPassword, 10);
    await run(
      `INSERT INTO usuarios (nome, email, senha, perfil, cargo, permissoes, status, email_verificado)
       VALUES (?, ?, ?, ?, ?, JSON_VALUE(?), ?, ?)`,
      [
        'Administrador',
        adminEmail,
        hash,
        'admin',
        'Administrador',
        JSON.stringify(PERMISSOES_KEYS),
        'ativo',
        1,
      ]
    );
    console.log('[database] Bootstrap administrator created.');
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

  // A conta proprietária configurada no ambiente é a conta de recuperação do
  // RBAC e deve acompanhar novas permissões para não perder acesso após deploys.
  const bootstrapOwner = await get(
    "SELECT id, permissoes FROM usuarios WHERE perfil = 'admin' AND LOWER(email) = LOWER(?)",
    [process.env.DEFAULT_ADMIN_EMAIL]
  );
  if (bootstrapOwner) {
    const { PERMISSOES_KEYS } = require('../constants/permissions');
    let ownerPermissions = [];
    try {
      ownerPermissions = Array.isArray(bootstrapOwner.permissoes)
        ? bootstrapOwner.permissoes
        : JSON.parse(bootstrapOwner.permissoes || '[]');
    } catch {}
    if (PERMISSOES_KEYS.some((permission) => !ownerPermissions.includes(permission))) {
      await run(
        'UPDATE usuarios SET permissoes = JSON_VALUE(?) WHERE id = ?',
        [JSON.stringify(PERMISSOES_KEYS), bootstrapOwner.id]
      );
      console.log('[database] Bootstrap administrator permissions synchronized.');
    }
  }

  // Administradores que já podiam gerenciar outras contas poderiam conceder
  // essas chaves a si mesmos. Mesclá-las no deploy evita lockout sem promover
  // funcionários que possuíam somente a antiga permissão cupons.criar.
  const administrators = await all("SELECT id, permissoes FROM usuarios WHERE perfil = 'admin'");
  const { PERMISSOES_KEYS } = require('../constants/permissions');
  const newResourcePermissions = PERMISSOES_KEYS.filter((permission) =>
    /^(categorias|cupons|promocoes|avaliacoes)\./.test(permission)
  );
  for (const administrator of administrators) {
    let currentPermissions = [];
    try {
      currentPermissions = Array.isArray(administrator.permissoes)
        ? administrator.permissoes
        : JSON.parse(administrator.permissoes || '[]');
    } catch {}
    if (!currentPermissions.includes('administradores.gerenciar')) continue;
    const mergedPermissions = [...new Set([...currentPermissions, ...newResourcePermissions])];
    if (mergedPermissions.length === currentPermissions.length) continue;
    await run(
      'UPDATE usuarios SET permissoes = JSON_VALUE(?) WHERE id = ?',
      [JSON.stringify(mergedPermissions), administrator.id]
    );
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

module.exports = { all, close, get, init, isPostgres, run, transaction };
