const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'fanaticos.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error('Erro ao abrir banco:', err);
  else console.log('✅ Banco conectado:', DB_PATH);
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
  });
}

async function init() {
  await run(`PRAGMA foreign_keys = ON`);
  await run(`PRAGMA journal_mode = WAL`);

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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    itens TEXT NOT NULL,
    total REAL NOT NULL,
    status TEXT DEFAULT 'pendente',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const cats = await get('SELECT COUNT(*) as c FROM categorias');
  if (cats.c === 0) {
    for (const nome of [
      'Brasileirão','Times Internacionais','Seleções',
      'Retrô','Feminina','Goleiro','Treino','Regata','Jogador'
    ]) {
      await run('INSERT INTO categorias (nome) VALUES (?)', [nome]);
    }
    console.log('✅ Categorias inseridas');
  }

  const admin = await get("SELECT COUNT(*) as c FROM usuarios WHERE perfil='admin'");
  if (admin.c === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await run('INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?,?,?,?)',
      ['Administrador','admin@fanaticosfc.com', hash,'admin']);
    console.log('✅ Admin criado: admin@fanaticosfc.com / admin123');
  }

  const prods = await get('SELECT COUNT(*) as c FROM produtos');
  if (prods.c === 0) {
    const catRows = await all('SELECT id, nome FROM categorias');
    const C = {};
    catRows.forEach(c => { C[c.nome] = c.id; });

    const P  = 149.90;  // torcedor
    const PJ = 199.90;  // player/jogador
    const PR = 149.90;  // retrô

    const p = (nome, preco, cat, dest=0) =>
      [nome, preco, cat, 'Qualidade Tailandesa 1:1 — tecido premium, detalhes perfeitos.', dest];

    const catalog = [
      // ══════════════════════════════════════════════════════════════
      // BRASILEIRÃO
      // ══════════════════════════════════════════════════════════════

      // FLAMENGO
      p('Flamengo Titular 25-26',                               P,  'Brasileirão', 1),
      p('Flamengo Titular 25-26 com Patrocínios',               P,  'Brasileirão'),
      p('Flamengo Titular 25-26 - Patrocinador Master',         P,  'Brasileirão'),
      p('Flamengo Titular 25-26 - Todos Patrocínios',           P,  'Brasileirão'),
      p('Flamengo Titular 24-25',                               P,  'Brasileirão'),
      p('Flamengo Titular 24-25 com Patrocínios',               P,  'Brasileirão'),
      p('Flamengo Titular 24-25 Player com Patrocínios',        PJ, 'Jogador'),
      p('Flamengo Titular Manga Longa 24-25',                   P,  'Brasileirão'),
      p('Flamengo Titular Regata 25-26',                        P,  'Regata'),
      p('Flamengo Reserva 25-26',                               P,  'Brasileirão'),
      p('Flamengo Reserva 25-26 - Patrocinador Master',         P,  'Brasileirão'),
      p('Flamengo Reserva 25-26 - Todos os Patrocínios',        P,  'Brasileirão'),
      p('Flamengo Reserva Regata 25-26',                        P,  'Regata'),
      p('Flamengo Reserva 25-26 Feminina',                      P,  'Feminina'),
      p('Flamengo Reserva 24-25',                               P,  'Brasileirão'),
      p('Flamengo Reserva 24-25 com Patrocínios',               P,  'Brasileirão'),
      p('Flamengo Reserva 23-24',                               P,  'Brasileirão'),
      p('Flamengo Third 25-26',                                 P,  'Brasileirão', 1),
      p('Flamengo Player Titular 24-25',                        PJ, 'Jogador'),
      p('Flamengo Feminina Titular 25-26',                      P,  'Feminina'),
      p('Flamengo Goleiro 25-26',                               P,  'Goleiro'),
      p('Flamengo Goleiro 24-25',                               P,  'Goleiro'),
      p('Flamengo Retro 1981',                                  PR, 'Retrô', 1),
      p('Flamengo Retro 1982',                                  PR, 'Retrô'),
      p('Flamengo Retro 1990',                                  PR, 'Retrô'),
      p('Flamengo Treino 25-26',                                P,  'Treino'),
      p('Flamengo Treino 24-25',                                P,  'Treino'),
      p('Flamengo Edição Especial 25-26',                       P,  'Brasileirão'),
      p('Flamengo Regata 25-26',                                P,  'Regata'),

      // PALMEIRAS
      p('Palmeiras Titular 25-26',                              P,  'Brasileirão', 1),
      p('Palmeiras Titular 25-26 com Todos Patrocínios',        P,  'Brasileirão'),
      p('Palmeiras Titular 25-26 Feminina',                     P,  'Feminina'),
      p('Palmeiras Titular 24-25',                              P,  'Brasileirão'),
      p('Palmeiras Titular 24-25 com Patrocínio',               P,  'Brasileirão'),
      p('Palmeiras Reserva 25-26',                              P,  'Brasileirão'),
      p('Palmeiras Reserva 24-25',                              P,  'Brasileirão'),
      p('Palmeiras Third 25-26',                                P,  'Brasileirão'),
      p('Palmeiras Third 24-25',                                P,  'Brasileirão'),
      p('Palmeiras Player Titular 25-26',                       PJ, 'Jogador'),
      p('Palmeiras Player Titular 24-25',                       PJ, 'Jogador'),
      p('Palmeiras Goleiro 25-26',                              P,  'Goleiro'),
      p('Palmeiras Treino 25-26',                               P,  'Treino'),
      p('Palmeiras Treino 24-25',                               P,  'Treino'),
      p('Palmeiras Retro 1951',                                 PR, 'Retrô'),
      p('Palmeiras Retro 1993',                                 PR, 'Retrô'),
      p('Palmeiras Edição Especial 25-26',                      P,  'Brasileirão'),

      // CORINTHIANS
      p('Corinthians Titular 25-26',                            P,  'Brasileirão', 1),
      p('Corinthians Titular 24-25',                            P,  'Brasileirão'),
      p('Corinthians Titular 24-25 com Patrocínio',             P,  'Brasileirão'),
      p('Corinthians Reserva 25-26',                            P,  'Brasileirão'),
      p('Corinthians Reserva 24-25',                            P,  'Brasileirão'),
      p('Corinthians Third 25-26',                              P,  'Brasileirão'),
      p('Corinthians Player Titular 25-26',                     PJ, 'Jogador'),
      p('Corinthians Feminina 25-26',                           P,  'Feminina'),
      p('Corinthians Goleiro 25-26',                            P,  'Goleiro'),
      p('Corinthians Treino 25-26',                             P,  'Treino'),
      p('Corinthians Retro 1977',                               PR, 'Retrô'),
      p('Corinthians Retro 1995',                               PR, 'Retrô'),
      p('Corinthians Edição Especial 25-26',                    P,  'Brasileirão'),
      p('Corinthians Regata 25-26',                             P,  'Regata'),

      // SÃO PAULO
      p('São Paulo Titular 25-26',                              P,  'Brasileirão', 1),
      p('São Paulo Titular 25-26 com Patrocínios',              P,  'Brasileirão'),
      p('São Paulo Titular 24-25',                              P,  'Brasileirão'),
      p('São Paulo Titular 24-25 com Patrocínios',              P,  'Brasileirão'),
      p('São Paulo Reserva 25-26',                              P,  'Brasileirão'),
      p('São Paulo Reserva 24-25',                              P,  'Brasileirão'),
      p('São Paulo Third 25-26',                                P,  'Brasileirão'),
      p('São Paulo Player Titular 25-26',                       PJ, 'Jogador'),
      p('São Paulo Feminina 25-26',                             P,  'Feminina'),
      p('São Paulo Goleiro 25-26',                              P,  'Goleiro'),
      p('São Paulo Treino 25-26',                               P,  'Treino'),
      p('São Paulo Retro 1992',                                 PR, 'Retrô'),
      p('São Paulo Edição Especial 25-26',                      P,  'Brasileirão'),

      // GRÊMIO
      p('Grêmio Titular 25-26',                                 P,  'Brasileirão'),
      p('Grêmio Titular 25-26 Manga Longa',                     P,  'Brasileirão'),
      p('Grêmio Titular 24-25',                                 P,  'Brasileirão'),
      p('Grêmio Outubro Rosa 22-23',                            P,  'Brasileirão'),
      p('Grêmio Reserva 25-26',                                 P,  'Brasileirão'),
      p('Grêmio Reserva 24-25',                                 P,  'Brasileirão'),
      p('Grêmio Third 24-25',                                   P,  'Brasileirão'),
      p('Grêmio Feminina 25-26',                                P,  'Feminina'),
      p('Grêmio Goleiro 25-26',                                 P,  'Goleiro'),
      p('Grêmio Treino 25-26',                                  P,  'Treino'),
      p('Grêmio Retro 1983',                                    PR, 'Retrô'),

      // INTERNACIONAL
      p('Internacional Titular 25-26',                          P,  'Brasileirão'),
      p('Internacional Titular 25-26 com Patrocínio Principal', P,  'Brasileirão'),
      p('Internacional Titular 25-26 Manga Longa',              P,  'Brasileirão'),
      p('Internacional Titular 24-25',                          P,  'Brasileirão'),
      p('Internacional Reserva 25-26',                          P,  'Brasileirão'),
      p('Internacional Reserva 24-25',                          P,  'Brasileirão'),
      p('Internacional Feminina 25-26',                         P,  'Feminina'),
      p('Internacional Goleiro 25-26',                          P,  'Goleiro'),
      p('Internacional Treino 25-26',                           P,  'Treino'),
      p('Internacional Retro 2006',                             PR, 'Retrô'),

      // BOTAFOGO
      p('Botafogo Titular 25-26',                               P,  'Brasileirão'),
      p('Botafogo Titular 24-25',                               P,  'Brasileirão'),
      p('Botafogo Titular 24-25 com Patrocínio',                P,  'Brasileirão'),
      p('Botafogo Titular 24-25 com Todos os Patrocínios',      P,  'Brasileirão'),
      p('Botafogo Titular 23-24',                               P,  'Brasileirão'),
      p('Botafogo Reserva 25-26',                               P,  'Brasileirão'),
      p('Botafogo Third 25-26',                                 P,  'Brasileirão'),
      p('Botafogo Fourth 25-26',                                P,  'Brasileirão'),
      p('Botafogo Feminina 25-26',                              P,  'Feminina'),
      p('Botafogo Goleiro 25-26',                               P,  'Goleiro'),
      p('Botafogo Treino 25-26',                                P,  'Treino'),
      p('Botafogo Retro 25-26',                                 PR, 'Retrô'),
      p('Botafogo Regata 25-26',                                P,  'Regata'),
      p('Botafogo Pré Jogo 25-26',                              P,  'Brasileirão'),

      // ATLÉTICO MINEIRO
      p('Atlético Mineiro Titular 25-26',                       P,  'Brasileirão'),
      p('Atlético Mineiro Titular 25-26 com Patrocínios',       P,  'Brasileirão'),
      p('Atlético Mineiro Titular 24-25',                       P,  'Brasileirão'),
      p('Atlético Mineiro Titular 24-25 com Patrocínio',        P,  'Brasileirão'),
      p('Atlético Mineiro Reserva 25-26',                       P,  'Brasileirão'),
      p('Atlético Mineiro Reserva 24-25',                       P,  'Brasileirão'),
      p('Atlético Mineiro Reserva 24-25 com Patrocínios',       P,  'Brasileirão'),
      p('Atlético Mineiro Feminina Titular 25-26',              P,  'Feminina'),
      p('Atlético Mineiro Goleiro 25-26',                       P,  'Goleiro'),
      p('Atlético Mineiro Treino 25-26',                        P,  'Treino'),
      p('Atlético Mineiro Treino Amarela 25-26',                P,  'Treino'),
      p('Atlético Mineiro Treino Amarela 25-26 com Patrocínios',P,  'Treino'),
      p('Atlético Mineiro Treino Preta 25-26 com Patrocínios',  P,  'Treino'),
      p('Atlético Mineiro Treino Cinza',                        P,  'Treino'),
      p('Atlético Mineiro Treino Preta',                        P,  'Treino'),
      p('Atlético Mineiro Edição Especial 25-26',               P,  'Brasileirão'),
      p('Atlético Mineiro Regata 25-26',                        P,  'Regata'),

      // VASCO
      p('Vasco Titular 25-26',                                  P,  'Brasileirão'),
      p('Vasco Titular 24-25',                                  P,  'Brasileirão'),
      p('Vasco Reserva 25-26',                                  P,  'Brasileirão'),
      p('Vasco Third 25-26',                                    P,  'Brasileirão'),
      p('Vasco Player 25-26',                                   PJ, 'Jogador'),
      p('Vasco Feminina 25-26',                                 P,  'Feminina'),
      p('Vasco Goleiro 25-26',                                  P,  'Goleiro'),
      p('Vasco Treino 25-26',                                   P,  'Treino'),
      p('Vasco Retro 1997',                                     PR, 'Retrô'),

      // FLUMINENSE
      p('Fluminense Titular 25-26',                             P,  'Brasileirão'),
      p('Fluminense Titular 24-25',                             P,  'Brasileirão'),
      p('Fluminense Reserva 25-26',                             P,  'Brasileirão'),
      p('Fluminense Third 25-26',                               P,  'Brasileirão'),
      p('Fluminense Player 25-26',                              PJ, 'Jogador'),
      p('Fluminense Feminina 25-26',                            P,  'Feminina'),
      p('Fluminense Goleiro 25-26',                             P,  'Goleiro'),
      p('Fluminense Treino 25-26',                              P,  'Treino'),
      p('Fluminense Retro 2023 Campeão',                        PR, 'Retrô'),

      // CRUZEIRO
      p('Cruzeiro Titular 25-26',                               P,  'Brasileirão'),
      p('Cruzeiro Titular 24-25',                               P,  'Brasileirão'),
      p('Cruzeiro Reserva 25-26',                               P,  'Brasileirão'),
      p('Cruzeiro Third 25-26',                                 P,  'Brasileirão'),
      p('Cruzeiro Player 25-26',                                PJ, 'Jogador'),
      p('Cruzeiro Feminina 25-26',                              P,  'Feminina'),
      p('Cruzeiro Goleiro 25-26',                               P,  'Goleiro'),
      p('Cruzeiro Treino 25-26',                                P,  'Treino'),
      p('Cruzeiro Retro 2003',                                  PR, 'Retrô'),

      // SANTOS
      p('Santos Titular 25-26',                                 P,  'Brasileirão'),
      p('Santos Titular 24-25',                                 P,  'Brasileirão'),
      p('Santos Reserva 25-26',                                 P,  'Brasileirão'),
      p('Santos Third 25-26',                                   P,  'Brasileirão'),
      p('Santos Player 25-26',                                  PJ, 'Jogador'),
      p('Santos Feminina 25-26',                                P,  'Feminina'),
      p('Santos Goleiro 25-26',                                 P,  'Goleiro'),
      p('Santos Treino 25-26',                                  P,  'Treino'),
      p('Santos Retro Pelé Edition',                            PR, 'Retrô', 1),
      p('Santos Retro 1960',                                    PR, 'Retrô'),

      // ATHLETICO PARANAENSE
      p('Athletico-PR Titular 25-26',                           P,  'Brasileirão'),
      p('Athletico-PR Titular 24-25',                           P,  'Brasileirão'),
      p('Athletico-PR Reserva 25-26',                           P,  'Brasileirão'),
      p('Athletico-PR Third 25-26',                             P,  'Brasileirão'),
      p('Athletico-PR Player 25-26',                            PJ, 'Jogador'),
      p('Athletico-PR Goleiro 25-26',                           P,  'Goleiro'),
      p('Athletico-PR Treino 25-26',                            P,  'Treino'),

      // BAHIA
      p('Bahia Titular 25-26',                                  P,  'Brasileirão'),
      p('Bahia Titular 24-25',                                  P,  'Brasileirão'),
      p('Bahia Reserva 25-26',                                  P,  'Brasileirão'),
      p('Bahia Third 25-26',                                    P,  'Brasileirão'),
      p('Bahia Player 25-26',                                   PJ, 'Jogador'),
      p('Bahia Goleiro 25-26',                                  P,  'Goleiro'),
      p('Bahia Treino 25-26',                                   P,  'Treino'),

      // FORTALEZA
      p('Fortaleza Titular 25-26',                              P,  'Brasileirão'),
      p('Fortaleza Reserva 25-26',                              P,  'Brasileirão'),
      p('Fortaleza Third 25-26',                                P,  'Brasileirão'),
      p('Fortaleza Goleiro 25-26',                              P,  'Goleiro'),
      p('Fortaleza Treino 25-26',                               P,  'Treino'),

      // VITÓRIA
      p('Vitória Titular 25-26',                                P,  'Brasileirão'),
      p('Vitória Reserva 25-26',                                P,  'Brasileirão'),
      p('Vitória Goleiro 25-26',                                P,  'Goleiro'),

      // SPORT
      p('Sport Titular 25-26',                                  P,  'Brasileirão'),
      p('Sport Reserva 25-26',                                  P,  'Brasileirão'),

      // CEARÁ
      p('Ceará Titular 25-26',                                  P,  'Brasileirão'),
      p('Ceará Reserva 25-26',                                  P,  'Brasileirão'),

      // OUTROS BRASILEIROS
      p('Red Bull Bragantino Titular 25-26',                    P,  'Brasileirão'),
      p('Red Bull Bragantino Reserva 25-26',                    P,  'Brasileirão'),
      p('Bragantino Titular 25-26',                             P,  'Brasileirão'),
      p('Chapecoense Titular 25-26',                            P,  'Brasileirão'),
      p('América Mineiro Titular 25-26',                        P,  'Brasileirão'),
      p('América Mineiro Reserva 25-26',                        P,  'Brasileirão'),
      p('Atlético Goianiense Titular 25-26',                    P,  'Brasileirão'),
      p('Goiás Titular 25-26',                                  P,  'Brasileirão'),
      p('Avaí Titular 25-26',                                   P,  'Brasileirão'),
      p('Náutico Titular 25-26',                                P,  'Brasileirão'),
      p('Remo Titular 25-26',                                   P,  'Brasileirão'),
      p('CSA Titular 25-26',                                    P,  'Brasileirão'),
      p('Santa Cruz Titular 25-26',                             P,  'Brasileirão'),
      p('Volta Redonda Titular 25-26',                          P,  'Brasileirão'),
      p('Paysandu Titular 25-26',                               P,  'Brasileirão'),
      p('Figueirense Titular 25-26',                            P,  'Brasileirão'),
      p('Criciúma Titular 25-26',                               P,  'Brasileirão'),
      p('Cuiabá Titular 25-26',                                 P,  'Brasileirão'),
      p('Juventus da Mooca Titular 25-26',                      P,  'Brasileirão'),

      // ══════════════════════════════════════════════════════════════
      // SELEÇÕES — exatamente as pastas do Drive
      // ══════════════════════════════════════════════════════════════
      p('Alemanha Titular 2024',                                P,  'Seleções'),
      p('Alemanha Reserva 2024',                                P,  'Seleções'),
      p('Arábia Saudita Titular 2024',                          P,  'Seleções'),
      p('Argentina Titular 2024',                               P,  'Seleções', 1),
      p('Argentina Reserva 2024',                               P,  'Seleções'),
      p('Argentina Player 2024',                                PJ, 'Jogador'),
      p('Argentina Feminina 2024',                              P,  'Feminina'),
      p('Argentina Goleiro 2024',                               P,  'Goleiro'),
      p('Argentina Retro 1986',                                 PR, 'Retrô'),
      p('Áustria Titular 2024',                                 P,  'Seleções'),
      p('Bélgica Titular 2024',                                 P,  'Seleções'),
      p('Brasil Titular 2024',                                  P,  'Seleções', 1),
      p('Brasil Titular 2024 com Patrocínios',                  P,  'Seleções'),
      p('Brasil Reserva 2024',                                  P,  'Seleções'),
      p('Brasil Player 2024',                                   PJ, 'Jogador'),
      p('Brasil Feminina 2024',                                 P,  'Feminina'),
      p('Brasil Goleiro 2024',                                  P,  'Goleiro'),
      p('Brasil Retro Copa 1970',                               PR, 'Retrô', 1),
      p('Brasil Retro Copa 1994',                               PR, 'Retrô'),
      p('Brasil Retro Copa 2002',                               PR, 'Retrô'),
      p('Canadá Titular 2024',                                  P,  'Seleções'),
      p('Catar Titular 2024',                                   P,  'Seleções'),
      p('Chile Titular 2024',                                   P,  'Seleções'),
      p('Croácia Titular 2024',                                 P,  'Seleções'),
      p('Dinamarca Titular 2024',                               P,  'Seleções'),
      p('Equador Titular 2024',                                 P,  'Seleções'),
      p('Escócia Titular 2024',                                 P,  'Seleções'),
      p('Eslováquia Titular 2024',                              P,  'Seleções'),
      p('Eslovênia Titular 2024',                               P,  'Seleções'),
      p('Espanha Titular 2024',                                 P,  'Seleções'),
      p('Espanha Reserva 2024',                                 P,  'Seleções'),
      p('Espanha Player 2024',                                  PJ, 'Jogador'),
      p('Estados Unidos Titular 2024',                          P,  'Seleções'),
      p('Finlândia Titular 2024',                               P,  'Seleções'),
      p('França Titular 2024',                                  P,  'Seleções'),
      p('França Reserva 2024',                                  P,  'Seleções'),
      p('França Player 2024',                                   PJ, 'Jogador'),
      p('Gana Titular 2024',                                    P,  'Seleções'),
      p('Holanda Titular 2024',                                 P,  'Seleções'),
      p('Holanda Reserva 2024',                                 P,  'Seleções'),
      p('Inglaterra Titular 2024',                              P,  'Seleções'),
      p('Inglaterra Reserva 2024',                              P,  'Seleções'),
      p('Irlanda Titular 2024',                                 P,  'Seleções'),
      p('Itália Titular 2024',                                  P,  'Seleções'),
      p('Itália Reserva 2024',                                  P,  'Seleções'),
      p('Jamaica Titular 2024',                                 P,  'Seleções'),
      p('Japão Titular 2024',                                   P,  'Seleções'),
      p('Korea Titular 2024',                                   P,  'Seleções'),
      p('Marrocos Titular 2024',                                P,  'Seleções'),
      p('México Titular 2024',                                  P,  'Seleções'),
      p('Nigéria Titular 2024',                                 P,  'Seleções'),
      p('País de Gales Titular 2024',                           P,  'Seleções'),
      p('Peru Titular 2024',                                    P,  'Seleções'),
      p('Portugal Titular 2024',                                P,  'Seleções'),
      p('Portugal Reserva 2024',                                P,  'Seleções'),
      p('Portugal Player 2024',                                 PJ, 'Jogador'),
      p('República Tcheca Titular 2024',                        P,  'Seleções'),
      p('Rússia Titular 2024',                                  P,  'Seleções'),
      p('Senegal Titular 2024',                                 P,  'Seleções'),
      p('Suécia Titular 2024',                                  P,  'Seleções'),
      p('Suíça Titular 2024',                                   P,  'Seleções'),
      p('Turquia Titular 2024',                                 P,  'Seleções'),
      p('Ucrânia Titular 2024',                                 P,  'Seleções'),
      p('Uruguai Titular 2024',                                 P,  'Seleções'),
      p('Venezuela Titular 2024',                               P,  'Seleções'),

      // ══════════════════════════════════════════════════════════════
      // TIMES INTERNACIONAIS — LIGA ESPANHOLA
      // ══════════════════════════════════════════════════════════════
      p('Real Madrid Titular 25-26',                            P,  'Times Internacionais', 1),
      p('Real Madrid Reserva 25-26',                            P,  'Times Internacionais'),
      p('Real Madrid Third 25-26',                              P,  'Times Internacionais'),
      p('Real Madrid Player 25-26',                             PJ, 'Jogador'),
      p('Real Madrid Feminina 25-26',                           P,  'Feminina'),
      p('Real Madrid Goleiro 25-26',                            P,  'Goleiro'),
      p('Real Madrid Treino 25-26',                             P,  'Treino'),
      p('Real Madrid Retro 2004-05',                            PR, 'Retrô'),
      p('Real Madrid Retro 2001-02',                            PR, 'Retrô'),
      p('Real Madrid Edição Especial 25-26',                    P,  'Times Internacionais'),
      p('Real Madrid Pré Jogo 25-26',                           P,  'Times Internacionais'),
      p('Barcelona Titular 25-26',                              P,  'Times Internacionais', 1),
      p('Barcelona Reserva 25-26',                              P,  'Times Internacionais'),
      p('Barcelona Third 25-26',                                P,  'Times Internacionais'),
      p('Barcelona Player 25-26',                               PJ, 'Jogador'),
      p('Barcelona Feminina 25-26',                             P,  'Feminina'),
      p('Barcelona Goleiro 25-26',                              P,  'Goleiro'),
      p('Barcelona Treino 25-26',                               P,  'Treino'),
      p('Barcelona Retro 2010-11',                              PR, 'Retrô'),
      p('Barcelona Retro 2004-05',                              PR, 'Retrô'),
      p('Atlético de Madrid Titular 25-26',                     P,  'Times Internacionais'),
      p('Atlético de Madrid Reserva 25-26',                     P,  'Times Internacionais'),
      p('Atlético de Madrid Third 25-26',                       P,  'Times Internacionais'),
      p('Atlético de Madrid Goleiro 25-26',                     P,  'Goleiro'),
      p('Atlético de Madrid Treino 25-26',                      P,  'Treino'),
      p('Sevilla Titular 25-26',                                P,  'Times Internacionais'),
      p('Valência Titular 25-26',                               P,  'Times Internacionais'),
      p('Real Betis Titular 25-26',                             P,  'Times Internacionais'),
      p('Real Betis Reserva 25-26',                             P,  'Times Internacionais'),
      p('Real Sociedad Titular 25-26',                          P,  'Times Internacionais'),
      p('Villarreal Titular 25-26',                             P,  'Times Internacionais'),
      p('Celta de Vigo Titular 25-26',                          P,  'Times Internacionais'),
      p('Athletic Bilbao Titular 25-26',                        P,  'Times Internacionais'),
      p('Granada Titular 25-26',                                P,  'Times Internacionais'),
      p('Real Valladolid Titular 25-26',                        P,  'Times Internacionais'),

      // LIGA INGLESA
      p('Manchester City Titular 25-26',                        P,  'Times Internacionais', 1),
      p('Manchester City Reserva 25-26',                        P,  'Times Internacionais'),
      p('Manchester City Third 25-26',                          P,  'Times Internacionais'),
      p('Manchester City Player 25-26',                         PJ, 'Jogador'),
      p('Manchester City Feminina 25-26',                       P,  'Feminina'),
      p('Manchester City Goleiro 25-26',                        P,  'Goleiro'),
      p('Manchester City Treino 25-26',                         P,  'Treino'),
      p('Manchester United Titular 25-26',                      P,  'Times Internacionais', 1),
      p('Manchester United Reserva 25-26',                      P,  'Times Internacionais'),
      p('Manchester United Third 25-26',                        P,  'Times Internacionais'),
      p('Manchester United Player 25-26',                       PJ, 'Jogador'),
      p('Manchester United Treino 25-26',                       P,  'Treino'),
      p('Liverpool Titular 25-26',                              P,  'Times Internacionais', 1),
      p('Liverpool Reserva 25-26',                              P,  'Times Internacionais'),
      p('Liverpool Third 25-26',                                P,  'Times Internacionais'),
      p('Liverpool Player 25-26',                               PJ, 'Jogador'),
      p('Liverpool Feminina 25-26',                             P,  'Feminina'),
      p('Liverpool Goleiro 25-26',                              P,  'Goleiro'),
      p('Liverpool Retro 2004-05',                              PR, 'Retrô'),
      p('Arsenal Titular 25-26',                                P,  'Times Internacionais'),
      p('Arsenal Reserva 25-26',                                P,  'Times Internacionais'),
      p('Arsenal Third 25-26',                                  P,  'Times Internacionais'),
      p('Arsenal Player 25-26',                                 PJ, 'Jogador'),
      p('Arsenal Goleiro 25-26',                                P,  'Goleiro'),
      p('Chelsea Titular 25-26',                                P,  'Times Internacionais'),
      p('Chelsea Reserva 25-26',                                P,  'Times Internacionais'),
      p('Chelsea Third 25-26',                                  P,  'Times Internacionais'),
      p('Chelsea Player 25-26',                                 PJ, 'Jogador'),
      p('Tottenham Titular 25-26',                              P,  'Times Internacionais'),
      p('Tottenham Reserva 25-26',                              P,  'Times Internacionais'),
      p('Tottenham Third 25-26',                                P,  'Times Internacionais'),
      p('Newcastle Titular 25-26',                              P,  'Times Internacionais'),
      p('Newcastle Reserva 25-26',                              P,  'Times Internacionais'),
      p('Aston Villa Titular 25-26',                            P,  'Times Internacionais'),
      p('West Ham Titular 25-26',                               P,  'Times Internacionais'),
      p('Brighton Titular 25-26',                               P,  'Times Internacionais'),
      p('Everton Titular 25-26',                                P,  'Times Internacionais'),
      p('Crystal Palace Titular 25-26',                         P,  'Times Internacionais'),
      p('Leicester Titular 25-26',                              P,  'Times Internacionais'),
      p('Leeds United Titular 25-26',                           P,  'Times Internacionais'),
      p('Fulham Titular 25-26',                                 P,  'Times Internacionais'),
      p('Celtic Titular 25-26',                                 P,  'Times Internacionais'),
      p('AFC Richmond Titular',                                 P,  'Times Internacionais'),
      p('Stoke City Titular 25-26',                             P,  'Times Internacionais'),

      // LIGA ITALIANA
      p('Juventus Titular 25-26',                               P,  'Times Internacionais'),
      p('Juventus Reserva 25-26',                               P,  'Times Internacionais'),
      p('Juventus Third 25-26',                                 P,  'Times Internacionais'),
      p('Juventus Player 25-26',                                PJ, 'Jogador'),
      p('Juventus Goleiro 25-26',                               P,  'Goleiro'),
      p('Juventus Retro 2002-03',                               PR, 'Retrô'),
      p('Inter de Milão Titular 25-26',                         P,  'Times Internacionais'),
      p('Inter de Milão Reserva 25-26',                         P,  'Times Internacionais'),
      p('Inter de Milão Third 25-26',                           P,  'Times Internacionais'),
      p('Inter de Milão Player 25-26',                          PJ, 'Jogador'),
      p('Milan Titular 25-26',                                  P,  'Times Internacionais'),
      p('Milan Reserva 25-26',                                  P,  'Times Internacionais'),
      p('Milan Third 25-26',                                    P,  'Times Internacionais'),
      p('Milan Player 25-26',                                   PJ, 'Jogador'),
      p('Milan Retro 1994',                                     PR, 'Retrô'),
      p('Napoli Titular 25-26',                                 P,  'Times Internacionais'),
      p('Napoli Reserva 25-26',                                 P,  'Times Internacionais'),
      p('Roma Titular 25-26',                                   P,  'Times Internacionais'),
      p('Lazio Titular 25-26',                                  P,  'Times Internacionais'),
      p('Atalanta Titular 25-26',                               P,  'Times Internacionais'),
      p('Fiorentina Titular 25-26',                             P,  'Times Internacionais'),
      p('Torino Titular 25-26',                                 P,  'Times Internacionais'),
      p('Bologna Titular 25-26',                                P,  'Times Internacionais'),
      p('Venezia Titular 25-26',                                P,  'Times Internacionais'),
      p('Parma Titular 25-26',                                  P,  'Times Internacionais'),
      p('Como Titular 25-26',                                   P,  'Times Internacionais'),
      p('Genoa Titular 25-26',                                  P,  'Times Internacionais'),
      p('Palermo Titular 25-26',                                P,  'Times Internacionais'),

      // LIGA ALEMÃ
      p('Bayern de Munique Titular 25-26',                      P,  'Times Internacionais', 1),
      p('Bayern de Munique Reserva 25-26',                      P,  'Times Internacionais'),
      p('Bayern de Munique Third 25-26',                        P,  'Times Internacionais'),
      p('Bayern de Munique Player 25-26',                       PJ, 'Jogador'),
      p('Bayern de Munique Goleiro 25-26',                      P,  'Goleiro'),
      p('Bayern de Munique Treino 25-26',                       P,  'Treino'),
      p('Borussia Dortmund Titular 25-26',                      P,  'Times Internacionais'),
      p('Borussia Dortmund Reserva 25-26',                      P,  'Times Internacionais'),
      p('Borussia Dortmund Third 25-26',                        P,  'Times Internacionais'),
      p('Bayer Leverkusen Titular 25-26',                       P,  'Times Internacionais'),
      p('RB Leipzig Titular 25-26',                             P,  'Times Internacionais'),
      p('Eintracht Frankfurt Titular 25-26',                    P,  'Times Internacionais'),
      p("Borussia M'gladbach Titular 25-26",                    P,  'Times Internacionais'),
      p('Schalke 04 Titular 25-26',                             P,  'Times Internacionais'),
      p('Wolfsburg Titular 25-26',                              P,  'Times Internacionais'),
      p('Hamburgo Titular 25-26',                               P,  'Times Internacionais'),
      p('Union Berlin Titular 25-26',                           P,  'Times Internacionais'),

      // LIGA FRANCESA
      p('PSG Titular 25-26',                                    P,  'Times Internacionais', 1),
      p('PSG Reserva 25-26',                                    P,  'Times Internacionais'),
      p('PSG Third 25-26',                                      P,  'Times Internacionais'),
      p('PSG Player 25-26',                                     PJ, 'Jogador'),
      p('PSG Feminina 25-26',                                   P,  'Feminina'),
      p('PSG Goleiro 25-26',                                    P,  'Goleiro'),
      p('PSG Treino 25-26',                                     P,  'Treino'),
      p('Olympique de Marseille Titular 25-26',                 P,  'Times Internacionais'),
      p('Olympique de Marseille Reserva 25-26',                 P,  'Times Internacionais'),
      p('Lyon Titular 25-26',                                   P,  'Times Internacionais'),
      p('Mônaco Titular 25-26',                                 P,  'Times Internacionais'),
      p('Lille Titular 25-26',                                  P,  'Times Internacionais'),

      // LIGA PORTUGUESA
      p('Benfica Titular 25-26',                                P,  'Times Internacionais'),
      p('Benfica Reserva 25-26',                                P,  'Times Internacionais'),
      p('Benfica Third 25-26',                                  P,  'Times Internacionais'),
      p('Porto Titular 25-26',                                  P,  'Times Internacionais'),
      p('Porto Reserva 25-26',                                  P,  'Times Internacionais'),
      p('Sporting Titular 25-26',                               P,  'Times Internacionais'),
      p('Sporting Reserva 25-26',                               P,  'Times Internacionais'),
      p('Braga Titular 25-26',                                  P,  'Times Internacionais'),
      p('Estoril Titular 25-26',                                P,  'Times Internacionais'),

      // LIGA ARGENTINA
      p('Boca Juniors Titular 25-26',                           P,  'Times Internacionais', 1),
      p('Boca Juniors Reserva 25-26',                           P,  'Times Internacionais'),
      p('Boca Juniors Third 25-26',                             P,  'Times Internacionais'),
      p('River Plate Titular 25-26',                            P,  'Times Internacionais', 1),
      p('River Plate Reserva 25-26',                            P,  'Times Internacionais'),
      p('Racing Titular 25-26',                                 P,  'Times Internacionais'),
      p('Independiente Titular 25-26',                          P,  'Times Internacionais'),
      p('San Lorenzo Titular 25-26',                            P,  'Times Internacionais'),

      // LIGA HOLANDESA
      p('Ajax Titular 25-26',                                   P,  'Times Internacionais'),
      p('Ajax Reserva 25-26',                                   P,  'Times Internacionais'),
      p('PSV Titular 25-26',                                    P,  'Times Internacionais'),

      // LIGA MEXICANA
      p('América Titular 25-26',                                P,  'Times Internacionais'),
      p('Tigres Titular 25-26',                                 P,  'Times Internacionais'),
      p('Pumas Titular 25-26',                                  P,  'Times Internacionais'),

      // LIGA AMERICANA (MLS)
      p('Inter Miami Titular 25-26',                            P,  'Times Internacionais'),
      p('Inter Miami Reserva 25-26',                            P,  'Times Internacionais'),
      p('LA Galaxy Titular 25-26',                              P,  'Times Internacionais'),
      p('LAFC Titular 25-26',                                   P,  'Times Internacionais'),
      p('New York City Titular 25-26',                          P,  'Times Internacionais'),
      p('NY Red Bulls Titular 25-26',                           P,  'Times Internacionais'),
      p('Atlanta United Titular 25-26',                         P,  'Times Internacionais'),
      p('Orlando City Titular 25-26',                           P,  'Times Internacionais'),

      // OUTRAS LIGAS
      p('Galatasaray Titular 25-26',                            P,  'Times Internacionais'),
      p('Fenerbahçe Titular 25-26',                             P,  'Times Internacionais'),
      p('Besiktas Titular 25-26',                               P,  'Times Internacionais'),
      p('Olympiacos Titular 25-26',                             P,  'Times Internacionais'),
      p('Zenit Titular 25-26',                                  P,  'Times Internacionais'),
      p('Al Nassr Titular 25-26',                               P,  'Times Internacionais'),
      p('Al Hilal Titular 25-26',                               P,  'Times Internacionais'),
      p('Atlético Nacional Titular 25-26',                      P,  'Times Internacionais'),
      p('Cerro Porteño Titular 25-26',                          P,  'Times Internacionais'),
      p('Colo Colo Titular 25-26',                              P,  'Times Internacionais'),
      p('Universidad de Chile Titular 25-26',                   P,  'Times Internacionais'),
      p('Peñarol Titular 25-26',                                P,  'Times Internacionais'),
      p('Nacional Titular 25-26',                               P,  'Times Internacionais'),
      p('Los Angeles Lakers',                                   P,  'Times Internacionais'),
      p('Chicago Bulls',                                        P,  'Times Internacionais'),
      p('Golden State Warriors',                                P,  'Times Internacionais'),
      p('Brooklyn Nets',                                        P,  'Times Internacionais'),
      p('Miami Heat',                                           P,  'Times Internacionais'),
      p('Boston Celtics',                                       P,  'Times Internacionais'),
      p('New York Knicks',                                      P,  'Times Internacionais'),
      p('Dallas Mavericks',                                     P,  'Times Internacionais'),
    ];

    let count = 0;
    for (const [nome, preco, catNome, desc, destaque] of catalog) {
      const cid = C[catNome] || null;
      await run(
        'INSERT INTO produtos (nome, preco, categoria_id, descricao, imagens, estoque, destaque) VALUES (?,?,?,?,?,?,?)',
        [nome, preco, cid, desc, '[]', 50, destaque || 0]
      );
      count++;
    }
    console.log(`✅ ${count} produtos inseridos`);
  }

  console.log('✅ Banco inicializado');
}

module.exports = { db, run, get, all, init };
