const ITEMS_PER_PAGE = 15;
const TEAMS_PER_PAGE = 8;
const ORDERS_PER_PAGE = 25;
let allProdutosAdmin = [];
let filteredProdutos = [];
let currentPage = 1;
let ligaPage = 1;
let pedidosPage = 1;
let deleteTargetId = null;
let categoriasAdmin = [];
let editingImages = [];
let editingVariantStock = {};
let editingColorVariantStock = {};
let editingHadColorVariants = false;
let viewMode = 'ligas'; // 'ligas' | 'lista'

// ── Dashboard state ────────────────────────────────────────────────────────
let dashPeriodo = '30d';
let _chartReceita = null;
let _chartStatus = null;

// ── Product extended state ──────────────────────────────────────────────────
let selectedProdutoIds = new Set();
let _slugDirty = false;

function parseAdminJson(value, fallback) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value || JSON.stringify(fallback)); } catch { return fallback; }
}

function getOpenIds() {
  try { return new Set(JSON.parse(sessionStorage.getItem('fc_open_accordions') || '[]')); }
  catch { return new Set(); }
}
function saveOpenIds(set) {
  sessionStorage.setItem('fc_open_accordions', JSON.stringify([...set]));
}

// ── Liga View Config ──────────────────────────────────────────────────────────
const LIGA_ORDER = [
  'Brasileirão', 'Seleções',
  'Liga Espanhola', 'Liga Inglesa', 'Liga Italiana', 'Liga Alemã',
  'Liga Francesa', 'Liga Portuguesa', 'Liga Argentina', 'Liga Holandesa',
  'Liga Mexicana', 'Liga Americana (MLS)', 'NBA', 'Outras Ligas', 'Outros'
];

const LIGA_FLAGS = {};

const TEAM_TO_LIGA = {
  // Liga Espanhola
  'Real Madrid': 'Liga Espanhola', 'Barcelona': 'Liga Espanhola',
  'Atlético de Madrid': 'Liga Espanhola', 'Sevilla': 'Liga Espanhola',
  'Valência': 'Liga Espanhola', 'Real Betis': 'Liga Espanhola',
  'Real Sociedad': 'Liga Espanhola', 'Villarreal': 'Liga Espanhola',
  'Celta de Vigo': 'Liga Espanhola', 'Athletic Bilbao': 'Liga Espanhola',
  'Granada': 'Liga Espanhola', 'Real Valladolid': 'Liga Espanhola',
  // Liga Inglesa
  'Manchester City': 'Liga Inglesa', 'Manchester United': 'Liga Inglesa',
  'Liverpool': 'Liga Inglesa', 'Arsenal': 'Liga Inglesa',
  'Chelsea': 'Liga Inglesa', 'Tottenham': 'Liga Inglesa',
  'Newcastle': 'Liga Inglesa', 'Aston Villa': 'Liga Inglesa',
  'West Ham': 'Liga Inglesa', 'Brighton': 'Liga Inglesa',
  'Everton': 'Liga Inglesa', 'Crystal Palace': 'Liga Inglesa',
  'Leicester': 'Liga Inglesa', 'Leeds United': 'Liga Inglesa',
  'Fulham': 'Liga Inglesa', 'Celtic': 'Liga Inglesa',
  'AFC Richmond': 'Liga Inglesa', 'Stoke City': 'Liga Inglesa',
  // Liga Italiana
  'Juventus': 'Liga Italiana', 'Inter de Milão': 'Liga Italiana',
  'Milan': 'Liga Italiana', 'Napoli': 'Liga Italiana',
  'Roma': 'Liga Italiana', 'Lazio': 'Liga Italiana',
  'Atalanta': 'Liga Italiana', 'Fiorentina': 'Liga Italiana',
  'Torino': 'Liga Italiana', 'Bologna': 'Liga Italiana',
  'Venezia': 'Liga Italiana', 'Parma': 'Liga Italiana',
  'Como': 'Liga Italiana', 'Genoa': 'Liga Italiana', 'Palermo': 'Liga Italiana',
  // Liga Alemã
  'Bayern de Munique': 'Liga Alemã', 'Borussia Dortmund': 'Liga Alemã',
  'Bayer Leverkusen': 'Liga Alemã', 'RB Leipzig': 'Liga Alemã',
  'Eintracht Frankfurt': 'Liga Alemã', "Borussia M'gladbach": 'Liga Alemã',
  'Schalke 04': 'Liga Alemã', 'Wolfsburg': 'Liga Alemã',
  'Hamburgo': 'Liga Alemã', 'Union Berlin': 'Liga Alemã',
  // Liga Francesa
  'PSG': 'Liga Francesa', 'Olympique de Marseille': 'Liga Francesa',
  'Lyon': 'Liga Francesa', 'Mônaco': 'Liga Francesa', 'Lille': 'Liga Francesa',
  // Liga Portuguesa
  'Benfica': 'Liga Portuguesa', 'Porto': 'Liga Portuguesa',
  'Sporting': 'Liga Portuguesa', 'Braga': 'Liga Portuguesa', 'Estoril': 'Liga Portuguesa',
  // Liga Argentina
  'Boca Juniors': 'Liga Argentina', 'River Plate': 'Liga Argentina',
  'Racing': 'Liga Argentina', 'Independiente': 'Liga Argentina', 'San Lorenzo': 'Liga Argentina',
  // Liga Holandesa
  'Ajax': 'Liga Holandesa', 'PSV': 'Liga Holandesa',
  // Liga Mexicana
  'América': 'Liga Mexicana', 'Tigres': 'Liga Mexicana', 'Pumas': 'Liga Mexicana',
  // Liga Americana (MLS)
  'Inter Miami': 'Liga Americana (MLS)', 'LA Galaxy': 'Liga Americana (MLS)',
  'LAFC': 'Liga Americana (MLS)', 'New York City': 'Liga Americana (MLS)',
  'NY Red Bulls': 'Liga Americana (MLS)', 'Atlanta United': 'Liga Americana (MLS)',
  'Orlando City': 'Liga Americana (MLS)',
  // Outras Ligas
  'Galatasaray': 'Outras Ligas', 'Fenerbahçe': 'Outras Ligas',
  'Besiktas': 'Outras Ligas', 'Olympiacos': 'Outras Ligas',
  'Zenit': 'Outras Ligas', 'Al Nassr': 'Outras Ligas', 'Al Hilal': 'Outras Ligas',
  'Atlético Nacional': 'Outras Ligas', 'Cerro Porteño': 'Outras Ligas',
  'Colo Colo': 'Outras Ligas', 'Universidad de Chile': 'Outras Ligas',
  'Peñarol': 'Outras Ligas', 'Nacional': 'Outras Ligas',
  // NBA
  'Los Angeles Lakers': 'NBA', 'Chicago Bulls': 'NBA',
  'Golden State Warriors': 'NBA', 'Brooklyn Nets': 'NBA',
  'Miami Heat': 'NBA', 'Boston Celtics': 'NBA',
  'New York Knicks': 'NBA', 'Dallas Mavericks': 'NBA',
};

const TEAM_ALIASES = {
  'Atletico de Madrid': ['Atlético de Madrid', 'Liga Espanhola'],
  'Atlético de Madrid': ['Atlético de Madrid', 'Liga Espanhola'],
  'Atletico Mineiro': ['Atlético Mineiro', 'Brasileirão'],
  'Athletico PR': ['Athletico-PR', 'Brasileirão'],
  'Athletico Paranaense': ['Athletico-PR', 'Brasileirão'],
  'Vasco da Gama': ['Vasco', 'Brasileirão'],
  'Internazionale': ['Inter de Milão', 'Liga Italiana'],
  'Inter Milan': ['Inter de Milão', 'Liga Italiana'],
  'Bayern Munich': ['Bayern de Munique', 'Liga Alemã'],
  'Marseille': ['Olympique de Marseille', 'Liga Francesa'],
};

const BRAZILIAN_TEAMS = new Set([
  'Flamengo', 'Palmeiras', 'Corinthians', 'São Paulo', 'Grêmio', 'Internacional',
  'Botafogo', 'Atlético Mineiro', 'Vasco', 'Fluminense', 'Cruzeiro', 'Santos',
  'Athletico Paranaense', 'Athletico-PR', 'Bahia', 'Fortaleza', 'Vitória', 'Sport', 'Ceará',
  'Red Bull Bragantino', 'Bragantino', 'Chapecoense', 'América Mineiro',
  'Atlético Goianiense', 'Goiás', 'Avaí', 'Náutico', 'Remo', 'CSA',
  'Santa Cruz', 'Volta Redonda', 'Paysandu', 'Figueirense', 'Criciúma',
  'Cuiabá', 'Juventus da Mooca'
]);

const SELECOES_TEAMS = new Set([
  'Alemanha', 'Arábia Saudita', 'Argentina', 'Áustria', 'Bélgica', 'Brasil',
  'Canadá', 'Catar', 'Chile', 'Croácia', 'Dinamarca', 'Equador', 'Escócia',
  'Eslováquia', 'Eslovênia', 'Espanha', 'Estados Unidos', 'Finlândia', 'França',
  'Gana', 'Holanda', 'Inglaterra', 'Irlanda', 'Itália', 'Jamaica', 'Japão',
  'Korea', 'Marrocos', 'México', 'Nigéria', 'País de Gales', 'Peru', 'Portugal',
  'República Tcheca', 'Rússia', 'Senegal', 'Suécia', 'Suíça', 'Turquia',
  'Ucrânia', 'Uruguai', 'Venezuela'
]);

const TYPE_KEYWORDS = new Set([
  'Titular', 'Reserva', 'Third', 'Fourth', 'Goleiro', 'Feminina',
  'Treino', 'Regata', 'Retro', 'Retrô', 'Player', 'Manga', 'Edição', 'Pré'
]);

function normalizeTeamKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildTeamIndex() {
  const rows = [];

  for (const [team, liga] of Object.entries(TEAM_TO_LIGA)) {
    rows.push({ team, liga, key: normalizeTeamKey(team) });
  }
  for (const team of BRAZILIAN_TEAMS) {
    rows.push({ team, liga: 'Brasileirão', key: normalizeTeamKey(team) });
  }
  for (const team of SELECOES_TEAMS) {
    rows.push({ team, liga: 'Seleções', key: normalizeTeamKey(team) });
  }
  for (const [alias, [team, liga]] of Object.entries(TEAM_ALIASES)) {
    rows.push({ team, liga, key: normalizeTeamKey(alias) });
  }

  const unique = new Map();
  for (const row of rows) {
    if (!row.key || unique.has(row.key)) continue;
    unique.set(row.key, row);
  }

  return [...unique.values()].sort((a, b) => b.key.length - a.key.length);
}

const TEAM_INDEX = buildTeamIndex();

function findTeamMatch(productName) {
  const normalizedName = ` ${normalizeTeamKey(productName)} `;
  return TEAM_INDEX.find(({ key }) => normalizedName.includes(` ${key} `)) || null;
}

function extractTime(nome) {
  const match = findTeamMatch(nome);
  if (match) return match.team;

  const words = nome.split(' ');
  const teamWords = [];
  for (const word of words) {
    if (TYPE_KEYWORDS.has(word)) break;
    teamWords.push(word);
  }
  return teamWords.length > 0 ? teamWords.join(' ') : nome;
}

function getLiga(produto) {
  const match = findTeamMatch(produto.nome);
  if (match) return match.liga;

  const time = extractTime(produto.nome);
  if (produto.categoria_nome === 'Brasileirão') return 'Brasileirão';
  if (produto.categoria_nome === 'Seleções') return 'Seleções';
  return 'Outros';
}

function toggleAccordion(bodyId, arrowId) {
  const body = document.getElementById(bodyId);
  const arrow = document.getElementById(arrowId);
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.textContent = isOpen ? '▶' : '▼';
  const ids = getOpenIds();
  if (isOpen) ids.delete(bodyId); else ids.add(bodyId);
  saveOpenIds(ids);
}

function renderLigaView(produtos) {
  const wrap = document.getElementById('tabelaProdutosWrap');
  const pag  = document.getElementById('paginacaoProdutos');

  if (produtos.length === 0) {
    wrap.innerHTML = '<div class="loading-state">Nenhum produto encontrado.</div>';
    if (pag) pag.style.display = 'none';
    return;
  }

  const teamMap = new Map();
  for (const p of produtos) {
    const liga = getLiga(p);
    const time = extractTime(p.nome);
    const key = `${liga}__${time}`;
    if (!teamMap.has(key)) teamMap.set(key, { liga, time, produtos: [] });
    teamMap.get(key).produtos.push(p);
  }

  const sortedTeams = [...teamMap.values()].sort((a, b) => {
    const ia = LIGA_ORDER.indexOf(a.liga);
    const ib = LIGA_ORDER.indexOf(b.liga);
    if (ia === -1 && ib === -1) return a.liga.localeCompare(b.liga, 'pt-BR') || a.time.localeCompare(b.time, 'pt-BR');
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    if (ia !== ib) return ia - ib;
    return a.time.localeCompare(b.time, 'pt-BR');
  });

  // ── Paginação por times ──
  const totalPages = Math.max(1, Math.ceil(sortedTeams.length / TEAMS_PER_PAGE));
  ligaPage = Math.min(ligaPage, totalPages);
  const pageStart = (ligaPage - 1) * TEAMS_PER_PAGE;
  const pageTeams = sortedTeams.slice(pageStart, pageStart + TEAMS_PER_PAGE);

  if (pag) {
    if (totalPages > 1) {
      pag.style.display = 'flex';
      document.getElementById('paginaInfo').textContent =
        `Página ${ligaPage} de ${totalPages} · ${sortedTeams.length} times · ${produtos.length} produtos`;
      document.getElementById('btnAnterior').disabled = ligaPage === 1;
      document.getElementById('btnProximo').disabled  = ligaPage === totalPages;
    } else {
      pag.style.display = 'none';
    }
  }

  const openIds = getOpenIds();
  let html = '<div class="ligas-view">';

  for (const group of pageTeams) {
      const { liga, time, produtos: prods } = group;
      const timeId  = 'time_' + normalizeText(`${liga}_${time}`).replace(/[^a-z0-9]/g, '_');
      const timeOpen = openIds.has(`${timeId}_body`) || pageTeams.length <= 4;

      html += `
          <div class="time-section time-section--top">
            <div class="time-header" onclick="toggleAccordion('${timeId}_body','${timeId}_arrow')">
              <div class="time-header__left">
                <span class="time-arrow" id="${timeId}_arrow">${timeOpen ? '▼' : '▶'}</span>
                <span class="time-nome">${safeText(time)}</span>
                <span class="time-liga">${safeText(liga)}</span>
              </div>
              <span class="time-count">${prods.length} produto${prods.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="time-body" id="${timeId}_body" style="display:${timeOpen ? 'block' : 'none'}">
              <table class="time-table">
                <thead>
                  <tr>
                    <th>Foto</th>
                    <th>Nome</th>
                    <th>Preço</th>
                    <th>Est.</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
      `;

      for (const p of prods) {
        const img = (p.imagens || [])[0];
        const isAtivo = (p.status || 'ativo') === 'ativo';
        const ddId = `dd_liga_${p.id}`;
        const hasPromo = p.preco_promocional && Number(p.preco_promocional) > 0;
        html += `
                  <tr>
                    <td>
                      <div class="td-img">
                        ${img
                          ? `<img src="${safeUrl(img)}" alt="${safeAttr(p.nome)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="td-img-placeholder" style="display:none"></div>`
                          : `<div class="td-img-placeholder"></div>`}
                      </div>
                    </td>
                    <td>
                      <span class="td-nome" title="${safeAttr(p.nome)}">${safeText(p.nome)}</span>
                      ${p.sku ? `<div class="td-sku">${safeText(p.sku)}</div>` : ''}
                    </td>
                    <td>
                      ${hasPromo
                        ? `<div class="td-preco td-preco--riscado">${formatBRL(p.preco)}</div><div class="td-preco td-preco--promo">${formatBRL(p.preco_promocional)}</div>`
                        : `<span class="td-preco">${formatBRL(p.preco)}</span>`}
                    </td>
                    <td>${p.estoque}</td>
                    <td><span class="td-status ${isAtivo ? 'td-status-ativo' : 'td-status-inativo'}">${isAtivo ? 'Ativo' : 'Inativo'}</span></td>
                    <td>
                      <div class="action-dropdown" id="${ddId}">
                        <button class="btn btn--outline btn--sm" onclick="toggleDropdown('${ddId}')">Ações ▾</button>
                        <div class="action-dropdown__menu">
                          <div class="action-dropdown__item" onclick="closeAllDropdowns();openEditModal(${p.id})">Editar</div>
                          <div class="action-dropdown__item" onclick="closeAllDropdowns();duplicateProduto(${p.id})">Duplicar</div>
                          <div class="action-dropdown__item" onclick="closeAllDropdowns();toggleStatus(${p.id},'${isAtivo ? 'ativo' : 'inativo'}')">
                            ${isAtivo ? 'Desativar' : 'Ativar'}
                          </div>
                          <div class="action-dropdown__item" onclick="closeAllDropdowns();toggleDestaque(${p.id},${!!p.destaque})">
                            ${p.destaque ? 'Remover destaque' : 'Marcar destaque'}
                          </div>
                          <div class="action-dropdown__sep"></div>
                          <div class="action-dropdown__item" onclick="closeAllDropdowns();window.open('../pages/produto.html?id=${p.id}','_blank')">Ver na loja</div>
                          <div class="action-dropdown__sep"></div>
                          <div class="action-dropdown__item action-dropdown__item--danger" onclick="closeAllDropdowns();confirmDelete(${p.id})">Excluir</div>
                        </div>
                      </div>
                    </td>
                  </tr>
        `;
      }

      html += `
                </tbody>
              </table>
            </div>
          </div>
      `;
  }

  html += '</div>';
  wrap.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────────────────────

async function checkAdminAuth() {
  try {
    // A autorização e a sessão HttpOnly são sempre validadas pelo backend.
    const user = await api.get('/auth/perfil');
    if (!user || user.perfil !== 'admin') {
      localStorage.removeItem('fc_user');
      document.getElementById('loginRequired').style.display = 'flex';
      return false;
    }

    localStorage.setItem('fc_user', JSON.stringify(user));
    document.getElementById('adminUserName').textContent = `${user.nome}`;
  } catch (_) {
    document.getElementById('loginRequired').style.display = 'flex';
    return false;
  }

  document.getElementById('loginRequired').style.display = 'none';
  return true;
}

function setTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sidebar__link[data-tab]').forEach(l => l.classList.remove('active'));
  document.getElementById(`tab${capitalize(name)}`)?.classList.add('active');
  document.querySelector(`.sidebar__link[data-tab="${name}"]`)?.classList.add('active');

  const titles = {
    dashboard:  ['Dashboard',            'Visão geral das métricas e vendas'],
    produtos:   ['Gerenciar Produtos',   'Cadastre, edite e remova produtos do catálogo'],
    categorias: ['Gerenciar Categorias', 'Organize as categorias e subcategorias da loja'],
    pedidos:    ['Pedidos Recebidos',    'Visualize pedidos, pagamentos e entregas'],
    usuarios:   ['Usuários Cadastrados', 'Gerencie as contas de usuários'],
    cupons:     ['Gerenciar Cupons',     'Crie e administre cupons de desconto'],
    promocoes:  ['Gerenciar Promoções',  'Descontos por produto/categoria, combos e promoções por período'],
    avaliacoes: ['Moderar Avaliações',   'Aprove ou rejeite avaliações vinculadas a compras confirmadas'],
    conteudo:   ['Conteúdo da Loja',      'Gerencie banners e textos institucionais publicados na vitrine'],
    trocas:     ['Trocas e Devoluções',   'Analise solicitações iniciadas pelos clientes'],
    analytics:  ['Funil e Conversão',     'Acompanhe eventos registrados somente após consentimento'],
    administradores: ['Administradores e Permissões', 'Cadastre funcionários, defina cargos e permissões individuais'],
  };
  document.getElementById('adminTabTitle').textContent = titles[name]?.[0] ?? name;
  document.getElementById('adminTabSub').textContent   = titles[name]?.[1] ?? '';

  if (name === 'dashboard') loadDashboard();
  if (name === 'pedidos')   loadPedidos();
  if (name === 'usuarios')  loadUsuarios();
  if (name === 'produtos' && allProdutosAdmin.length === 0) loadProdutosAdmin();
  if (name === 'cupons')   loadCuponsAdmin();
  if (name === 'promocoes') loadPromocoesAdmin();
  if (name === 'avaliacoes') loadAvaliacoesAdmin();
  if (name === 'conteudo') loadConteudoAdmin();
  if (name === 'trocas') loadTrocasAdmin();
  if (name === 'analytics') loadAnalyticsAdmin();
  if (name === 'administradores') loadFuncionariosAdmin();
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Dashboard ─────────────────────────────────────────────────────────────────

async function loadDashboard(periodo) {
  if (periodo) dashPeriodo = periodo;

  document.querySelectorAll('.dash-period-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.periodo === dashPeriodo);
  });

  document.getElementById('dashKpiGrid').innerHTML =
    '<div class="loading-state" style="grid-column:1/-1"><div class="spinner"></div><p>Carregando métricas...</p></div>';
  document.getElementById('dashTopProdutos').innerHTML = '<div class="dash-empty">Carregando...</div>';
  document.getElementById('dashUltimosPedidos').innerHTML = '<div class="dash-empty">Carregando...</div>';

  try {
    const data = await api.get(`/admin/dashboard?periodo=${dashPeriodo}`);
    renderDashboard(data);
  } catch(e) {
    document.getElementById('dashKpiGrid').innerHTML =
      `<div class="loading-state" style="grid-column:1/-1;color:var(--danger)">Erro ao carregar métricas.</div>`;
  }
}

function renderDashboard(data) {
  // ── KPI Cards ──
  const grid = document.getElementById('dashKpiGrid');
  const pendentes = (data.por_status?.pendente || 0) + (data.por_status?.aguardando_pagamento || 0);
  grid.innerHTML = `
    <div class="dash-kpi-card">
      <div class="dash-kpi-label">Receita do Período</div>
      <div class="dash-kpi-val dash-kpi-val--green">${formatBRL(data.receita)}</div>
    </div>
    <div class="dash-kpi-card">
      <div class="dash-kpi-label">Pedidos no Período</div>
      <div class="dash-kpi-val">${data.total_pedidos}</div>
      ${pendentes > 0 ? `<div class="dash-kpi-sub" style="color:#ffd740">${pendentes} aguardando</div>` : ''}
    </div>
    <div class="dash-kpi-card">
      <div class="dash-kpi-label">Ticket Médio</div>
      <div class="dash-kpi-val">${formatBRL(data.ticket_medio)}</div>
    </div>
    <div class="dash-kpi-card">
      <div class="dash-kpi-label">Clientes Cadastrados</div>
      <div class="dash-kpi-val">${data.total_clientes}</div>
    </div>
    <div class="dash-kpi-card">
      <div class="dash-kpi-label">Produtos no Catálogo</div>
      <div class="dash-kpi-val">${data.total_produtos}</div>
      ${data.estoque_baixo > 0 ? `<div class="dash-kpi-sub">${data.estoque_baixo} com estoque baixo</div>` : ''}
    </div>
    <div class="dash-kpi-card ${data.sem_estoque > 0 ? 'dash-kpi-card--alert' : ''}">
      <div class="dash-kpi-label">Sem Estoque</div>
      <div class="dash-kpi-val ${data.sem_estoque > 0 ? 'dash-kpi-val--danger' : ''}">${data.sem_estoque}</div>
    </div>
  `;

  // ── Charts ──
  _renderChartReceita(data.grafico);
  _renderChartStatus(data.por_status);

  // ── Top Products ──
  const topDiv = document.getElementById('dashTopProdutos');
  if (!data.top_produtos || data.top_produtos.length === 0) {
    topDiv.innerHTML = '<div class="dash-empty">Nenhum produto vendido neste período.</div>';
  } else {
    topDiv.innerHTML = `
      <table class="dash-table">
        <thead><tr><th>#</th><th>Produto</th><th>Qtd</th><th>Receita</th></tr></thead>
        <tbody>
          ${data.top_produtos.map((p, i) => `
            <tr>
              <td class="dash-rank">${i + 1}</td>
              <td title="${safeAttr(p.nome)}" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${safeText(p.nome)}</td>
              <td><strong>${p.vendido}</strong></td>
              <td class="td-preco">${formatBRL(p.receita)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }

  // ── Recent Orders ──
  const recDiv = document.getElementById('dashUltimosPedidos');
  if (!data.pedidos_recentes || data.pedidos_recentes.length === 0) {
    recDiv.innerHTML = '<div class="dash-empty">Nenhum pedido registrado ainda.</div>';
  } else {
    recDiv.innerHTML = `
      <table class="dash-table">
        <thead><tr><th>#</th><th>Cliente</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>
          ${data.pedidos_recentes.map(p => {
            const st = STATUS_PEDIDO[p.status] || { label: p.status, color: '#888' };
            return `
            <tr>
              <td><strong>#${p.id}</strong></td>
              <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${safeText(p.nome_cliente || '—')}</td>
              <td class="td-preco">${formatBRL(p.total)}</td>
              <td><span style="color:${st.color};font-size:.76rem;font-weight:600">${st.label}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }
}

function _renderChartReceita(grafico) {
  const canvas = document.getElementById('chartReceita');
  if (!canvas) return;
  if (_chartReceita) { _chartReceita.destroy(); _chartReceita = null; }

  if (!grafico || grafico.length === 0) {
    canvas.parentElement.innerHTML = '<div class="dash-empty">Sem dados no período.</div>';
    return;
  }

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridColor = isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)';
  const tickColor = isDark ? '#777' : '#999';

  _chartReceita = new Chart(canvas, {
    type: 'line',
    data: {
      labels: grafico.map(g => {
        const [, m, d] = g.dia.split('-');
        return `${d}/${m}`;
      }),
      datasets: [{
        label: 'Receita (R$)',
        data: grafico.map(g => g.receita),
        borderColor: '#60a5fa',
        backgroundColor: 'rgba(96,165,250,.12)',
        fill: true,
        tension: 0.4,
        pointRadius: grafico.length <= 14 ? 4 : 2,
        pointBackgroundColor: '#60a5fa',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => ' R$ ' + ctx.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }
      }},
      scales: {
        x: { ticks: { color: tickColor, font: { size: 11 } }, grid: { color: gridColor } },
        y: {
          ticks: { color: tickColor, font: { size: 11 },
            callback: v => 'R$ ' + v.toLocaleString('pt-BR') },
          grid: { color: gridColor },
          beginAtZero: true,
        },
      },
    },
  });
}

function _renderChartStatus(porStatus) {
  const canvas = document.getElementById('chartStatus');
  if (!canvas) return;
  if (_chartStatus) { _chartStatus.destroy(); _chartStatus = null; }

  const STATUS_COLORS = {
    pendente: '#888',
    aguardando_pagamento: '#ffd740',
    pago: '#66bb6a',
    em_separacao: '#42a5f5',
    enviado: '#ff9800',
    entregue: '#4caf50',
    cancelado: '#ff4444',
  };

  const labels = [], values = [], colors = [];
  for (const [status, count] of Object.entries(porStatus || {})) {
    if (Number(count) > 0) {
      labels.push(STATUS_PEDIDO[status]?.label || status);
      values.push(Number(count));
      colors.push(STATUS_COLORS[status] || '#888');
    }
  }

  if (values.length === 0) {
    canvas.parentElement.innerHTML = '<div class="dash-empty">Nenhum pedido no período.</div>';
    return;
  }

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  _chartStatus = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.map(c => c + 'bb'),
        borderColor: colors,
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: isDark ? '#aaa' : '#555', font: { size: 11 }, padding: 10, boxWidth: 12 },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────

async function loadProdutosAdmin() {
  try {
    const res = await api.get('/produtos?admin=true');
    allProdutosAdmin = Array.isArray(res) ? res : (res.produtos || []);
    allProdutosAdmin.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
    filteredProdutos = [...allProdutosAdmin];
    currentPage = 1;
    renderTabelaProdutos();
  } catch(e) {
    document.getElementById('tabelaProdutosWrap').innerHTML =
      `<div class="loading-state" style="color:var(--danger)">Erro ao carregar produtos. Backend rodando?</div>`;
  }
}

function setViewMode(mode) {
  viewMode = mode;
  currentPage = 1;
  ligaPage = 1;
  document.getElementById('btnViewLigas')?.classList.toggle('active', mode === 'ligas');
  document.getElementById('btnViewLista')?.classList.toggle('active', mode === 'lista');
  renderTabelaProdutos();
}

function renderTabelaProdutos() {
  if (viewMode === 'ligas') {
    renderLigaView(filteredProdutos);
    return;
  }

  // ── Vista Lista (tabela paginada) ──
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const page  = filteredProdutos.slice(start, start + ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredProdutos.length / ITEMS_PER_PAGE);
  const wrap  = document.getElementById('tabelaProdutosWrap');
  const pag   = document.getElementById('paginacaoProdutos');

  if (filteredProdutos.length === 0) {
    wrap.innerHTML = '<div class="loading-state">Nenhum produto encontrado.</div>';
    if (pag) pag.style.display = 'none';
    return;
  }

  const allChecked = page.length > 0 && page.every(p => selectedProdutoIds.has(String(p.id)));

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th style="width:32px"><input type="checkbox" id="chkAll" ${allChecked ? 'checked' : ''} onchange="toggleAllSelection(this.checked)" title="Selecionar página"></th>
          <th style="width:48px">Foto</th>
          <th>Nome / SKU</th>
          <th>Categoria</th>
          <th>Time</th>
          <th>Tipo</th>
          <th>Preço</th>
          <th>Est.</th>
          <th>Status</th>
          <th>Dest.</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${page.map(p => {
          const img = (p.imagens || [])[0];
          const isAtivo = (p.status || 'ativo') === 'ativo';
          const estoqueZero  = p.estoque === 0;
          const estoqueBaixo = p.estoque > 0 && p.estoque <= (p.estoque_minimo || 5);
          const estoqueCls = estoqueZero ? 'td-estoque--zero' : estoqueBaixo ? 'td-estoque--baixo' : '';
          const hasPromo = p.preco_promocional && Number(p.preco_promocional) > 0;
          const selected = selectedProdutoIds.has(String(p.id));
          const ddId = `dd_${p.id}`;
          return `
          <tr class="${selected ? 'tr--selected' : ''}">
            <td><input type="checkbox" class="chk-produto" data-id="${p.id}" ${selected ? 'checked' : ''} onchange="toggleProdutoSelection('${p.id}')"></td>
            <td>
              <div class="td-img">
                ${img
                  ? `<img src="${safeUrl(img)}" alt="${safeAttr(p.nome)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="td-img-placeholder" style="display:none"></div>`
                  : `<div class="td-img-placeholder"></div>`}
              </div>
            </td>
            <td>
              <span class="td-nome" title="${safeAttr(p.nome)}">${safeText(p.nome)}</span>
              ${p.sku ? `<div class="td-sku">${safeText(p.sku)}</div>` : ''}
            </td>
            <td><span class="td-cat">${safeText(p.categoria_nome || '—')}</span></td>
            <td><span class="td-cat">${safeText(p.time || '—')}</span></td>
            <td><span class="td-cat">${safeText(p.tipo || '—')}</span></td>
            <td>
              ${hasPromo
                ? `<div class="td-preco td-preco--riscado">${formatBRL(p.preco)}</div><div class="td-preco td-preco--promo">${formatBRL(p.preco_promocional)}</div>`
                : `<span class="td-preco">${formatBRL(p.preco)}</span>`}
            </td>
            <td><span class="td-estoque ${estoqueCls}">${p.estoque}</span></td>
            <td><span class="td-status ${isAtivo ? 'td-status-ativo' : 'td-status-inativo'}">${isAtivo ? 'Ativo' : 'Inativo'}</span></td>
            <td><span class="td-badge ${p.destaque ? '' : 'td-badge--off'}">${p.destaque ? 'Sim' : 'Não'}</span></td>
            <td>
              <div class="action-dropdown" id="${ddId}">
                <button class="btn btn--outline btn--sm" onclick="toggleDropdown('${ddId}')">Ações ▾</button>
                <div class="action-dropdown__menu">
                  <div class="action-dropdown__item" onclick="closeAllDropdowns();openEditModal(${p.id})">Editar</div>
                  <div class="action-dropdown__item" onclick="closeAllDropdowns();duplicateProduto(${p.id})">Duplicar</div>
                  <div class="action-dropdown__item" onclick="closeAllDropdowns();toggleStatus(${p.id},'${isAtivo ? 'ativo' : 'inativo'}')">
                    ${isAtivo ? 'Desativar' : 'Ativar'}
                  </div>
                  <div class="action-dropdown__item" onclick="closeAllDropdowns();toggleDestaque(${p.id},${!!p.destaque})">
                    ${p.destaque ? 'Remover destaque' : 'Marcar destaque'}
                  </div>
                  <div class="action-dropdown__sep"></div>
                  <div class="action-dropdown__item" onclick="closeAllDropdowns();window.open('../pages/produto.html?id=${p.id}','_blank')">Ver na loja</div>
                  <div class="action-dropdown__sep"></div>
                  <div class="action-dropdown__item action-dropdown__item--danger" onclick="closeAllDropdowns();confirmDelete(${p.id})">Excluir</div>
                </div>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;

  if (pag) {
    if (totalPages > 1) {
      pag.style.display = 'flex';
      document.getElementById('paginaInfo').textContent =
        `Página ${currentPage} de ${totalPages} (${filteredProdutos.length} produtos)`;
      document.getElementById('btnAnterior').disabled = currentPage === 1;
      document.getElementById('btnProximo').disabled  = currentPage === totalPages;
    } else {
      pag.style.display = 'none';
    }
  }
}

async function loadCategoriasAdmin() {
  try {
    categoriasAdmin = await api.get('/categorias/admin');
    renderProdutoCategoriaSelect();

    const filtro = document.getElementById('adminFiltroCategoria');
    if (filtro) {
      const valorAtual = filtro.value;
      filtro.innerHTML = '<option value="">Categoria</option>';
      categoriasAdmin
        .slice()
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
        .forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.nome;
          filtro.appendChild(opt);
        });
      filtro.value = valorAtual;
    }
    renderTabelaCategorias();
  } catch(e) {}
}

function renderProdutoCategoriaSelect(selectedId = null) {
  const sel = document.getElementById('pCategoria');
  if (!sel) return;

  const valorAtual = selectedId ?? sel.value;
  const termo = normalizeText(document.getElementById('pCategoriaBusca')?.value || '');
  const categoriasVisiveis = categoriasAdmin
    .slice()
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
    .filter(c => !termo || normalizeText(c.nome).includes(termo));

  sel.innerHTML = '<option value="">Selecione...</option>';
  categoriasVisiveis.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nome;
    sel.appendChild(opt);
  });

  if (valorAtual && !categoriasVisiveis.some(c => String(c.id) === String(valorAtual))) {
    const selecionada = categoriasAdmin.find(c => String(c.id) === String(valorAtual));
    if (selecionada) {
      const opt = document.createElement('option');
      opt.value = selecionada.id;
      opt.textContent = `${selecionada.nome} (selecionada)`;
      sel.appendChild(opt);
    }
  }

  sel.value = valorAtual || '';
}

// ── Category management ────────────────────────────────────────────────────

let editingCategoriaImagem = '';
let categoriaDeleteTargetId = null;

function renderTabelaCategorias() {
  const wrap = document.getElementById('tabelaCategoriasWrap');
  if (!wrap) return;

  if (categoriasAdmin.length === 0) {
    wrap.innerHTML = '<div class="loading-state">Nenhuma categoria cadastrada.</div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th style="width:48px">Imagem</th>
          <th>Nome</th>
          <th>Categoria principal</th>
          <th>Ordem</th>
          <th>Produtos</th>
          <th>Status</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${categoriasAdmin.map(c => {
          const isAtivo = (c.status || 'ativo') === 'ativo';
          const prodCount = Number(c.produtos_count || 0);
          return `
          <tr>
            <td>
              <div class="td-img">
                ${c.imagem
                  ? `<img src="${safeUrl(c.imagem)}" alt="${safeAttr(c.nome)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="td-img-placeholder" style="display:none"></div>`
                  : `<div class="td-img-placeholder"></div>`}
              </div>
            </td>
            <td><span class="td-nome">${safeText(c.nome)}</span></td>
            <td><span class="td-cat">${safeText(c.categoria_pai_nome || '—')}</span></td>
            <td>${c.ordem ?? 0}</td>
            <td><span class="td-badge ${prodCount > 0 ? '' : 'td-badge--off'}">${prodCount}</span></td>
            <td><span class="td-status ${isAtivo ? 'td-status-ativo' : 'td-status-inativo'}">${isAtivo ? 'Ativo' : 'Inativo'}</span></td>
            <td>
              <div class="td-actions">
                <button class="btn btn--outline btn--sm" onclick="openEditCategoriaModal(${c.id})">Editar</button>
                <button class="btn btn--outline btn--sm" onclick="toggleCategoriaStatus(${c.id},'${isAtivo ? 'ativo' : 'inativo'}')">${isAtivo ? 'Desativar' : 'Ativar'}</button>
                <button class="btn btn--danger btn--sm" onclick="confirmDeleteCategoria(${c.id})">Excluir</button>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

function _populateCategoriaPaiSelect(excludeId = null) {
  const sel = document.getElementById('catPaiId');
  if (!sel) return;
  sel.innerHTML = '<option value="">Nenhuma (categoria principal)</option>';
  categoriasAdmin
    .filter(c => String(c.id) !== String(excludeId))
    .forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.nome;
      sel.appendChild(opt);
    });
}

function renderCatImagePreview() {
  const preview = document.getElementById('catImagePreview');
  if (!preview) return;
  preview.innerHTML = editingCategoriaImagem
    ? `<div class="preview-img"><img src="${safeUrl(editingCategoriaImagem)}" alt="Categoria" onerror="this.style.display='none'" /><div class="preview-img__remove" onclick="removeCatImage()"></div></div>`
    : '';
}

function removeCatImage() {
  editingCategoriaImagem = '';
  renderCatImagePreview();
}

function addCategoriaImageUrl() {
  const input = document.getElementById('catImagemUrl');
  const url = input?.value.trim();
  if (!url) return;
  if (!url.startsWith('http')) { showToast('URL inválida. Deve começar com http.', 'error'); return; }
  editingCategoriaImagem = url;
  input.value = '';
  renderCatImagePreview();
}

function openNewCategoriaModal() {
  editingCategoriaImagem = '';
  document.getElementById('categoriaId').value = '';
  document.getElementById('catNome').value = '';
  document.getElementById('catOrdem').value = '0';
  document.getElementById('catStatus').value = 'ativo';
  document.getElementById('catImagemUrl').value = '';
  _populateCategoriaPaiSelect();
  renderCatImagePreview();
  document.getElementById('categoriaModalTitle').textContent = 'Nova Categoria';
  document.getElementById('categoriaModalOverlay').style.display = 'flex';
}

function openEditCategoriaModal(id) {
  const c = categoriasAdmin.find(c => String(c.id) === String(id));
  if (!c) { showToast('Categoria não encontrada.', 'error'); return; }
  editingCategoriaImagem = c.imagem || '';
  document.getElementById('categoriaId').value = c.id;
  document.getElementById('catNome').value = c.nome;
  document.getElementById('catOrdem').value = c.ordem ?? 0;
  document.getElementById('catStatus').value = c.status || 'ativo';
  document.getElementById('catImagemUrl').value = '';
  _populateCategoriaPaiSelect(c.id);
  document.getElementById('catPaiId').value = c.categoria_pai_id || '';
  renderCatImagePreview();
  document.getElementById('categoriaModalTitle').textContent = 'Editar Categoria';
  document.getElementById('categoriaModalOverlay').style.display = 'flex';
}

function closeCategoriaModal() {
  document.getElementById('categoriaModalOverlay').style.display = 'none';
}

async function saveCategoria(e) {
  e.preventDefault();
  const id = document.getElementById('categoriaId').value;
  const nome = document.getElementById('catNome').value.trim();
  const categoria_pai_id = document.getElementById('catPaiId').value || null;
  const ordem = parseInt(document.getElementById('catOrdem').value, 10) || 0;
  const status = document.getElementById('catStatus').value;

  if (!nome) { showToast('Nome é obrigatório.', 'error'); return; }

  const data = { nome, categoria_pai_id, ordem, status };
  if (editingCategoriaImagem) data.imagem = editingCategoriaImagem;

  const btn = document.getElementById('btnSalvarCategoria');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
  try {
    if (id) {
      await api.put(`/categorias/${id}`, data);
      showToast('Categoria atualizada!');
    } else {
      await api.post('/categorias', data);
      showToast('Categoria criada!');
    }
    closeCategoriaModal();
    await loadCategoriasAdmin();
  } catch(err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar Categoria'; }
  }
}

async function toggleCategoriaStatus(id, currentStatus) {
  const novo = currentStatus === 'ativo' ? 'inativo' : 'ativo';
  try {
    await api.patch(`/categorias/${id}/status`, { status: novo });
    showToast(novo === 'ativo' ? 'Categoria ativada.' : 'Categoria desativada.');
    await loadCategoriasAdmin();
  } catch(e) {
    showToast(e.message, 'error');
  }
}

function confirmDeleteCategoria(id) {
  const c = categoriasAdmin.find(c => String(c.id) === String(id));
  if (!c) return;
  categoriaDeleteTargetId = id;
  const body = document.getElementById('categoriaDeleteBody');
  const btnConfirm = document.getElementById('btnConfirmDeleteCategoria');
  const subcount = Number(c.subcategorias_count || 0);
  const prodcount = Number(c.produtos_count || 0);

  if (subcount > 0) {
    body.innerHTML = `<p>Esta categoria possui <strong>${subcount} subcategoria(s)</strong> vinculada(s). Edite-as para remover o vínculo antes de excluir.</p>`;
    btnConfirm.style.display = 'none';
  } else if (prodcount > 0) {
    const outras = categoriasAdmin.filter(o => String(o.id) !== String(id));
    body.innerHTML = `
      <p>Esta categoria possui <strong>${prodcount} produto(s)</strong> vinculado(s). Escolha uma categoria de destino para transferi-los antes de excluir:</p>
      <select id="catTransferirPara" class="admin-filter-select" style="width:100%;margin-top:.5rem">
        ${outras.map(o => `<option value="${Number(o.id)}">${safeText(o.nome)}</option>`).join('')}
      </select>
    `;
    btnConfirm.style.display = '';
  } else {
    body.innerHTML = `<p>Tem certeza que deseja excluir a categoria <strong>${safeText(c.nome)}</strong>? Esta ação não pode ser desfeita.</p>`;
    btnConfirm.style.display = '';
  }

  document.getElementById('categoriaDeleteOverlay').style.display = 'flex';
}

async function doDeleteCategoria() {
  if (!categoriaDeleteTargetId) return;
  const transferSelect = document.getElementById('catTransferirPara');
  const transferir_para = transferSelect ? transferSelect.value : undefined;

  const btn = document.getElementById('btnConfirmDeleteCategoria');
  if (btn) { btn.disabled = true; btn.textContent = 'Excluindo...'; }
  try {
    await api.delete(`/categorias/${categoriaDeleteTargetId}`, transferir_para ? { transferir_para } : undefined);
    showToast('Categoria excluída.');
    document.getElementById('categoriaDeleteOverlay').style.display = 'none';
    categoriaDeleteTargetId = null;
    await loadCategoriasAdmin();
  } catch(e) {
    showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Excluir'; }
  }
}

function selectedProductSizes() {
  return [...document.querySelectorAll('#sizePicker input:checked')].map((input) => input.value);
}

function updateVariantStockTotal() {
  const sizes = selectedProductSizes();
  if (sizes.length === 0) return;
  const colorControl = document.getElementById('pControlarEstoqueCor')?.checked;
  const colors = (document.getElementById('pCores')?.value || '').split(',').map((value) => value.trim()).filter(Boolean);
  const values = colorControl && colors.length
    ? sizes.flatMap((size) => colors.map((color) => editingColorVariantStock[`${size}\u0000${color}`]))
    : sizes.map((size) => editingVariantStock[size]);
  const totalInput = document.getElementById('pEstoque');
  if (totalInput) {
    totalInput.value = values.every((value) => Number.isSafeInteger(value) && value >= 0)
      ? values.reduce((sum, value) => sum + value, 0)
      : '';
  }
}

function renderColorVariantStockFields() {
  const container = document.getElementById('colorVariantStockFields');
  if (!container) return;
  const enabled = Boolean(document.getElementById('pControlarEstoqueCor')?.checked);
  const sizes = selectedProductSizes();
  const colors = (document.getElementById('pCores')?.value || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!enabled || !sizes.length || !colors.length) {
    container.innerHTML = enabled ? '<p class="form-hint">Selecione tamanhos e informe ao menos uma cor.</p>' : '';
    renderVariantStockFields();
    return;
  }
  container.innerHTML = sizes.flatMap((size) => colors.map((color) => {
    const key = `${size}\u0000${color}`;
    return `<div class="variant-stock-field"><label>${safeText(size)} / ${safeText(color)}</label><input type="number" min="0" step="1" required data-color-size="${safeAttr(size)}" data-color-name="${safeAttr(color)}" value="${editingColorVariantStock[key] ?? ''}" /></div>`;
  })).join('');
  container.querySelectorAll('[data-color-size]').forEach((input) => input.addEventListener('input', () => {
    const value = input.value === '' ? null : Number(input.value);
    editingColorVariantStock[`${input.dataset.colorSize}\u0000${input.dataset.colorName}`] = Number.isSafeInteger(value) && value >= 0 ? value : null;
    for (const size of sizes) {
      editingVariantStock[size] = colors.reduce((sum, color) => sum + (Number(editingColorVariantStock[`${size}\u0000${color}`]) || 0), 0);
    }
    updateVariantStockTotal();
  }));
  renderVariantStockFields();
  updateVariantStockTotal();
}

function renderVariantStockFields() {
  const container = document.getElementById('variantStockFields');
  const totalInput = document.getElementById('pEstoque');
  if (!container || !totalInput) return;
  const sizes = selectedProductSizes();
  const colorControl = document.getElementById('pControlarEstoqueCor')?.checked;
  totalInput.readOnly = sizes.length > 0;
  if (sizes.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = sizes.map((size) => `
    <div class="variant-stock-field">
      <label for="variantStock_${safeAttr(size)}">Estoque ${safeText(size)}</label>
      <input type="number" min="0" step="1" required data-variant-size="${safeAttr(size)}" ${colorControl ? 'readonly' : ''}
        id="variantStock_${safeAttr(size)}" value="${editingVariantStock[size] ?? ''}" />
    </div>
  `).join('');
  container.querySelectorAll('[data-variant-size]').forEach((input) => {
    input.addEventListener('input', () => {
      const value = input.value === '' ? null : Number(input.value);
      editingVariantStock[input.dataset.variantSize] = Number.isSafeInteger(value) && value >= 0 ? value : null;
      updateVariantStockTotal();
    });
  });
  updateVariantStockTotal();
}

function _resetFormFields() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  const chk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
  set('produtoId', ''); set('pNome', ''); set('pSku', ''); set('pSlug', '');
  set('pPreco', '149.90'); set('pPrecoPromo', ''); set('pCusto', '');
  set('pCategoriaBusca', ''); set('pCategoria', ''); set('pTime', ''); set('pPais', '');
  set('pCompeticao', ''); set('pTemporada', '');
  set('pTipo', 'torcedor'); set('pMarca', ''); set('pGenero', 'masculino');
  set('pEstoque', ''); set('pEstoqueMin', '');
  set('pDescricao', ''); set('pDescricaoCurta', ''); set('pInfoLavagem', '');
  set('pStatus', 'ativo'); set('pCores', ''); set('pGuiaTamanhos', ''); set('pImagemUrl', '');
  set('pPeso', ''); set('pDimComp', ''); set('pDimLarg', ''); set('pDimAlt', '');
  set('pKeywords', ''); set('pMetaTitulo', ''); set('pMetaDescricao', '');
  chk('pDestaque', false); chk('pProdutoNovo', false); chk('pProdutoPromo', false);
  document.querySelectorAll('#sizePicker input').forEach(cb => { cb.checked = false; });
  editingVariantStock = {};
  editingColorVariantStock = {};
  editingHadColorVariants = false;
  chk('pControlarEstoqueCor', false);
  renderVariantStockFields();
  const prev = document.getElementById('imagePreview'); if (prev) prev.innerHTML = '';
}

function openNewModal() {
  editingImages = [];
  _slugDirty = false;
  _resetFormFields();
  document.getElementById('modalFormTitle').textContent = 'Novo Produto';
  document.getElementById('modalOverlay').style.display = 'flex';
}

function openEditModal(id) {
  const p = allProdutosAdmin.find(p => String(p.id) === String(id));
  if (!p) { showToast('Produto não encontrado.', 'error'); return; }
  _slugDirty = true; // editing: don't auto-overwrite slug
  editingImages = [...parseAdminJson(p.imagens, [])];

  const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val ?? ''; };
  const chk = (elId, val) => { const el = document.getElementById(elId); if (el) el.checked = !!val; };

  set('produtoId', p.id);
  set('pNome', p.nome);          set('pSku', p.sku);        set('pSlug', p.slug);
  set('pPreco', p.preco);        set('pPrecoPromo', p.preco_promocional ?? ''); set('pCusto', p.custo ?? '');
  set('pCategoriaBusca', ''); renderProdutoCategoriaSelect(p.categoria_id);
  set('pCategoria', p.categoria_id); set('pTime', p.time); set('pPais', p.pais);
  set('pCompeticao', p.competicao);  set('pTemporada', p.temporada);
  set('pTipo', p.tipo || 'torcedor'); set('pMarca', p.marca); set('pGenero', p.genero || 'masculino');
  set('pEstoque', p.estoque);    set('pEstoqueMin', p.estoque_minimo ?? '');
  set('pDescricao', p.descricao); set('pDescricaoCurta', p.descricao_curta); set('pInfoLavagem', p.info_lavagem);
  set('pStatus', p.status || 'ativo');
  chk('pDestaque', p.destaque);  chk('pProdutoNovo', p.produto_novo); chk('pProdutoPromo', p.produto_promocional);
  set('pPeso', p.peso ?? '');
  const dim = parseAdminJson(p.dimensoes, {});
  set('pDimComp', dim.comprimento ?? ''); set('pDimLarg', dim.largura ?? ''); set('pDimAlt', dim.altura ?? '');
  set('pKeywords', p.keywords); set('pMetaTitulo', p.meta_titulo); set('pMetaDescricao', p.meta_descricao);

  const tamanhos = parseAdminJson(p.tamanhos, []);
  document.querySelectorAll('#sizePicker input').forEach(cb => { cb.checked = tamanhos.includes(cb.value); });
  editingVariantStock = Object.fromEntries(
    (Array.isArray(p.variantes) ? p.variantes : []).map((variant) => [variant.tamanho, Number(variant.estoque)])
  );
  editingColorVariantStock = Object.fromEntries(
    (Array.isArray(p.variantes_cores) ? p.variantes_cores : []).map((variant) => [`${variant.tamanho}\u0000${variant.cor}`, Number(variant.estoque)])
  );
  editingHadColorVariants = Object.keys(editingColorVariantStock).length > 0;
  chk('pControlarEstoqueCor', editingHadColorVariants);

  const cores = parseAdminJson(p.cores, []);
  set('pCores', Array.isArray(cores) ? cores.join(', ') : '');
  renderColorVariantStockFields();
  const guia = parseAdminJson(p.guia_tamanhos, []);
  set('pGuiaTamanhos', Array.isArray(guia)
    ? guia.map((row) => `${row.tamanho}, ${row.largura}, ${row.comprimento}`).join('\n')
    : '');

  document.getElementById('modalFormTitle').textContent = 'Editar Produto';
  renderImagePreview();
  document.getElementById('modalOverlay').style.display = 'flex';
}

function closeFormModal() {
  document.getElementById('modalOverlay').style.display = 'none';
  editingImages = [];
}

function renderImagePreview() {
  const preview = document.getElementById('imagePreview');
  if (!preview) return;
  if (editingImages.length === 0) { preview.innerHTML = ''; return; }
  preview.innerHTML = editingImages.map((img, i) => {
    const isUrl = img && img.startsWith('http') && !img.startsWith('data:');
    return `
    <div class="preview-img" title="${safeAttr(isUrl ? img : 'Upload local')}">
      <img src="${safeUrl(img)}" alt="Foto ${i+1}" onerror="this.style.display='none'" />
      <div class="preview-img__err" style="display:none;position:absolute;inset:0;background:var(--bg-card2);align-items:center;justify-content:center;font-size:.65rem;color:var(--text-muted);text-align:center;padding:.2rem">Erro</div>
      <div class="preview-img__remove" onclick="removePreviewImg(${i})"></div>
      <div class="preview-img__move">
        ${i > 0 ? `<button type="button" onclick="movePreviewImg(${i},-1)" title="Mover para cima">↑</button>` : ''}
        ${i < editingImages.length - 1 ? `<button type="button" onclick="movePreviewImg(${i},1)" title="Mover para baixo">↓</button>` : ''}
      </div>
      ${i === 0 ? '<div class="preview-img__main">Principal</div>' : ''}
      ${isUrl ? '<div class="preview-img__badge">URL</div>' : '<div class="preview-img__badge preview-img__badge--up">UP</div>'}
    </div>`;
  }).join('');
}

function movePreviewImg(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= editingImages.length) return;
  [editingImages[index], editingImages[newIndex]] = [editingImages[newIndex], editingImages[index]];
  renderImagePreview();
}

function removePreviewImg(index) {
  editingImages.splice(index, 1);
  renderImagePreview();
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#sizePicker input').forEach((input) => {
    input.addEventListener('change', () => {
      if (input.checked && !Object.prototype.hasOwnProperty.call(editingVariantStock, input.value)) {
        editingVariantStock[input.value] = 0;
      }
      if (!input.checked) delete editingVariantStock[input.value];
      renderColorVariantStockFields();
    });
  });
  document.getElementById('pCores')?.addEventListener('input', renderColorVariantStockFields);
  document.getElementById('pControlarEstoqueCor')?.addEventListener('change', () => {
    renderColorVariantStockFields();
  });
  document.getElementById('btnAddUrl')?.addEventListener('click', addImageUrl);
  document.getElementById('pImagemUrl')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addImageUrl(); }
  });

  document.getElementById('pImagens')?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files).slice(0, 4 - editingImages.length);
    for (const file of files) {
      const b64 = await fileToBase64(file);
      editingImages.push(b64);
    }
    renderImagePreview();
    e.target.value = '';
  });
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const raw = new Image();
      raw.onerror = reject;
      raw.onload = () => {
        const MAX = 800;
        let w = raw.width, h = raw.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(raw, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      raw.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function addImageUrl() {
  const input = document.getElementById('pImagemUrl');
  const url = input?.value.trim();
  if (!url) return;
  if (!url.startsWith('http')) { showToast('URL inválida. Deve começar com http.', 'error'); return; }
  if (editingImages.length >= 4) { showToast('Máximo 4 imagens por produto.', 'error'); return; }
  editingImages.push(url);
  input.value = '';
  renderImagePreview();
}

async function saveProduto(e) {
  e.preventDefault();
  const urlInput = document.getElementById('pImagemUrl');
  const pendingUrl = urlInput?.value.trim();
  if (pendingUrl && pendingUrl.startsWith('http') && editingImages.length < 4) {
    editingImages.push(pendingUrl);
    urlInput.value = '';
    renderImagePreview();
  }

  const id = document.getElementById('produtoId').value;
  const v = id => document.getElementById(id)?.value?.trim() ?? '';
  const n = id => { const val = document.getElementById(id)?.value; return val !== '' && val != null ? Number(val) : null; };

  const tamanhos = selectedProductSizes();
  const variantes = tamanhos.map((tamanho) => ({ tamanho, estoque: editingVariantStock[tamanho] }));
  if (variantes.some((variant) => !Number.isSafeInteger(variant.estoque) || variant.estoque < 0)) {
    showToast('Informe o estoque de cada tamanho selecionado.', 'error');
    return;
  }
  const coresText = v('pCores');
  const cores = coresText ? coresText.split(',').map(s => s.trim()).filter(Boolean) : [];
  const controlarEstoqueCor = Boolean(document.getElementById('pControlarEstoqueCor')?.checked);
  let variantes_cores;
  if (controlarEstoqueCor) {
    variantes_cores = tamanhos.flatMap((tamanho) => cores.map((cor) => ({
      tamanho, cor, estoque: editingColorVariantStock[`${tamanho}\u0000${cor}`],
    })));
    if (!tamanhos.length || !cores.length || variantes_cores.some((variant) => !Number.isSafeInteger(variant.estoque) || variant.estoque < 0)) {
      showToast('Informe o estoque de cada combinação de tamanho e cor.', 'error');
      return;
    }
  } else if (editingHadColorVariants) {
    variantes_cores = [];
  }
  const guia_tamanhos = v('pGuiaTamanhos')
    ? v('pGuiaTamanhos').split(/\r?\n/).filter(Boolean).map((line) => {
      const [tamanho, largura, comprimento] = line.split(',').map((part) => part.trim());
      return { tamanho, largura: Number(largura), comprimento: Number(comprimento) };
    })
    : [];
  if (guia_tamanhos.some((row) => !row.tamanho || !Number.isFinite(row.largura) || !Number.isFinite(row.comprimento))) {
    showToast('Revise o guia de tamanhos. Use: tamanho, largura, comprimento.', 'error');
    return;
  }
  const dimensoes = { comprimento: n('pDimComp'), largura: n('pDimLarg'), altura: n('pDimAlt') };

  const data = {
    nome:               v('pNome'),
    sku:                v('pSku') || null,
    slug:               v('pSlug') || null,
    preco:              n('pPreco'),
    preco_promocional:  n('pPrecoPromo'),
    custo:              n('pCusto'),
    categoria_id:       v('pCategoria') || null,
    descricao:          v('pDescricao'),
    descricao_curta:    v('pDescricaoCurta'),
    time:               v('pTime') || null,
    pais:               v('pPais') || null,
    competicao:         v('pCompeticao') || null,
    temporada:          v('pTemporada') || null,
    tipo:               v('pTipo') || 'torcedor',
    marca:              v('pMarca') || null,
    genero:             v('pGenero') || 'masculino',
    imagens:            editingImages,
    estoque:            n('pEstoque') ?? 0,
    estoque_minimo:     n('pEstoqueMin') ?? 0,
    tamanhos,
    variantes,
    cores,
    variantes_cores,
    guia_tamanhos,
    status:             v('pStatus') || 'ativo',
    destaque:           !!document.getElementById('pDestaque')?.checked,
    produto_novo:       !!document.getElementById('pProdutoNovo')?.checked,
    produto_promocional:!!document.getElementById('pProdutoPromo')?.checked,
    peso:               n('pPeso'),
    dimensoes,
    info_lavagem:       v('pInfoLavagem') || null,
    keywords:           v('pKeywords') || null,
    meta_titulo:        v('pMetaTitulo') || null,
    meta_descricao:     v('pMetaDescricao') || null,
  };

  if (!data.nome || data.preco == null || isNaN(data.preco)) {
    showToast('Nome e preço são obrigatórios.', 'error'); return;
  }

  const btnSalvar = document.getElementById('btnSalvarProduto');
  if (btnSalvar) { btnSalvar.disabled = true; btnSalvar.textContent = 'Salvando...'; }
  try {
    const cat = categoriasAdmin.find(c => String(c.id) === String(data.categoria_id));
    if (id) {
      await api.put(`/produtos/${id}`, data);
      const merged = { ...data, id: Number(id), categoria_nome: cat?.nome || '', imagens: editingImages };
      const idx = allProdutosAdmin.findIndex(p => String(p.id) === String(id));
      if (idx !== -1) allProdutosAdmin[idx] = merged;
      showToast('Produto atualizado com sucesso!');
    } else {
      const created = await api.post('/produtos', data);
      const newP = { ...data, id: created.id, categoria_nome: cat?.nome || '', imagens: editingImages };
      allProdutosAdmin.unshift(newP);
      showToast('Produto criado com sucesso!');
    }
    closeFormModal();
    applyAdminFilters();
  } catch(err) {
    showToast(err.message, 'error');
  } finally {
    if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.textContent = 'Salvar Produto'; }
  }
}

function confirmDelete(id) {
  deleteTargetId = id;
  document.getElementById('deleteOverlay').style.display = 'flex';
}

async function doDelete() {
  if (!deleteTargetId) return;
  const btn = document.getElementById('btnConfirmDelete');
  if (btn) { btn.disabled = true; btn.textContent = 'Excluindo...'; }
  try {
    await api.delete(`/produtos/${deleteTargetId}`);
    allProdutosAdmin = allProdutosAdmin.filter(p => String(p.id) !== String(deleteTargetId));
    filteredProdutos = filteredProdutos.filter(p => String(p.id) !== String(deleteTargetId));
    document.getElementById('deleteOverlay').style.display = 'none';
    deleteTargetId = null;
    showToast('Produto excluído.', 'success');
    renderTabelaProdutos();
  } catch(e) {
    showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Excluir'; }
  }
}

const STATUS_PEDIDO = {
  'pendente':             { label: 'Pendente',              color: '#888' },
  'aguardando_pagamento': { label: 'Aguard. Pagamento',     color: '#ffd740' },
  'pago':                 { label: 'Pago',                  color: '#4caf50' },
  'em_separacao':         { label: 'Em Separação',          color: '#2196f3' },
  'enviado':              { label: 'Enviado',               color: '#ff9800' },
  'entregue':             { label: 'Entregue',              color: '#4caf50' },
  'cancelado':            { label: 'Cancelado',             color: '#ff4444' },
};

const TRANSICOES_STATUS_PEDIDO = {
  pendente: ['aguardando_pagamento', 'pago', 'cancelado'],
  aguardando_pagamento: ['pago', 'cancelado'],
  pago: ['em_separacao', 'cancelado'],
  em_separacao: ['enviado', 'cancelado'],
  enviado: ['entregue'],
  entregue: [],
  cancelado: [],
};

let pedidosCache = [];
let mostrarPedidosArquivados = false;

function getPedidosTotalPages() {
  return Math.max(1, Math.ceil(pedidosCache.length / ORDERS_PER_PAGE));
}

function setPedidosPage(page) {
  pedidosPage = Math.min(Math.max(1, page), getPedidosTotalPages());
  renderPedidos();
}

function verDetalhesPedido(id) {
  const p = pedidosCache.find(x => x.id === id);
  if (!p) return;

  const st = STATUS_PEDIDO[p.status] || { label: p.status, color: '#888' };
  const metodo = p.stripe_session_id || p.metodo_pagamento === 'stripe'
    ? 'Stripe (cartão ou PIX)'
    : 'Pagamento legado';
  const itensHtml = p.itens.map(i =>
    `<div style="display:flex;justify-content:space-between;padding:.35rem 0;border-bottom:1px solid var(--border)">
      <span>${safeText(i.nome)} <em style="color:var(--text-muted)">x${Number(i.qty) || 0}</em></span>
      <span>${formatBRL(i.preco * i.qty)}</span>
    </div>`
  ).join('');
  const historicoHtml = (p.historico || []).slice().reverse().map(evento => {
    const status = evento.status_novo && STATUS_PEDIDO[evento.status_novo]
      ? STATUS_PEDIDO[evento.status_novo].label
      : evento.status_novo;
    return `<div style="padding:.55rem 0;border-bottom:1px solid var(--border);font-size:.82rem">
      <div style="display:flex;justify-content:space-between;gap:.75rem">
        <strong>${safeText(evento.tipo.replace(/_/g, ' '))}</strong>
        <span style="color:var(--text-dim);white-space:nowrap">${new Date(evento.created_at).toLocaleString('pt-BR')}</span>
      </div>
      <div style="color:var(--text-muted);margin-top:.2rem">
        ${status ? `Status: ${safeText(status)} · ` : ''}${safeText(evento.ator_nome || 'Sistema')}
        ${evento.motivo ? ` · ${safeText(evento.motivo)}` : ''}
      </div>
    </div>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.id = '_pedidoDetailOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.82);backdrop-filter:blur(4px);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:1.5rem';
  overlay.innerHTML = `
    <div class="modal modal--checkout" style="margin:auto;width:100%;max-width:580px">
      <div class="co-header">
        <h2>Pedido #${p.id}</h2>
        <button class="modal__close" id="_btnFecharDetalhe">×</button>
      </div>

      <div style="padding:0 1.25rem 1.25rem">
        <!-- Status -->
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1.25rem">
          <span style="background:${st.color}22;color:${st.color};padding:.3rem .75rem;border-radius:20px;font-size:.82rem;font-weight:600">${safeText(st.label)}</span>
          <span style="color:var(--text-muted);font-size:.8rem">${new Date(p.created_at).toLocaleString('pt-BR')}</span>
        </div>

        <!-- Endereço de Entrega -->
        <div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:10px;padding:1rem;margin-bottom:1rem">
          <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.5rem">Endereço de Entrega</div>
          ${p.endereco
            ? `<div style="font-size:.95rem;font-weight:500;line-height:1.6">${safeText(p.endereco).replace(/ — /g, '<br>')}</div>`
            : '<div style="color:var(--text-muted);font-size:.85rem">Não informado</div>'}
        </div>

        <!-- Dados do Cliente -->
        <div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:10px;padding:1rem;margin-bottom:1rem">
          <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.5rem">Dados do Cliente</div>
          <div style="display:grid;gap:.35rem;font-size:.88rem">
            ${p.nome_cliente ? `<div><span style="color:var(--text-muted)">Nome:</span> <strong>${safeText(p.nome_cliente)}</strong></div>` : ''}
            ${p.telefone_cliente ? `<div><span style="color:var(--text-muted)">Telefone:</span> ${safeText(p.telefone_cliente)}</div>` : ''}
            ${p.email_cliente ? `<div><span style="color:var(--text-muted)">E-mail:</span> ${safeText(p.email_cliente)}</div>` : ''}
          </div>
        </div>

        <!-- Itens -->
        <div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:10px;padding:1rem;margin-bottom:1rem">
          <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.5rem"> Itens do Pedido</div>
          <div style="font-size:.88rem">${itensHtml}</div>
          <div style="display:flex;justify-content:space-between;padding:.5rem 0 0;font-weight:700;font-size:.95rem">
            <span>Total</span><span>${formatBRL(p.total)}</span>
          </div>
        </div>

        <!-- Pagamento -->
        <div style="display:flex;gap:.75rem;font-size:.85rem;color:var(--text-muted)">
          <span>Pagamento: <strong style="color:var(--text)">${metodo}</strong></span>
          ${p.payment_status ? `<span>| Status financeiro: <strong style="color:var(--text)">${safeText(p.payment_status)}</strong></span>` : ''}
          ${p.codigo_rastreio ? `<span>| Rastreio: <strong style="color:var(--text)">${safeText(p.codigo_rastreio)}</strong></span>` : ''}
        </div>
        ${p.stripe_session_id ? `
        <div style="margin-top:.75rem;font-size:.74rem;color:var(--text-dim);word-break:break-all">
          <div>Stripe Session: ${safeText(p.stripe_session_id)}</div>
          ${p.stripe_payment_intent_id ? `<div>Payment Intent: ${safeText(p.stripe_payment_intent_id)}</div>` : ''}
        </div>` : ''}

        <div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:10px;padding:1rem;margin-top:1rem">
          <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.5rem">Histórico imutável</div>
          ${historicoHtml || '<div style="color:var(--text-muted);font-size:.85rem">Nenhum evento registrado.</div>'}
        </div>

        <!-- Ações -->
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector('#_btnFecharDetalhe').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

async function loadPedidos() {
  const wrap = document.getElementById('tabelaPedidosWrap');
  try {
    const pedidos = await api.get(mostrarPedidosArquivados ? '/pedidos?arquivados=true' : '/pedidos');
    pedidosCache = pedidos;
    pedidosPage = 1;
    renderPedidos();
  } catch(e) {
    wrap.innerHTML = '<div class="loading-state" style="color:var(--danger)">Erro ao carregar pedidos.</div>';
  }
}

function renderPedidos() {
  const wrap = document.getElementById('tabelaPedidosWrap');
  const pedidos = pedidosCache;

  if (pedidos.length === 0) {
    wrap.innerHTML = `<div class="loading-state">
      <div>${mostrarPedidosArquivados ? 'Nenhum pedido arquivado.' : 'Nenhum pedido ativo registrado.'}</div>
      <button class="btn btn--outline btn--sm" id="btnAlternarPedidosArquivadosVazio" style="margin-top:.75rem">
        ${mostrarPedidosArquivados ? 'Ver pedidos ativos' : 'Ver arquivados'}
      </button>
    </div>`;
    document.getElementById('btnAlternarPedidosArquivadosVazio')?.addEventListener('click', async () => {
      mostrarPedidosArquivados = !mostrarPedidosArquivados;
      await loadPedidos();
    });
    return;
  }

  const totalPages = getPedidosTotalPages();
  pedidosPage = Math.min(pedidosPage, totalPages);
  const start = (pedidosPage - 1) * ORDERS_PER_PAGE;
  const pagePedidos = pedidos.slice(start, start + ORDERS_PER_PAGE);
  const STATUS_EXCLUIDOS_RECEITA = ['pendente', 'aguardando_pagamento', 'cancelado'];
  const totalGeral = pedidos
    .filter(p => !STATUS_EXCLUIDOS_RECEITA.includes(p.status))
    .reduce((s, p) => s + (Number(p.total) || 0), 0);
  const pendentes = pedidos.filter(p => p.status === 'aguardando_pagamento' || p.status === 'pendente').length;
  wrap.innerHTML = `
      <div class="admin-stats">
        <div class="admin-stat">
          <div class="admin-stat__label">Total de Pedidos</div>
          <div class="admin-stat__val">${pedidos.length}</div>
        </div>
        <div class="admin-stat">
          <div class="admin-stat__label">Receita Total</div>
          <div class="admin-stat__val admin-stat__val--green">${formatBRL(totalGeral)}</div>
        </div>
        <div class="admin-stat">
          <div class="admin-stat__label">Aguardando</div>
          <div class="admin-stat__val" style="color:#ffd740">${pendentes}</div>
        </div>
      </div>
      <div class="orders-toolbar">
        <span>Exibindo ${start + 1}-${Math.min(start + ORDERS_PER_PAGE, pedidos.length)} de ${pedidos.length} pedidos</span>
        <div style="display:flex;align-items:center;gap:.75rem">
          <span>Página ${pedidosPage} de ${totalPages}</span>
          <button class="btn btn--outline btn--sm" id="btnAlternarPedidosArquivados">
            ${mostrarPedidosArquivados ? 'Ver pedidos ativos' : 'Ver arquivados'}
          </button>
        </div>
      </div>
      <table class="pedidos-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Cliente</th>
            <th>Itens</th>
            <th>Total</th>
            <th>Pagamento</th>
            <th>Status</th>
            <th>Rastreio</th>
            <th>Data</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${pagePedidos.map(p => {
            const st = STATUS_PEDIDO[p.status] || { label: p.status, color: '#888' };
            const arquivado = Boolean(p.arquivado_em);
            const statusPermitidos = [p.status, ...(TRANSICOES_STATUS_PEDIDO[p.status] || [])];
            const metodoIcon = p.stripe_session_id || p.metodo_pagamento === 'stripe'
              ? 'Stripe (cartão ou PIX)'
              : 'Pagamento legado';
            return `
            <tr id="pedido-row-${p.id}">
              <td><strong>#${p.id}</strong></td>
              <td>
                ${p.nome_cliente ? `<div style="font-weight:600">${safeText(p.nome_cliente)}</div>` : '<span style="color:var(--text-muted)">—</span>'}
                ${p.telefone_cliente ? `<div style="font-size:.78rem;color:var(--text-muted)">${safeText(p.telefone_cliente)}</div>` : ''}
                ${p.email_cliente ? `<div style="font-size:.78rem;color:var(--text-muted)">${safeText(p.email_cliente)}</div>` : ''}
                ${p.endereco ? `<div style="font-size:.75rem;color:var(--text-dim);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${safeAttr(p.endereco)}">${safeText(p.endereco)}</div>` : ''}
              </td>
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${p.itens.map(i => `${safeText(i.nome)} (x${Number(i.qty) || 0})`).join(', ')}
              </td>
              <td><span class="td-preco">${formatBRL(p.total)}</span></td>
              <td><span style="font-size:.82rem">${metodoIcon}</span></td>
              <td>
                <div style="margin-bottom:4px;font-size:.75rem;font-weight:600;color:${st.color}">${safeText(st.label)}</div>
                <select class="pedido-status-select" data-id="${p.id}" onchange="salvarStatusPedido(${p.id})" ${arquivado ? 'disabled' : ''}>
                  ${Object.entries(STATUS_PEDIDO).filter(([val]) => statusPermitidos.includes(val)).map(([val, info]) =>
                    `<option value="${val}" ${p.status === val ? 'selected' : ''}>${info.label}</option>`
                  ).join('')}
                </select>
                ${arquivado ? '<div style="font-size:.72rem;color:var(--text-muted);margin-top:4px">Arquivado</div>' : ''}
              </td>
              <td>
                <div style="display:grid;gap:4px;min-width:180px">
                  <input type="text" class="pedido-transportadora-input" data-id="${p.id}"
                    value="${safeAttr(p.transportadora || '')}" placeholder="Transportadora" ${arquivado ? 'disabled' : ''} />
                  <input type="text" class="pedido-rastreio-input" data-id="${p.id}"
                    value="${safeAttr(p.codigo_rastreio || '')}" placeholder="Cód. rastreio"
                    ${arquivado ? 'disabled' : ''}
                    style="width:120px;font-size:.8rem;padding:4px 8px;background:var(--bg-card2);border:1px solid var(--border);color:var(--text);border-radius:6px" />
                  <input type="url" class="pedido-rastreio-url-input" data-id="${p.id}"
                    value="${safeAttr(p.rastreio_url || '')}" placeholder="https://link-de-rastreio" ${arquivado ? 'disabled' : ''} />
                  <button class="btn btn--outline btn--sm" onclick="salvarRastreioPedido(${p.id})" title="Salvar rastreio" ${arquivado ? 'disabled' : ''}>Salvar</button>
                </div>
              </td>
              <td style="color:var(--text-muted);font-size:.82rem;white-space:nowrap">${new Date(p.created_at).toLocaleString('pt-BR')}</td>
              <td>
                <div style="display:flex;gap:4px;flex-wrap:wrap">
                  <button class="btn btn--outline btn--sm" onclick="verDetalhesPedido(${p.id})" title="Ver detalhes do pedido">Ver</button>
                  ${arquivado
                    ? `<button class="btn btn--outline btn--sm" onclick="desarquivarPedido(${p.id})" title="Restaurar pedido arquivado">Desarquivar</button>`
                    : `<button class="btn btn--danger btn--sm" onclick="arquivarPedido(${p.id})" title="Arquivar sem apagar o histórico">Arquivar</button>`}
                </div>
              </td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
      <div class="pagination orders-pagination">
        <button class="btn btn--outline btn--sm" id="btnPedidosAnterior" ${pedidosPage === 1 ? 'disabled' : ''}>Anterior</button>
        <span id="pedidosPaginaInfo">Página ${pedidosPage} de ${totalPages}</span>
        <button class="btn btn--outline btn--sm" id="btnPedidosProximo" ${pedidosPage === totalPages ? 'disabled' : ''}>Próximo</button>
      </div>
    `;

  document.getElementById('btnPedidosAnterior')?.addEventListener('click', () => setPedidosPage(pedidosPage - 1));
  document.getElementById('btnPedidosProximo')?.addEventListener('click', () => setPedidosPage(pedidosPage + 1));
  document.getElementById('btnAlternarPedidosArquivados')?.addEventListener('click', async () => {
    mostrarPedidosArquivados = !mostrarPedidosArquivados;
    await loadPedidos();
  });
}

async function salvarStatusPedido(id) {
  const select = document.querySelector(`.pedido-status-select[data-id="${id}"]`);
  if (!select) return;
  const pedido = pedidosCache.find(item => String(item.id) === String(id));
  const body = { status: select.value };
  if (select.value === 'cancelado' && pedido?.status !== 'cancelado') {
    const motivo = prompt('Informe o motivo do cancelamento (mínimo de 5 caracteres):');
    if (motivo === null || motivo.trim().length < 5) {
      select.value = pedido?.status || 'pago';
      if (motivo !== null) showToast('Informe um motivo válido para cancelar.', 'error');
      return;
    }
    body.motivo_cancelamento = motivo.trim();
  }
  try {
    await api.put(`/pedidos/${id}`, body);
    showToast(`Status do pedido #${id} atualizado!`);
    await loadPedidos();
  } catch(e) {
    if (pedido) select.value = pedido.status;
    showToast(e.message || 'Erro ao atualizar status', 'error');
  }
}

async function salvarRastreioPedido(id) {
  const input = document.querySelector(`.pedido-rastreio-input[data-id="${id}"]`);
  const carrierInput = document.querySelector(`.pedido-transportadora-input[data-id="${id}"]`);
  const urlInput = document.querySelector(`.pedido-rastreio-url-input[data-id="${id}"]`);
  if (!input) return;
  try {
    await api.put(`/pedidos/${id}`, {
      codigo_rastreio: input.value.trim() || null,
      transportadora: carrierInput?.value.trim() || null,
      rastreio_url: urlInput?.value.trim() || null,
    });
    showToast(`Rastreio do pedido #${id} salvo!`);
  } catch(e) {
    showToast('Erro ao salvar rastreio');
  }
}

async function arquivarPedido(id) {
  if (!confirm(`Arquivar o pedido #${id}? Os itens, pagamento e histórico serão preservados.`)) return;
  const motivo = prompt('Motivo do arquivamento (opcional):', 'Concluído administrativamente');
  if (motivo === null) return;
  try {
    await api.patch(`/pedidos/${id}/arquivar`, { motivo: motivo.trim() || null });
    showToast(`Pedido #${id} arquivado sem excluir o histórico.`);
    await loadPedidos();
  } catch(e) {
    showToast(e.message || 'Erro ao arquivar pedido', 'error');
  }
}

async function desarquivarPedido(id) {
  try {
    await api.patch(`/pedidos/${id}/desarquivar`, {});
    showToast(`Pedido #${id} desarquivado.`);
    await loadPedidos();
  } catch(e) {
    showToast(e.message || 'Erro ao desarquivar pedido', 'error');
  }
}

let usuariosCache = [];
let usuarioDeleteTargetId = null;

async function loadUsuarios() {
  const wrap = document.getElementById('tabelaUsuariosWrap');
  try {
    const users = await api.get('/admin/usuarios');
    usuariosCache = users;

    wrap.innerHTML = `
      <div class="admin-stats">
        <div class="admin-stat">
          <div class="admin-stat__label">Total Clientes</div>
          <div class="admin-stat__val">${users.length}</div>
        </div>
        <div class="admin-stat">
          <div class="admin-stat__label">Com pedidos</div>
          <div class="admin-stat__val admin-stat__val--green">${users.filter(u => Number(u.pedidos_count) > 0).length}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>Nome</th><th>E-mail</th><th>Pedidos</th><th>Cadastro</th><th>Ações</th></tr></thead>
        <tbody>
          ${users.map(u => {
            return `
            <tr>
              <td style="font-weight:600">${safeText(u.nome)}</td>
              <td style="color:var(--text-muted)">${safeText(u.email)}</td>
              <td>${u.pedidos_count ?? 0}</td>
              <td style="color:var(--text-muted);font-size:.82rem">${new Date(u.created_at).toLocaleString('pt-BR')}</td>
              <td>
                <button class="btn btn--danger btn--sm" onclick="confirmDeleteUsuario(${u.id})">Excluir</button>
              </td>
            </tr>
          `;}).join('')}
        </tbody>
      </table>
    `;
  } catch(e) {
    wrap.innerHTML = '<div class="loading-state" style="color:var(--danger)">Erro ao carregar usuários.</div>';
  }
}

function confirmDeleteUsuario(id) {
  const u = usuariosCache.find(u => String(u.id) === String(id));
  if (!u) return;
  usuarioDeleteTargetId = id;
  const body = document.getElementById('usuarioDeleteBody');
  const pedidos = Number(u.pedidos_count || 0);
  body.innerHTML = `
    <p>Tem certeza que deseja excluir o cliente <strong>${safeText(u.nome)}</strong> (${safeText(u.email)})?</p>
    ${pedidos > 0 ? `<p style="color:var(--text-muted);font-size:.85rem;margin-top:.5rem">Este usuário possui ${pedidos} pedido(s) — eles serão mantidos no histórico, apenas desvinculados da conta.</p>` : ''}
    <p style="color:var(--danger);font-size:.85rem;margin-top:.5rem">Esta ação não pode ser desfeita.</p>
  `;
  document.getElementById('usuarioDeleteOverlay').style.display = 'flex';
}

async function doDeleteUsuario() {
  if (!usuarioDeleteTargetId) return;
  const btn = document.getElementById('btnConfirmDeleteUsuario');
  if (btn) { btn.disabled = true; btn.textContent = 'Excluindo...'; }
  try {
    await api.delete(`/admin/usuarios/${usuarioDeleteTargetId}`);
    showToast('Cliente excluído.');
    document.getElementById('usuarioDeleteOverlay').style.display = 'none';
    usuarioDeleteTargetId = null;
    await loadUsuarios();
  } catch(e) {
    showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Excluir'; }
  }
}

function applyAdminFilters() {
  const q = normalizeText(document.getElementById('adminBusca')?.value || '');
  const statusFilter = document.getElementById('adminFiltroStatus')?.value || '';
  const tipoFilter   = document.getElementById('adminFiltroTipo')?.value   || '';
  const categoriaFilter = document.getElementById('adminFiltroCategoria')?.value || '';
  const ordem        = document.getElementById('adminOrdem')?.value         || 'nome';

  let list = [...allProdutosAdmin];
  if (q) list = list.filter(p =>
    normalizeText(p.nome).includes(q) ||
    normalizeText(p.sku  || '').includes(q) ||
    normalizeText(p.time || '').includes(q)
  );
  if (statusFilter) list = list.filter(p => (p.status || 'ativo') === statusFilter);
  if (tipoFilter)   list = list.filter(p => p.tipo === tipoFilter);
  if (categoriaFilter) list = list.filter(p => String(p.categoria_id || '') === String(categoriaFilter));

  switch (ordem) {
    case 'preco_asc':  list.sort((a, b) => a.preco - b.preco); break;
    case 'preco_desc': list.sort((a, b) => b.preco - a.preco); break;
    case 'estoque':    list.sort((a, b) => a.estoque - b.estoque); break;
    case 'recente':    list.sort((a, b) => b.id - a.id); break;
    default:           list.sort((a, b) => (a.nome||'').localeCompare(b.nome||'','pt-BR')); break;
  }

  filteredProdutos = list;
  currentPage = 1;
  ligaPage = 1;
  selectedProdutoIds.clear();
  updateBulkBar();
  renderTabelaProdutos();
}

// ── Product actions ───────────────────────────────────────────────────────────

async function duplicateProduto(id) {
  try {
    const novo = await api.post(`/produtos/${id}/duplicar`, {});
    allProdutosAdmin.unshift(novo);
    applyAdminFilters();
    showToast('Produto duplicado!');
  } catch(e) {
    showToast(e.message, 'error');
  }
}

async function toggleStatus(id, currentStatus) {
  const novoStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo';
  try {
    await api.patch(`/produtos/${id}/status`, { status: novoStatus });
    const p = allProdutosAdmin.find(p => String(p.id) === String(id));
    if (p) p.status = novoStatus;
    applyAdminFilters();
    showToast(novoStatus === 'ativo' ? 'Produto ativado.' : 'Produto desativado.');
  } catch(e) {
    showToast(e.message, 'error');
  }
}

async function toggleDestaque(id, currentDestaque) {
  const novoDestaque = !currentDestaque;
  try {
    await api.patch(`/produtos/${id}/destaque`, { destaque: novoDestaque });
    const p = allProdutosAdmin.find(p => String(p.id) === String(id));
    if (p) p.destaque = novoDestaque;
    applyAdminFilters();
    showToast(novoDestaque ? 'Marcado como destaque.' : 'Destaque removido.');
  } catch(e) {
    showToast(e.message, 'error');
  }
}

// ── Bulk selection ────────────────────────────────────────────────────────────

function toggleProdutoSelection(id) {
  const sid = String(id);
  if (selectedProdutoIds.has(sid)) selectedProdutoIds.delete(sid);
  else selectedProdutoIds.add(sid);
  updateBulkBar();
}

function toggleAllSelection(checked) {
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const page = filteredProdutos.slice(start, start + ITEMS_PER_PAGE);
  page.forEach(p => {
    if (checked) selectedProdutoIds.add(String(p.id));
    else selectedProdutoIds.delete(String(p.id));
  });
  updateBulkBar();
  renderTabelaProdutos();
}

function updateBulkBar() {
  const bar = document.getElementById('bulkBar');
  if (!bar) return;
  const count = selectedProdutoIds.size;
  bar.classList.toggle('visible', count > 0);
  const countEl = bar.querySelector('.bulk-bar__count');
  if (countEl) countEl.textContent = `${count} produto${count !== 1 ? 's' : ''} selecionado${count !== 1 ? 's' : ''}`;
}

function clearSelection() {
  selectedProdutoIds.clear();
  updateBulkBar();
  renderTabelaProdutos();
}

// ── Export / Import CSV ───────────────────────────────────────────────────────

async function exportarCSV() {
  try {
    const res = await fetch(`${API_BASE}/produtos/export`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Erro ao exportar');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `produtos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exportado!');
  } catch(e) {
    showToast(e.message, 'error');
  }
}

async function importarCSV(file) {
  if (!file) return;
  if (!/\.csv$/i.test(file.name)) {
    showToast('Selecione um arquivo com extensão .csv.', 'error');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast('O arquivo CSV deve ter no máximo 2 MB.', 'error');
    return;
  }
  try {
    const csv = await file.text();
    const report = await api.post('/produtos/import', { csv, preview: true });
    showCsvImportPreview(report, csv, file.name);
  } catch(e) {
    showToast(e.message, 'error');
  }
}

function createCsvPreviewElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  return element;
}

function closeCsvImportPreview() {
  document.getElementById('csvImportPreviewOverlay')?.remove();
}

function showCsvImportPreview(report, csv, fileName) {
  closeCsvImportPreview();
  const overlay = createCsvPreviewElement('div', 'modal-overlay');
  overlay.id = 'csvImportPreviewOverlay';
  overlay.style.display = 'flex';
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeCsvImportPreview();
  });
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeCsvImportPreview();
  });

  const modal = createCsvPreviewElement('section', 'modal');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'csvImportPreviewTitle');
  modal.style.width = 'min(960px, 94vw)';
  modal.style.maxHeight = '90vh';
  modal.style.overflow = 'hidden';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';

  const header = createCsvPreviewElement('div', 'modal__header');
  const titleWrap = createCsvPreviewElement('div');
  const title = createCsvPreviewElement('h2', '', 'Pré-visualização da importação');
  title.id = 'csvImportPreviewTitle';
  const fileLabel = createCsvPreviewElement('p', '', fileName);
  fileLabel.style.color = 'var(--text-muted)';
  fileLabel.style.fontSize = '.82rem';
  titleWrap.append(title, fileLabel);
  const closeButton = createCsvPreviewElement('button', 'modal__close', '×');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Fechar pré-visualização');
  closeButton.addEventListener('click', closeCsvImportPreview);
  header.append(titleWrap, closeButton);

  const body = createCsvPreviewElement('div');
  body.style.padding = '1rem 1.5rem';
  body.style.overflow = 'auto';
  const summary = report.summary || {};
  const summaryText = createCsvPreviewElement(
    'p',
    '',
    `${summary.totalRows || 0} linha(s): ${summary.validRows || 0} válida(s) e ${summary.invalidRows || 0} com erro.`
  );
  summaryText.style.marginBottom = '1rem';
  summaryText.style.color = report.canImport ? 'var(--success)' : 'var(--danger)';
  body.appendChild(summaryText);

  const tableWrap = createCsvPreviewElement('div', 'table-wrap');
  tableWrap.style.overflowX = 'auto';
  const table = createCsvPreviewElement('table', 'admin-table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const label of ['Linha', 'Produto', 'SKU', 'Preço', 'Categoria', 'Estoque', 'Resultado']) {
    headerRow.appendChild(createCsvPreviewElement('th', '', label));
  }
  thead.appendChild(headerRow);
  const tbody = document.createElement('tbody');
  const reportRows = report.rows || [];
  const invalidRows = reportRows.filter((row) => !row.valid);
  const validRows = reportRows.filter((row) => row.valid);
  const visibleRows = reportRows.length <= 250
    ? reportRows
    : [...invalidRows, ...validRows.slice(0, Math.max(0, 250 - invalidRows.length))]
      .sort((a, b) => Number(a.line) - Number(b.line));
  for (const row of visibleRows) {
    const tr = document.createElement('tr');
    const product = row.product || {};
    const errorText = row.valid
      ? 'Válida'
      : (row.errors || []).map((error) => `${error.field}: ${error.message}`).join(' | ');
    const values = [
      row.line,
      product.nome || '—',
      product.sku || '—',
      product.preco == null ? '—' : formatBRL(product.preco),
      product.categoria || 'Sem categoria',
      product.estoque ?? 0,
      errorText,
    ];
    for (const [index, value] of values.entries()) {
      const td = createCsvPreviewElement('td', '', value);
      if (index === values.length - 1) td.style.color = row.valid ? 'var(--success)' : 'var(--danger)';
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.append(thead, tbody);
  tableWrap.appendChild(table);
  body.appendChild(tableWrap);
  if (reportRows.length > visibleRows.length) {
    body.appendChild(createCsvPreviewElement(
      'p',
      '',
      `Exibindo todas as linhas com erro e ${visibleRows.length - invalidRows.length} linha(s) válida(s) de ${reportRows.length}.`
    ));
  }

  const actions = createCsvPreviewElement('div', 'form-actions');
  actions.style.padding = '1rem 1.5rem';
  const cancelButton = createCsvPreviewElement('button', 'btn btn--outline', 'Cancelar');
  cancelButton.type = 'button';
  cancelButton.addEventListener('click', closeCsvImportPreview);
  const importButton = createCsvPreviewElement('button', 'btn btn--primary', 'Confirmar importação');
  importButton.type = 'button';
  importButton.disabled = !report.canImport;
  importButton.title = report.canImport ? '' : 'Corrija todas as linhas inválidas antes de importar.';
  importButton.addEventListener('click', async () => {
    importButton.disabled = true;
    importButton.textContent = 'Importando...';
    try {
      const result = await api.post('/produtos/import', { csv, preview: false });
      closeCsvImportPreview();
      await loadProdutosAdmin();
      showToast(`${result.summary.imported} produto(s) importado(s) com sucesso.`);
    } catch (error) {
      if (error.details?.rows) showCsvImportPreview(error.details, csv, fileName);
      showToast(error.message, 'error');
    } finally {
      importButton.disabled = false;
      importButton.textContent = 'Confirmar importação';
    }
  });
  actions.append(cancelButton, importButton);
  modal.append(header, body, actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  closeButton.focus();
}

// ── Bulk Price ────────────────────────────────────────────────────────────────

function openBulkPriceModal() {
  if (selectedProdutoIds.size === 0) {
    showToast('Selecione ao menos um produto.', 'error'); return;
  }
  document.getElementById('bulkPriceOverlay').style.display = 'flex';
}

async function salvarBulkPrice() {
  const tipo  = document.getElementById('bulkPriceTipo')?.value;
  const valor = parseFloat(document.getElementById('bulkPriceValor')?.value);
  if (!tipo || isNaN(valor) || valor <= 0) {
    showToast('Preencha tipo e valor.', 'error'); return;
  }
  const ids = [...selectedProdutoIds].map(Number);
  const btn = document.getElementById('btnConfirmBulkPrice');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
  try {
    await api.post('/produtos/bulk-price', { ids, tipo, valor });
    await loadProdutosAdmin();
    clearSelection();
    document.getElementById('bulkPriceOverlay').style.display = 'none';
    showToast('Preços atualizados!');
  } catch(e) {
    showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Aplicar'; }
  }
}

// ── Form section toggle (Logística / SEO) ─────────────────────────────────────

function toggleFormSection(id) {
  const body = document.getElementById(id);
  if (!body) return;
  body.style.display = body.style.display === 'none' ? '' : 'none';
}

// ── Action dropdown ───────────────────────────────────────────────────────────

function toggleDropdown(id) {
  const dd = document.getElementById(id);
  if (!dd) return;
  const isOpen = dd.classList.contains('open');
  closeAllDropdowns();
  if (isOpen) return;

  // O menu usa position:fixed (calculado aqui) em vez de absolute porque, na
  // vista por ligas, o accordion (.time-section) tem overflow:hidden para
  // arredondar os cantos — isso cortava o dropdown ao abrir perto da borda.
  const btn = dd.querySelector('button');
  const menu = dd.querySelector('.action-dropdown__menu');
  dd.classList.add('open');
  if (btn && menu) {
    const rect = btn.getBoundingClientRect();
    const menuWidth = menu.offsetWidth || 160;
    const maxLeft = window.innerWidth - menuWidth - 4;
    const left = Math.max(4, Math.min(rect.right - menuWidth, maxLeft));
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${left}px`;
    menu.style.right = 'auto';
  }
}

function closeAllDropdowns() {
  document.querySelectorAll('.action-dropdown.open').forEach(d => {
    d.classList.remove('open');
    const menu = d.querySelector('.action-dropdown__menu');
    if (menu) { menu.style.position = ''; menu.style.top = ''; menu.style.left = ''; menu.style.right = ''; }
  });
}

// ── Cupons ────────────────────────────────────────────────────────────────────

let cuponsCache = [];
let cupomDeleteTargetId = null;

async function loadCuponsAdmin() {
  const wrap = document.getElementById('tabelaCuponsWrap');
  try {
    cuponsCache = await api.get('/cupons');
    renderTabelaCupons();
  } catch (e) {
    wrap.innerHTML = '<div class="loading-state" style="color:var(--danger)">Erro ao carregar cupons.</div>';
  }
}

function _formatCupomValor(c) {
  return c.tipo_desconto === 'fixo' ? formatBRL(c.valor) : `${Number(c.valor)}%`;
}

function _formatCupomValidade(c) {
  if (!c.data_inicio && !c.data_fim) return 'Sem prazo';
  const ini = c.data_inicio ? new Date(c.data_inicio).toLocaleDateString('pt-BR') : '—';
  const fim = c.data_fim ? new Date(c.data_fim).toLocaleDateString('pt-BR') : '—';
  return `${ini} a ${fim}`;
}

function renderTabelaCupons() {
  const wrap = document.getElementById('tabelaCuponsWrap');
  if (!wrap) return;

  if (cuponsCache.length === 0) {
    wrap.innerHTML = '<div class="loading-state">Nenhum cupom cadastrado.</div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Código</th><th>Descrição</th><th>Desconto</th><th>Mín. compra</th>
          <th>Validade</th><th>Uso</th><th>Status</th><th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${cuponsCache.map(c => {
          const isAtivo = c.status === 'ativo';
          const usoLimite = c.limite_uso_total ? `${c.uso_total}/${c.limite_uso_total}` : `${c.uso_total}/∞`;
          return `
          <tr>
            <td style="font-weight:700">${safeText(c.codigo)}${c.frete_gratis ? ' <span class=\"td-badge\">Frete grátis</span>' : ''}</td>
            <td style="color:var(--text-muted)">${safeText(c.descricao || '—')}</td>
            <td>${_formatCupomValor(c)}</td>
            <td>${c.valor_minimo_compra ? formatBRL(c.valor_minimo_compra) : '—'}</td>
            <td style="color:var(--text-muted);font-size:.82rem">${_formatCupomValidade(c)}</td>
            <td>
              <span style="cursor:pointer;text-decoration:underline" onclick="verUsosCupom(${c.id})" title="Ver pedidos">${usoLimite}</span>
            </td>
            <td><span class="td-badge ${isAtivo ? '' : 'td-badge--off'}">${isAtivo ? 'Ativo' : 'Inativo'}</span></td>
            <td>
              <div class="action-dropdown" id="cupomActions${c.id}">
                <button class="btn btn--outline btn--sm" onclick="toggleDropdown('cupomActions${c.id}')">Ações ▾</button>
                <div class="action-dropdown__menu">
                  <div class="action-dropdown__item" onclick="closeAllDropdowns();openEditCupomModal(${c.id})">Editar</div>
                  <div class="action-dropdown__item" onclick="closeAllDropdowns();duplicarCupomAdmin(${c.id})">Duplicar</div>
                  <div class="action-dropdown__item" onclick="closeAllDropdowns();toggleCupomStatus(${c.id},'${isAtivo ? 'ativo' : 'inativo'}')">${isAtivo ? 'Desativar' : 'Ativar'}</div>
                  <div class="action-dropdown__item" onclick="closeAllDropdowns();verUsosCupom(${c.id})">Ver utilizações</div>
                  <div class="action-dropdown__sep"></div>
                  <div class="action-dropdown__item action-dropdown__item--danger" onclick="closeAllDropdowns();confirmDeleteCupom(${c.id})">Excluir</div>
                </div>
              </div>
            </td>
          </tr>
        `;}).join('')}
      </tbody>
    </table>
  `;
}

function _toDatetimeLocal(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function _populateCupomMultiSelect(selectId, filterId, items, labelFn, selectedIds = []) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const selecionados = selectedIds.map(String);
  sel.replaceChildren(...items.map((item) => {
    const option = document.createElement('option');
    option.value = String(item.id);
    option.selected = selecionados.includes(String(item.id));
    option.textContent = labelFn(item);
    return option;
  }));

  const filtro = document.getElementById(filterId);
  if (filtro) {
    filtro.value = '';
    filtro.oninput = () => {
      const termo = normalizeText(filtro.value);
      sel.querySelectorAll('option').forEach(opt => {
        opt.style.display = normalizeText(opt.textContent).includes(termo) ? '' : 'none';
      });
    };
  }
}

async function _populateCupomPickers(cupom = null) {
  if (allProdutosAdmin.length === 0) await loadProdutosAdmin();
  if (usuariosCache.length === 0) await loadUsuarios();

  _populateCupomMultiSelect('cpCategoriasIds', 'cpFiltroCategorias', categoriasAdmin, c => c.nome, cupom?.categorias_ids || []);
  _populateCupomMultiSelect('cpProdutosIds', 'cpFiltroProdutos', allProdutosAdmin, p => `${p.nome}${p.sku ? ' — ' + p.sku : ''}`, cupom?.produtos_ids || []);
  _populateCupomMultiSelect('cpClientesIds', 'cpFiltroClientes', usuariosCache, u => `${u.nome} (${u.email})`, cupom?.clientes_ids || []);
}

async function openNewCupomModal() {
  document.getElementById('formCupom').reset();
  document.getElementById('cupomId').value = '';
  document.getElementById('cpStatus').value = 'ativo';
  document.getElementById('cpTipoDesconto').value = 'percentual';
  document.getElementById('cupomModalTitle').textContent = 'Novo Cupom';
  document.getElementById('cupomModalOverlay').style.display = 'flex';
  await _populateCupomPickers();
}

async function openEditCupomModal(id) {
  const c = cuponsCache.find(x => x.id === id);
  if (!c) { showToast('Cupom não encontrado.', 'error'); return; }

  document.getElementById('cupomId').value = c.id;
  document.getElementById('cpCodigo').value = c.codigo;
  document.getElementById('cpDescricao').value = c.descricao || '';
  document.getElementById('cpTipoDesconto').value = c.tipo_desconto;
  document.getElementById('cpValor').value = c.valor;
  document.getElementById('cpValorMinimo').value = c.valor_minimo_compra || '';
  document.getElementById('cpDescontoMaximo').value = c.desconto_maximo || '';
  document.getElementById('cpDataInicio').value = _toDatetimeLocal(c.data_inicio);
  document.getElementById('cpDataFim').value = _toDatetimeLocal(c.data_fim);
  document.getElementById('cpLimiteTotal').value = c.limite_uso_total || '';
  document.getElementById('cpLimitePorUsuario').value = c.limite_uso_por_usuario || '';
  document.getElementById('cpFreteGratis').checked = Boolean(c.frete_gratis);
  document.getElementById('cpStatus').value = c.status;

  document.getElementById('cupomModalTitle').textContent = 'Editar Cupom';
  document.getElementById('cupomModalOverlay').style.display = 'flex';
  await _populateCupomPickers(c);
}

function closeCupomModal() {
  document.getElementById('cupomModalOverlay').style.display = 'none';
}

function _selectedValues(selectId) {
  return Array.from(document.getElementById(selectId)?.selectedOptions || []).map(o => Number(o.value));
}

async function saveCupom(e) {
  e.preventDefault();
  const id = document.getElementById('cupomId').value;

  const data = {
    codigo: document.getElementById('cpCodigo').value.trim().toUpperCase(),
    descricao: document.getElementById('cpDescricao').value.trim(),
    tipo_desconto: document.getElementById('cpTipoDesconto').value,
    valor: Number(document.getElementById('cpValor').value),
    valor_minimo_compra: Number(document.getElementById('cpValorMinimo').value) || 0,
    desconto_maximo: document.getElementById('cpDescontoMaximo').value ? Number(document.getElementById('cpDescontoMaximo').value) : null,
    data_inicio: document.getElementById('cpDataInicio').value || null,
    data_fim: document.getElementById('cpDataFim').value || null,
    limite_uso_total: document.getElementById('cpLimiteTotal').value ? Number(document.getElementById('cpLimiteTotal').value) : null,
    limite_uso_por_usuario: document.getElementById('cpLimitePorUsuario').value ? Number(document.getElementById('cpLimitePorUsuario').value) : null,
    frete_gratis: document.getElementById('cpFreteGratis').checked,
    status: document.getElementById('cpStatus').value,
    categorias_ids: _selectedValues('cpCategoriasIds'),
    produtos_ids: _selectedValues('cpProdutosIds'),
    clientes_ids: _selectedValues('cpClientesIds'),
  };

  const btn = document.getElementById('btnSalvarCupom');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
  try {
    if (id) {
      await api.put(`/cupons/${id}`, data);
      showToast('Cupom atualizado!');
    } else {
      await api.post('/cupons', data);
      showToast('Cupom criado!');
    }
    closeCupomModal();
    await loadCuponsAdmin();
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar Cupom'; }
  }
}

async function toggleCupomStatus(id, currentStatus) {
  try {
    const novo = currentStatus === 'ativo' ? 'inativo' : 'ativo';
    await api.patch(`/cupons/${id}/status`, { status: novo });
    showToast(novo === 'ativo' ? 'Cupom ativado.' : 'Cupom desativado.');
    await loadCuponsAdmin();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function duplicarCupomAdmin(id) {
  try {
    await api.post(`/cupons/${id}/duplicar`, {});
    showToast('Cupom duplicado.');
    await loadCuponsAdmin();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function confirmDeleteCupom(id) {
  const c = cuponsCache.find(x => x.id === id);
  if (!c) return;
  cupomDeleteTargetId = id;
  document.getElementById('cupomDeleteBody').innerHTML =
    `<p>Tem certeza que deseja excluir o cupom <strong>${safeText(c.codigo)}</strong>? Esta ação não pode ser desfeita.</p>`;
  document.getElementById('cupomDeleteOverlay').style.display = 'flex';
}

async function doDeleteCupom() {
  if (!cupomDeleteTargetId) return;
  const btn = document.getElementById('btnConfirmDeleteCupom');
  if (btn) { btn.disabled = true; btn.textContent = 'Excluindo...'; }
  try {
    await api.delete(`/cupons/${cupomDeleteTargetId}`);
    showToast('Cupom excluído.');
    document.getElementById('cupomDeleteOverlay').style.display = 'none';
    cupomDeleteTargetId = null;
    await loadCuponsAdmin();
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Excluir'; }
  }
}

async function verUsosCupom(id) {
  const c = cuponsCache.find(x => x.id === id);
  const overlay = document.getElementById('cupomUsosOverlay');
  const body = document.getElementById('cupomUsosBody');
  document.getElementById('cupomUsosTitle').textContent = `Utilizações — ${c?.codigo || ''}`;
  body.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  overlay.style.display = 'flex';

  try {
    const { uso_total, pedidos } = await api.get(`/cupons/${id}/usos`);
    if (pedidos.length === 0) {
      body.innerHTML = '<p style="color:var(--text-muted)">Este cupom ainda não foi utilizado em nenhum pedido.</p>';
      return;
    }
    body.innerHTML = `
      <p style="color:var(--text-muted);margin-bottom:.75rem">${uso_total} utilização(ões)</p>
      <table>
        <thead><tr><th>Pedido</th><th>Cliente</th><th>Desconto</th><th>Total</th><th>Data</th></tr></thead>
        <tbody>
          ${pedidos.map(p => `
            <tr>
              <td>#${p.id}</td>
              <td>${safeText(p.nome_cliente || p.email_cliente || '—')}</td>
              <td>${formatBRL(p.cupom_desconto || 0)}</td>
              <td>${formatBRL(p.total)}</td>
              <td style="font-size:.8rem;color:var(--text-muted)">${new Date(p.created_at).toLocaleString('pt-BR')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    body.innerHTML = `<p style="color:var(--danger)">Erro ao carregar utilizações.</p>`;
  }
}

// ── Promoções ────────────────────────────────────────────────────────────────
let promocoesCache = [];
let promocaoDeleteTargetId = null;

const PROMO_TIPO_LABEL = {
  percentual: 'Desconto %',
  fixo: 'Desconto fixo',
  preco_fixo: 'Preço fixo',
  compre_x_leve_y: 'Compre X leve Y',
  progressivo: 'Progressivo',
};

async function loadPromocoesAdmin() {
  const wrap = document.getElementById('tabelaPromocoesWrap');
  try {
    promocoesCache = await api.get('/promocoes');
    renderTabelaPromocoes();
  } catch (e) {
    wrap.innerHTML = '<div class="loading-state" style="color:var(--danger)">Erro ao carregar promoções.</div>';
  }
}

function _formatPromoValor(p) {
  if (p.tipo === 'percentual') return `${Number(p.valor)}%`;
  if (p.tipo === 'fixo') return `− ${formatBRL(p.valor)}`;
  if (p.tipo === 'preco_fixo') return `${formatBRL(p.valor)} (fixo)`;
  if (p.tipo === 'compre_x_leve_y') return `Compre ${p.compre_qtd} leve ${p.leve_qtd}`;
  if (p.tipo === 'progressivo') {
    const regras = p.regras_progressivas || [];
    return regras.map(r => `${r.qtd_minima}+: ${r.desconto_pct}%`).join(' · ') || '—';
  }
  return '—';
}

function renderTabelaPromocoes() {
  const wrap = document.getElementById('tabelaPromocoesWrap');
  if (!wrap) return;

  if (promocoesCache.length === 0) {
    wrap.innerHTML = '<div class="loading-state">Nenhuma promoção cadastrada.</div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Nome</th><th>Tipo</th><th>Desconto</th><th>Validade</th><th>Destaque</th><th>Status</th><th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${promocoesCache.map(p => {
          const isAtivo = p.status === 'ativo';
          return `
          <tr>
            <td style="font-weight:700">${safeText(p.nome)}</td>
            <td>${safeText(PROMO_TIPO_LABEL[p.tipo] || p.tipo)}</td>
            <td style="font-size:.82rem">${safeText(_formatPromoValor(p))}</td>
            <td style="color:var(--text-muted);font-size:.82rem">${safeText(_formatCupomValidade(p))}</td>
            <td>${p.destaque ? '<span class="td-badge">Sim</span>' : '—'}${p.mostrar_contador ? ' <span class="td-badge">Contador</span>' : ''}</td>
            <td><span class="td-badge ${isAtivo ? '' : 'td-badge--off'}">${isAtivo ? 'Ativo' : 'Inativo'}</span></td>
            <td>
              <div class="action-dropdown" id="promoActions${p.id}">
                <button class="btn btn--outline btn--sm" onclick="toggleDropdown('promoActions${p.id}')">Ações ▾</button>
                <div class="action-dropdown__menu">
                  <div class="action-dropdown__item" onclick="closeAllDropdowns();openEditPromocaoModal(${p.id})">Editar</div>
                  <div class="action-dropdown__item" onclick="closeAllDropdowns();togglePromocaoStatus(${p.id},'${isAtivo ? 'ativo' : 'inativo'}')">${isAtivo ? 'Desativar' : 'Ativar'}</div>
                  <div class="action-dropdown__sep"></div>
                  <div class="action-dropdown__item action-dropdown__item--danger" onclick="closeAllDropdowns();confirmDeletePromocao(${p.id})">Excluir</div>
                </div>
              </div>
            </td>
          </tr>
        `;}).join('')}
      </tbody>
    </table>
  `;
}

function updatePromoTipoFields() {
  const tipo = document.getElementById('promoTipo').value;
  document.getElementById('grpPromoValor').style.display = ['percentual', 'fixo', 'preco_fixo'].includes(tipo) ? '' : 'none';
  document.getElementById('grpPromoCompreLeve').style.display = tipo === 'compre_x_leve_y' ? '' : 'none';
  document.getElementById('grpPromoProgressivo').style.display = tipo === 'progressivo' ? '' : 'none';

  const labels = {
    percentual: 'Valor do desconto (%) *',
    fixo: 'Valor do desconto (R$) *',
    preco_fixo: 'Preço promocional (R$) *',
  };
  const lbl = document.getElementById('lblPromoValor');
  if (lbl && labels[tipo]) lbl.textContent = labels[tipo];
}

function renderPromoRegrasList(regras) {
  const cont = document.getElementById('promoRegrasList');
  cont.innerHTML = regras.map((r, i) => `
    <div class="form-cols-2 promo-regra-row" data-idx="${i}" style="margin-bottom:.5rem">
      <div class="form-group" style="margin-bottom:0">
        <label>A partir de (qtd.)</label>
        <input type="number" class="promoRegraQtd" min="1" step="1" value="${r.qtd_minima ?? ''}" />
      </div>
      <div class="form-group" style="margin-bottom:0;display:flex;gap:.5rem;align-items:flex-end">
        <div style="flex:1">
          <label>Desconto (%)</label>
          <input type="number" class="promoRegraPct" min="1" max="100" step="0.01" value="${r.desconto_pct ?? ''}" />
        </div>
        <button type="button" class="btn btn--ghost btn--sm" onclick="removerRegraProgressiva(this)">Remover</button>
      </div>
    </div>
  `).join('');
}

function removerRegraProgressiva(btn) {
  btn.closest('.promo-regra-row').remove();
}

function coletarRegrasProgressivas() {
  return Array.from(document.querySelectorAll('#promoRegrasList .promo-regra-row')).map(row => ({
    qtd_minima: Number(row.querySelector('.promoRegraQtd').value),
    desconto_pct: Number(row.querySelector('.promoRegraPct').value),
  }));
}

async function _populatePromocaoPickers(promo = null) {
  if (allProdutosAdmin.length === 0) await loadProdutosAdmin();

  _populateCupomMultiSelect('promoCategoriasIds', 'promoFiltroCategorias', categoriasAdmin, c => c.nome, promo?.categorias_ids || []);
  _populateCupomMultiSelect('promoProdutosIds', 'promoFiltroProdutos', allProdutosAdmin, p => `${p.nome}${p.sku ? ' — ' + p.sku : ''}`, promo?.produtos_ids || []);
}

async function openNovaPromocaoModal() {
  document.getElementById('formPromocao').reset();
  document.getElementById('promoId').value = '';
  document.getElementById('promoStatus').value = 'ativo';
  document.getElementById('promoTipo').value = 'percentual';
  renderPromoRegrasList([]);
  updatePromoTipoFields();
  document.getElementById('promocaoModalTitle').textContent = 'Nova Promoção';
  document.getElementById('promocaoModalOverlay').style.display = 'flex';
  await _populatePromocaoPickers();
}

async function openEditPromocaoModal(id) {
  const p = promocoesCache.find(x => x.id === id);
  if (!p) { showToast('Promoção não encontrada.', 'error'); return; }

  document.getElementById('promoId').value = p.id;
  document.getElementById('promoNome').value = p.nome;
  document.getElementById('promoDescricao').value = p.descricao || '';
  document.getElementById('promoTipo').value = p.tipo;
  document.getElementById('promoValor').value = p.valor ?? '';
  document.getElementById('promoCompreQtd').value = p.compre_qtd ?? '';
  document.getElementById('promoLeveQtd').value = p.leve_qtd ?? '';
  document.getElementById('promoDataInicio').value = _toDatetimeLocal(p.data_inicio);
  document.getElementById('promoDataFim').value = _toDatetimeLocal(p.data_fim);
  document.getElementById('promoDestaque').checked = Boolean(p.destaque);
  document.getElementById('promoMostrarContador').checked = Boolean(p.mostrar_contador);
  document.getElementById('promoStatus').value = p.status;
  renderPromoRegrasList(p.regras_progressivas || []);
  updatePromoTipoFields();

  document.getElementById('promocaoModalTitle').textContent = 'Editar Promoção';
  document.getElementById('promocaoModalOverlay').style.display = 'flex';
  await _populatePromocaoPickers(p);
}

function closePromocaoModal() {
  document.getElementById('promocaoModalOverlay').style.display = 'none';
}

async function savePromocao(e) {
  e.preventDefault();
  const id = document.getElementById('promoId').value;
  const tipo = document.getElementById('promoTipo').value;

  const data = {
    nome: document.getElementById('promoNome').value.trim(),
    descricao: document.getElementById('promoDescricao').value.trim(),
    tipo,
    valor: document.getElementById('promoValor').value ? Number(document.getElementById('promoValor').value) : null,
    compre_qtd: document.getElementById('promoCompreQtd').value ? Number(document.getElementById('promoCompreQtd').value) : null,
    leve_qtd: document.getElementById('promoLeveQtd').value ? Number(document.getElementById('promoLeveQtd').value) : null,
    regras_progressivas: tipo === 'progressivo' ? coletarRegrasProgressivas() : [],
    data_inicio: document.getElementById('promoDataInicio').value || null,
    data_fim: document.getElementById('promoDataFim').value || null,
    destaque: document.getElementById('promoDestaque').checked,
    mostrar_contador: document.getElementById('promoMostrarContador').checked,
    status: document.getElementById('promoStatus').value,
    categorias_ids: _selectedValues('promoCategoriasIds'),
    produtos_ids: _selectedValues('promoProdutosIds'),
  };

  const btn = document.getElementById('btnSalvarPromocao');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
  try {
    if (id) {
      await api.put(`/promocoes/${id}`, data);
      showToast('Promoção atualizada!');
    } else {
      await api.post('/promocoes', data);
      showToast('Promoção criada!');
    }
    closePromocaoModal();
    await loadPromocoesAdmin();
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar Promoção'; }
  }
}

async function togglePromocaoStatus(id, currentStatus) {
  try {
    const novo = currentStatus === 'ativo' ? 'inativo' : 'ativo';
    await api.patch(`/promocoes/${id}/status`, { status: novo });
    showToast(novo === 'ativo' ? 'Promoção ativada.' : 'Promoção desativada.');
    await loadPromocoesAdmin();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function confirmDeletePromocao(id) {
  const p = promocoesCache.find(x => x.id === id);
  if (!p) return;
  promocaoDeleteTargetId = id;
  document.getElementById('promocaoDeleteBody').innerHTML =
    `<p>Tem certeza que deseja excluir a promoção <strong>${safeText(p.nome)}</strong>? Esta ação não pode ser desfeita.</p>`;
  document.getElementById('promocaoDeleteOverlay').style.display = 'flex';
}

async function doDeletePromocao() {
  if (!promocaoDeleteTargetId) return;
  const btn = document.getElementById('btnConfirmDeletePromocao');
  if (btn) { btn.disabled = true; btn.textContent = 'Excluindo...'; }
  try {
    await api.delete(`/promocoes/${promocaoDeleteTargetId}`);
    showToast('Promoção excluída.');
    document.getElementById('promocaoDeleteOverlay').style.display = 'none';
    promocaoDeleteTargetId = null;
    await loadPromocoesAdmin();
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Excluir'; }
  }
}

// ── Avaliações ────────────────────────────────────────────────────────────
let avaliacoesAdminCache = [];

async function loadAvaliacoesAdmin() {
  const wrap = document.getElementById('tabelaAvaliacoesWrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando...</p></div>';
  const status = document.getElementById('filtroAvaliacoesStatus')?.value || '';
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  try {
    avaliacoesAdminCache = await api.get(`/avaliacoes/admin${query}`);
    renderTabelaAvaliacoes();
  } catch (error) {
    wrap.innerHTML = `<div class="loading-state" style="color:var(--danger)">${safeText(error.message || 'Erro ao carregar avaliações.')}</div>`;
  }
}

function renderTabelaAvaliacoes() {
  const wrap = document.getElementById('tabelaAvaliacoesWrap');
  if (!wrap) return;
  if (!avaliacoesAdminCache.length) {
    wrap.innerHTML = '<div class="loading-state">Nenhuma avaliação encontrada para este filtro.</div>';
    return;
  }

  const statusLabel = { pendente: 'Pendente', aprovada: 'Aprovada', rejeitada: 'Rejeitada' };
  wrap.innerHTML = `
    <table>
      <thead><tr><th>Produto</th><th>Cliente</th><th>Nota</th><th>Avaliação</th><th>Status</th><th>Ações</th></tr></thead>
      <tbody>
        ${avaliacoesAdminCache.map((review) => {
          const id = Number(review.id);
          const createdAt = review.created_at ? new Date(review.created_at).toLocaleString('pt-BR') : '—';
          const verified = review.compra_verificada
            ? '<span class="td-badge">Compra confirmada</span>'
            : '<span class="td-badge td-badge--off">Sem comprovação</span>';
          const moderationReason = review.motivo_moderacao
            ? `<div style="margin-top:.35rem;color:var(--text-muted);font-size:.78rem">Motivo: ${safeText(review.motivo_moderacao)}</div>`
            : '';
          return `<tr>
            <td><strong>${safeText(review.produto_nome)}</strong><div style="font-size:.75rem;color:var(--text-muted)">ID ${Number(review.produto_id)}</div></td>
            <td>${safeText(review.autor_nome)}<div style="margin-top:.35rem">${verified}</div></td>
            <td style="white-space:nowrap;color:#f5b301">${'★'.repeat(Number(review.nota))}${'☆'.repeat(5 - Number(review.nota))}</td>
            <td style="min-width:260px"><strong>${safeText(review.titulo || 'Sem título')}</strong><div style="margin-top:.35rem;white-space:normal">${safeText(review.comentario)}</div><div style="margin-top:.35rem;color:var(--text-muted);font-size:.75rem">${safeText(createdAt)}</div></td>
            <td><span class="td-badge ${review.status === 'aprovada' ? '' : 'td-badge--off'}">${safeText(statusLabel[review.status] || review.status)}</span>${moderationReason}</td>
            <td style="white-space:nowrap">
              <button class="btn btn--outline btn--sm" onclick="moderarAvaliacao(${id},'aprovada')" ${review.status === 'aprovada' ? 'disabled' : ''}>Aprovar</button>
              <button class="btn btn--danger btn--sm" onclick="moderarAvaliacao(${id},'rejeitada')" ${review.status === 'rejeitada' ? 'disabled' : ''}>Rejeitar</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

async function moderarAvaliacao(id, status) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) return;
  let motivo = null;
  if (status === 'rejeitada') {
    motivo = window.prompt('Informe ao cliente o motivo da rejeição (mínimo de 5 caracteres):');
    if (motivo === null) return;
    motivo = motivo.trim();
    if (motivo.length < 5) {
      showToast('Informe um motivo com pelo menos 5 caracteres.', 'error');
      return;
    }
  } else if (!window.confirm('Aprovar e publicar esta avaliação?')) {
    return;
  }

  try {
    await api.patch(`/avaliacoes/${Number(id)}/moderar`, { status, motivo });
    showToast(status === 'aprovada' ? 'Avaliação aprovada e publicada.' : 'Avaliação rejeitada.');
    await loadAvaliacoesAdmin();
  } catch (error) {
    showToast(error.message || 'Não foi possível moderar a avaliação.', 'error');
  }
}

// ── Conteúdo, trocas e analytics ─────────────────────────────────────────
let bannersAdminCache = [];
let conteudosAdminCache = [];

async function loadConteudoAdmin() {
  const bannersWrap = document.getElementById('tabelaBannersWrap');
  const conteudosWrap = document.getElementById('tabelaConteudosWrap');
  if (!bannersWrap || !conteudosWrap) return;
  bannersWrap.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando banners...</p></div>';
  conteudosWrap.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando conteúdo...</p></div>';
  try {
    [bannersAdminCache, conteudosAdminCache] = await Promise.all([
      api.get('/recursos/admin/banners'),
      api.get('/recursos/admin/conteudos'),
    ]);
    renderBannersAdmin();
    renderConteudosAdmin();
  } catch (error) {
    const message = `<div class="loading-state" style="color:var(--danger)">${safeText(error.message || 'Erro ao carregar conteúdo.')}</div>`;
    bannersWrap.innerHTML = message;
    conteudosWrap.innerHTML = message;
  }
}

function renderBannersAdmin() {
  const wrap = document.getElementById('tabelaBannersWrap');
  if (!wrap) return;
  if (!bannersAdminCache.length) {
    wrap.innerHTML = '<div class="loading-state">Nenhum banner cadastrado.</div>';
    return;
  }
  wrap.innerHTML = `<table><thead><tr><th>Título</th><th>Posição</th><th>Status</th><th>Ordem</th><th>Ações</th></tr></thead><tbody>${bannersAdminCache.map((banner) => `
    <tr><td><strong>${safeText(banner.titulo)}</strong><div style="font-size:.75rem;color:var(--text-muted)">${safeText(banner.subtitulo || '')}</div></td>
    <td>${safeText(banner.posicao)}</td><td><span class="td-badge ${banner.status === 'ativo' ? '' : 'td-badge--off'}">${safeText(banner.status)}</span></td>
    <td>${Number(banner.ordem) || 0}</td><td style="white-space:nowrap"><button class="btn btn--outline btn--sm" onclick="editarBanner(${Number(banner.id)})">Editar</button> <button class="btn btn--danger btn--sm" onclick="excluirBanner(${Number(banner.id)})">Excluir</button></td></tr>`).join('')}</tbody></table>`;
}

function limparBanner() {
  document.getElementById('formBanner')?.reset();
  document.getElementById('bannerId').value = '';
  document.getElementById('bannerOrdem').value = '0';
}

function editarBanner(id) {
  const banner = bannersAdminCache.find((item) => Number(item.id) === Number(id));
  if (!banner) return;
  document.getElementById('bannerId').value = banner.id;
  document.getElementById('bannerTitulo').value = banner.titulo || '';
  document.getElementById('bannerSubtitulo').value = banner.subtitulo || '';
  document.getElementById('bannerImagem').value = banner.imagem_url || '';
  document.getElementById('bannerLink').value = banner.link_url || '';
  document.getElementById('bannerPosicao').value = banner.posicao || 'home_hero';
  document.getElementById('bannerStatus').value = banner.status || 'ativo';
  document.getElementById('bannerOrdem').value = Number(banner.ordem) || 0;
  document.getElementById('formBanner')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function salvarBanner(event) {
  event.preventDefault();
  const id = document.getElementById('bannerId').value;
  const body = {
    titulo: document.getElementById('bannerTitulo').value.trim(),
    subtitulo: document.getElementById('bannerSubtitulo').value.trim() || null,
    imagem_url: document.getElementById('bannerImagem').value.trim() || null,
    link_url: document.getElementById('bannerLink').value.trim() || null,
    posicao: document.getElementById('bannerPosicao').value,
    status: document.getElementById('bannerStatus').value,
    ordem: Number(document.getElementById('bannerOrdem').value) || 0,
  };
  try {
    if (id) await api.put(`/recursos/admin/banners/${Number(id)}`, body);
    else await api.post('/recursos/admin/banners', body);
    showToast(id ? 'Banner atualizado.' : 'Banner criado.');
    limparBanner();
    await loadConteudoAdmin();
  } catch (error) { showToast(error.message, 'error'); }
}

async function excluirBanner(id) {
  if (!window.confirm('Excluir este banner?')) return;
  try {
    await api.delete(`/recursos/admin/banners/${Number(id)}`);
    showToast('Banner excluído.');
    await loadConteudoAdmin();
  } catch (error) { showToast(error.message, 'error'); }
}

function renderConteudosAdmin() {
  const wrap = document.getElementById('tabelaConteudosWrap');
  if (!wrap) return;
  if (!conteudosAdminCache.length) {
    wrap.innerHTML = '<div class="loading-state">Nenhum conteúdo institucional cadastrado.</div>';
    return;
  }
  wrap.innerHTML = `<table><thead><tr><th>Chave</th><th>Título</th><th>Status</th><th>Atualizado</th><th>Ações</th></tr></thead><tbody>${conteudosAdminCache.map((item) => `
    <tr><td><code>${safeText(item.chave)}</code></td><td>${safeText(item.titulo)}</td><td><span class="td-badge ${item.status === 'ativo' ? '' : 'td-badge--off'}">${safeText(item.status)}</span></td><td>${item.updated_at ? safeText(new Date(item.updated_at).toLocaleString('pt-BR')) : '—'}</td><td><button class="btn btn--outline btn--sm" onclick="editarConteudo('${item.chave}')">Editar</button></td></tr>`).join('')}</tbody></table>`;
}

function editarConteudo(chave) {
  const item = conteudosAdminCache.find((entry) => entry.chave === chave);
  if (!item) return;
  document.getElementById('conteudoChave').value = item.chave;
  document.getElementById('conteudoTitulo').value = item.titulo || '';
  document.getElementById('conteudoTexto').value = item.conteudo || '';
  document.getElementById('conteudoStatus').value = item.status || 'ativo';
  document.getElementById('formConteudoInstitucional')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function salvarConteudo(event) {
  event.preventDefault();
  try {
    await api.put('/recursos/admin/conteudos', {
      chave: document.getElementById('conteudoChave').value.trim(),
      titulo: document.getElementById('conteudoTitulo').value.trim(),
      conteudo: document.getElementById('conteudoTexto').value.trim(),
      status: document.getElementById('conteudoStatus').value,
    });
    showToast('Conteúdo salvo.');
    await loadConteudoAdmin();
  } catch (error) { showToast(error.message, 'error'); }
}

async function loadTrocasAdmin() {
  const wrap = document.getElementById('tabelaTrocasWrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando...</p></div>';
  const status = document.getElementById('filtroTrocasStatus')?.value || '';
  try {
    const items = await api.get(`/recursos/admin/trocas${status ? `?status=${encodeURIComponent(status)}` : ''}`);
    if (!items.length) { wrap.innerHTML = '<div class="loading-state">Nenhuma solicitação encontrada.</div>'; return; }
    wrap.innerHTML = `<table><thead><tr><th>Pedido</th><th>Cliente</th><th>Solicitação</th><th>Status</th><th>Ação</th></tr></thead><tbody>${items.map((item) => {
      let productIds = [];
      try { productIds = typeof item.itens === 'string' ? JSON.parse(item.itens) : item.itens || []; } catch (_) {}
      return `<tr><td>#${Number(item.pedido_id)}</td><td><strong>${safeText(item.cliente_nome)}</strong><div style="font-size:.75rem">${safeText(item.cliente_email)}</div></td><td><strong>${safeText(item.tipo)}</strong><div style="max-width:340px;white-space:normal">${safeText(item.motivo)}</div><div style="font-size:.75rem">Produtos: ${productIds.map(Number).filter(Number.isSafeInteger).join(', ') || '—'}</div></td><td>${safeText(item.status)}</td><td><button class="btn btn--outline btn--sm" onclick="atualizarTroca(${Number(item.id)})">Analisar</button></td></tr>`;
    }).join('')}</tbody></table>`;
  } catch (error) { wrap.innerHTML = `<div class="loading-state" style="color:var(--danger)">${safeText(error.message)}</div>`; }
}

async function atualizarTroca(id) {
  const status = window.prompt('Novo status: em_analise, aprovada, rejeitada ou concluida');
  if (!status) return;
  const resposta = window.prompt('Resposta ao cliente (obrigatória):');
  if (!resposta) return;
  try {
    await api.patch(`/recursos/admin/trocas/${Number(id)}`, { status: status.trim(), resposta: resposta.trim() });
    showToast('Solicitação atualizada.');
    await loadTrocasAdmin();
  } catch (error) { showToast(error.message, 'error'); }
}

async function loadAnalyticsAdmin() {
  const grid = document.getElementById('analyticsResumo');
  const wrap = document.getElementById('analyticsEventosWrap');
  if (!grid || !wrap) return;
  grid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando...</p></div>';
  try {
    const data = await api.get(`/recursos/admin/analytics?dias=${Number(document.getElementById('analyticsPeriodo')?.value) || 30}`);
    const eventLabels = { page_view: 'Páginas vistas', view_product: 'Produtos vistos', add_to_cart: 'Adições ao carrinho', begin_checkout: 'Checkouts iniciados', purchase: 'Compras' };
    grid.innerHTML = Object.entries(eventLabels).map(([key, label]) => `<div class="dash-kpi"><div class="dash-kpi__label">${label}</div><div class="dash-kpi__value">${Number(data.eventos[key]) || 0}</div></div>`).join('');
    const rates = data.conversao || {};
    wrap.innerHTML = `<table><thead><tr><th>Etapa</th><th>Conversão</th></tr></thead><tbody><tr><td>Produto → carrinho</td><td>${((Number(rates.produto_para_carrinho) || 0) * 100).toFixed(1)}%</td></tr><tr><td>Carrinho → checkout</td><td>${((Number(rates.carrinho_para_checkout) || 0) * 100).toFixed(1)}%</td></tr><tr><td>Checkout → compra</td><td>${((Number(rates.checkout_para_compra) || 0) * 100).toFixed(1)}%</td></tr></tbody></table>`;
  } catch (error) { grid.innerHTML = `<div class="loading-state" style="color:var(--danger)">${safeText(error.message)}</div>`; }
}

// ── Administradores e Permissões ──────────────────────────────────────────
let funcionariosCache = [];

const PERMISSOES = [
  { key: 'produtos.visualizar',      label: 'Visualizar produtos' },
  { key: 'produtos.cadastrar',        label: 'Cadastrar produtos' },
  { key: 'produtos.editar',           label: 'Editar produtos' },
  { key: 'produtos.excluir',          label: 'Excluir produtos' },
  { key: 'categorias.visualizar',     label: 'Visualizar categorias' },
  { key: 'categorias.criar',          label: 'Criar categorias' },
  { key: 'categorias.editar',         label: 'Editar categorias' },
  { key: 'categorias.excluir',        label: 'Excluir categorias' },
  { key: 'estoque.gerenciar',         label: 'Gerenciar estoque' },
  { key: 'pedidos.visualizar',        label: 'Visualizar pedidos' },
  { key: 'pedidos.alterar',           label: 'Alterar pedidos' },
  { key: 'clientes.gerenciar',        label: 'Gerenciar clientes' },
  { key: 'cupons.visualizar',         label: 'Visualizar cupons' },
  { key: 'cupons.criar',              label: 'Criar cupons' },
  { key: 'cupons.editar',             label: 'Editar cupons' },
  { key: 'cupons.excluir',            label: 'Excluir cupons' },
  { key: 'promocoes.visualizar',      label: 'Visualizar promoções' },
  { key: 'promocoes.criar',           label: 'Criar promoções' },
  { key: 'promocoes.editar',          label: 'Editar promoções' },
  { key: 'promocoes.excluir',         label: 'Excluir promoções' },
  { key: 'avaliacoes.visualizar',      label: 'Visualizar avaliações' },
  { key: 'avaliacoes.moderar',         label: 'Moderar avaliações' },
  { key: 'trocas.visualizar',           label: 'Visualizar trocas e devoluções' },
  { key: 'trocas.gerenciar',            label: 'Gerenciar trocas e devoluções' },
  { key: 'conteudo.visualizar',          label: 'Visualizar conteúdo da loja' },
  { key: 'conteudo.gerenciar',           label: 'Gerenciar conteúdo da loja' },
  { key: 'analytics.visualizar',         label: 'Visualizar analytics' },
  { key: 'financeiro.visualizar',     label: 'Visualizar financeiro' },
  { key: 'configuracoes.acessar',     label: 'Acessar configurações' },
  { key: 'administradores.gerenciar', label: 'Gerenciar administradores' },
];

function renderPermissoesGrid(selecionadas = []) {
  const grid = document.getElementById('funcPermissoesGrid');
  if (!grid) return;
  const selecionadasSet = new Set(selecionadas);
  grid.innerHTML = PERMISSOES.map(p => `
    <label>
      <input type="checkbox" class="funcPermissaoCheck" value="${p.key}" ${selecionadasSet.has(p.key) ? 'checked' : ''} />
      ${p.label}
    </label>
  `).join('');
}

function coletarPermissoesSelecionadas() {
  return Array.from(document.querySelectorAll('.funcPermissaoCheck:checked')).map(el => el.value);
}

async function loadFuncionariosAdmin() {
  const wrap = document.getElementById('tabelaFuncionariosWrap');
  try {
    funcionariosCache = await api.get('/admin/funcionarios');
    renderTabelaFuncionarios();
  } catch (e) {
    wrap.innerHTML = '<div class="loading-state" style="color:var(--danger)">Erro ao carregar funcionários.</div>';
  }
}

function renderTabelaFuncionarios() {
  const wrap = document.getElementById('tabelaFuncionariosWrap');
  if (!wrap) return;

  if (funcionariosCache.length === 0) {
    wrap.innerHTML = '<div class="loading-state">Nenhum funcionário cadastrado.</div>';
    return;
  }

  const currentUser = JSON.parse(localStorage.getItem('fc_user') || 'null');

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Nome</th><th>E-mail</th><th>Cargo</th><th>Permissões</th>
          <th>Último acesso</th><th>Status</th><th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${funcionariosCache.map(f => {
          const isAtivo = f.status === 'ativo';
          const isSelf = currentUser && String(currentUser.id) === String(f.id);
          const numPerm = (f.permissoes || []).length;
          return `
          <tr>
            <td style="font-weight:700">${safeText(f.nome)}${isSelf ? ' <span style="color:var(--text-dim);font-size:.75rem">(você)</span>' : ''}</td>
            <td style="color:var(--text-muted)">${safeText(f.email)}</td>
            <td>${safeText(f.cargo || '—')}</td>
            <td style="font-size:.82rem;color:var(--text-muted)">${numPerm === PERMISSOES.length ? 'Todas' : `${numPerm} de ${PERMISSOES.length}`}</td>
            <td style="color:var(--text-muted);font-size:.82rem">${f.ultimo_acesso ? new Date(f.ultimo_acesso).toLocaleString('pt-BR') : 'Nunca acessou'}</td>
            <td><span class="td-badge ${isAtivo ? '' : 'td-badge--off'}">${isAtivo ? 'Ativo' : 'Inativo'}</span></td>
            <td>
              <div class="action-dropdown" id="funcActions${f.id}">
                <button class="btn btn--outline btn--sm" onclick="toggleDropdown('funcActions${f.id}')">Ações ▾</button>
                <div class="action-dropdown__menu">
                  <div class="action-dropdown__item" onclick="closeAllDropdowns();openEditFuncionarioModal(${f.id})">Editar</div>
                  ${isSelf ? '' : `<div class="action-dropdown__item" onclick="closeAllDropdowns();toggleFuncionarioStatus(${f.id},'${isAtivo ? 'ativo' : 'inativo'}')">${isAtivo ? 'Desativar acesso' : 'Ativar acesso'}</div>`}
                  <div class="action-dropdown__item" onclick="closeAllDropdowns();verHistorico(${f.id})">Ver histórico</div>
                </div>
              </div>
            </td>
          </tr>
        `;}).join('')}
      </tbody>
    </table>
  `;
}

function openNovoFuncionarioModal() {
  document.getElementById('formFuncionario').reset();
  document.getElementById('funcId').value = '';
  document.getElementById('funcStatus').value = 'ativo';
  document.getElementById('funcSenha').required = true;
  document.getElementById('lblFuncSenha').textContent = 'Senha *';
  document.getElementById('hintFuncSenha').textContent = '';
  renderPermissoesGrid([]);
  document.getElementById('funcionarioModalTitle').textContent = 'Novo Funcionário';
  document.getElementById('funcionarioModalOverlay').style.display = 'flex';
}

function openEditFuncionarioModal(id) {
  const f = funcionariosCache.find(x => x.id === id);
  if (!f) { showToast('Funcionário não encontrado.', 'error'); return; }

  document.getElementById('funcId').value = f.id;
  document.getElementById('funcNome').value = f.nome;
  document.getElementById('funcEmail').value = f.email;
  document.getElementById('funcCargo').value = f.cargo || '';
  document.getElementById('funcStatus').value = f.status;
  document.getElementById('funcSenha').value = '';
  document.getElementById('funcSenha').required = false;
  document.getElementById('lblFuncSenha').textContent = 'Senha';
  document.getElementById('hintFuncSenha').textContent = 'Deixe em branco para manter a senha atual.';
  renderPermissoesGrid(f.permissoes || []);

  document.getElementById('funcionarioModalTitle').textContent = 'Editar Funcionário';
  document.getElementById('funcionarioModalOverlay').style.display = 'flex';
}

function closeFuncionarioModal() {
  document.getElementById('funcionarioModalOverlay').style.display = 'none';
}

async function saveFuncionario(e) {
  e.preventDefault();
  const id = document.getElementById('funcId').value;

  const data = {
    nome: document.getElementById('funcNome').value.trim(),
    email: document.getElementById('funcEmail').value.trim(),
    cargo: document.getElementById('funcCargo').value.trim(),
    status: document.getElementById('funcStatus').value,
    permissoes: coletarPermissoesSelecionadas(),
  };
  const senha = document.getElementById('funcSenha').value;
  if (senha) data.senha = senha;

  const btn = document.getElementById('btnSalvarFuncionario');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
  try {
    if (id) {
      await api.put(`/admin/funcionarios/${id}`, data);
      showToast('Funcionário atualizado!');
    } else {
      await api.post('/admin/funcionarios', data);
      showToast('Funcionário cadastrado!');
    }
    closeFuncionarioModal();
    await loadFuncionariosAdmin();
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar Funcionário'; }
  }
}

async function toggleFuncionarioStatus(id, currentStatus) {
  try {
    const novo = currentStatus === 'ativo' ? 'inativo' : 'ativo';
    await api.patch(`/admin/funcionarios/${id}/status`, { status: novo });
    showToast(novo === 'ativo' ? 'Acesso reativado.' : 'Acesso desativado.');
    await loadFuncionariosAdmin();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function verHistorico(usuarioId, nome) {
  const overlay = document.getElementById('historicoOverlay');
  const body = document.getElementById('historicoBody');
  const funcionario = funcionariosCache.find((item) => String(item.id) === String(usuarioId));
  document.getElementById('historicoTitle').textContent = usuarioId
    ? `Histórico — ${funcionario?.nome || 'Funcionário'}` : 'Histórico de Ações';
  body.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  overlay.style.display = 'flex';

  try {
    const logs = await api.get(usuarioId ? `/admin/logs?usuario_id=${usuarioId}` : '/admin/logs');
    if (logs.length === 0) {
      body.innerHTML = '<p style="color:var(--text-muted)">Nenhuma ação registrada ainda.</p>';
      return;
    }
    body.innerHTML = `
      <table>
        <thead><tr><th>Ação</th><th>Detalhes</th><th>Responsável</th><th>Data</th></tr></thead>
        <tbody>
          ${logs.map(l => `
            <tr>
              <td style="font-weight:600">${safeText(l.acao)}</td>
              <td style="color:var(--text-muted);font-size:.85rem">${safeText(l.detalhes || '—')}</td>
              <td style="font-size:.85rem">${safeText(l.usuario_nome || '—')}</td>
              <td style="font-size:.8rem;color:var(--text-muted)">${new Date(l.created_at).toLocaleString('pt-BR')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    body.innerHTML = `<p style="color:var(--danger)">Erro ao carregar histórico.</p>`;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Login inline quando sessão expirar
  document.getElementById('adminLoginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminLoginEmail').value.trim();
    const senha = document.getElementById('adminLoginSenha').value;
    const errEl = document.getElementById('adminLoginError');
    try {
      const data = await api.post('/auth/login', { email, senha });
      if (data.user.perfil !== 'admin') throw new Error('Usuário não é administrador');
      localStorage.removeItem('fc_token');
      localStorage.setItem('fc_user', JSON.stringify(data.user));
      document.getElementById('loginRequired').style.display = 'none';
      document.getElementById('adminUserName').textContent = `${data.user.nome}`;
      await loadCategoriasAdmin();
      loadDashboard();
      loadProdutosAdmin();
    } catch(err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  });

  if (!await checkAdminAuth()) return;

  // Acorda o banco (Neon dorme após inatividade)
  api.get('/health').catch(() => {});

  await loadCategoriasAdmin();

  // Dashboard é a aba inicial — produtos carregam em background
  loadDashboard();
  loadProdutosAdmin();

  document.querySelectorAll('.sidebar__link[data-tab]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      setTab(link.dataset.tab);
    });
  });

  // Filtros de período do dashboard
  document.getElementById('dashPeriodBar')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.dash-period-btn');
    if (btn) loadDashboard(btn.dataset.periodo);
  });

  // Ações rápidas do dashboard
  document.getElementById('dashBtnNovoProduto')?.addEventListener('click', () => {
    setTab('produtos');
    setTimeout(() => openNewModal(), 100);
  });
  document.getElementById('dashBtnVerPedidos')?.addEventListener('click', () => setTab('pedidos'));
  document.getElementById('dashBtnVerClientes')?.addEventListener('click', () => setTab('usuarios'));

  document.getElementById('btnNovoProduto')?.addEventListener('click', openNewModal);
  document.getElementById('formProduto')?.addEventListener('submit', saveProduto);
  document.getElementById('btnCloseForm')?.addEventListener('click', closeFormModal);
  document.getElementById('btnCancelarForm')?.addEventListener('click', closeFormModal);

  document.getElementById('btnConfirmDelete')?.addEventListener('click', doDelete);
  document.getElementById('btnCancelDelete')?.addEventListener('click', () => {
    document.getElementById('deleteOverlay').style.display = 'none';
    deleteTargetId = null;
  });

  document.getElementById('btnAnterior')?.addEventListener('click', () => {
    if (viewMode === 'ligas') { if (ligaPage > 1) { ligaPage--; renderTabelaProdutos(); window.scrollTo(0,0); } }
    else { if (currentPage > 1) { currentPage--; renderTabelaProdutos(); window.scrollTo(0,0); } }
  });
  document.getElementById('btnProximo')?.addEventListener('click', () => {
    if (viewMode === 'ligas') { ligaPage++; renderTabelaProdutos(); window.scrollTo(0,0); }
    else if (currentPage < Math.ceil(filteredProdutos.length / ITEMS_PER_PAGE)) { currentPage++; renderTabelaProdutos(); window.scrollTo(0,0); }
  });

  document.getElementById('btnViewLigas')?.addEventListener('click', () => setViewMode('ligas'));
  document.getElementById('btnViewLista')?.addEventListener('click', () => setViewMode('lista'));

  // Filters
  let _searchTimer;
  document.getElementById('adminBusca')?.addEventListener('input', () => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(applyAdminFilters, 300);
  });
  document.getElementById('adminFiltroStatus')?.addEventListener('change', applyAdminFilters);
  document.getElementById('adminFiltroTipo')?.addEventListener('change', applyAdminFilters);
  document.getElementById('adminFiltroCategoria')?.addEventListener('change', applyAdminFilters);
  document.getElementById('adminOrdem')?.addEventListener('change', applyAdminFilters);
  document.getElementById('filtroAvaliacoesStatus')?.addEventListener('change', loadAvaliacoesAdmin);
  document.getElementById('filtroTrocasStatus')?.addEventListener('change', loadTrocasAdmin);
  document.getElementById('analyticsPeriodo')?.addEventListener('change', loadAnalyticsAdmin);
  document.getElementById('pCategoriaBusca')?.addEventListener('input', () => renderProdutoCategoriaSelect());

  // Export / Import
  document.getElementById('btnExportarCSV')?.addEventListener('click', exportarCSV);
  document.getElementById('importCSVInput')?.addEventListener('change', (e) => {
    importarCSV(e.target.files[0]);
    e.target.value = '';
  });

  // Bulk price
  document.getElementById('btnBulkPrice')?.addEventListener('click', openBulkPriceModal);
  document.getElementById('btnBulkDeselect')?.addEventListener('click', clearSelection);
  document.getElementById('btnConfirmBulkPrice')?.addEventListener('click', salvarBulkPrice);
  document.getElementById('btnCancelBulkPrice')?.addEventListener('click', () => {
    document.getElementById('bulkPriceOverlay').style.display = 'none';
  });
  document.getElementById('btnCloseBulkPrice')?.addEventListener('click', () => {
    document.getElementById('bulkPriceOverlay').style.display = 'none';
  });

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.action-dropdown')) closeAllDropdowns();
  });

  // O menu usa position:fixed (ver toggleDropdown), então não acompanha o
  // scroll/resize sozinho — fecha para não ficar "flutuando" sobre outras linhas.
  window.addEventListener('scroll', () => closeAllDropdowns(), true);
  window.addEventListener('resize', () => closeAllDropdowns());

  // Auto-slug from nome
  document.getElementById('pNome')?.addEventListener('input', (e) => {
    if (_slugDirty) return;
    const slug = normalizeText(e.target.value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const slugEl = document.getElementById('pSlug');
    if (slugEl) slugEl.value = slug;
  });
  document.getElementById('pSlug')?.addEventListener('input', () => { _slugDirty = true; });

  // Categorias
  document.getElementById('btnNovaCategoria')?.addEventListener('click', openNewCategoriaModal);
  document.getElementById('formCategoria')?.addEventListener('submit', saveCategoria);
  document.getElementById('btnCloseCategoriaForm')?.addEventListener('click', closeCategoriaModal);
  document.getElementById('btnCancelarCategoria')?.addEventListener('click', closeCategoriaModal);
  document.getElementById('btnCatAddUrl')?.addEventListener('click', addCategoriaImageUrl);
  document.getElementById('catImagemUrl')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addCategoriaImageUrl(); }
  });
  document.getElementById('catImagemFile')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) editingCategoriaImagem = await fileToBase64(file);
    renderCatImagePreview();
    e.target.value = '';
  });
  document.getElementById('btnCancelDeleteCategoria')?.addEventListener('click', () => {
    document.getElementById('categoriaDeleteOverlay').style.display = 'none';
    categoriaDeleteTargetId = null;
  });
  document.getElementById('btnConfirmDeleteCategoria')?.addEventListener('click', doDeleteCategoria);

  // Usuários
  document.getElementById('btnCancelDeleteUsuario')?.addEventListener('click', () => {
    document.getElementById('usuarioDeleteOverlay').style.display = 'none';
    usuarioDeleteTargetId = null;
  });
  document.getElementById('btnConfirmDeleteUsuario')?.addEventListener('click', doDeleteUsuario);

  // Cupons
  document.getElementById('btnNovoCupom')?.addEventListener('click', openNewCupomModal);
  document.getElementById('formCupom')?.addEventListener('submit', saveCupom);
  document.getElementById('btnCloseCupomForm')?.addEventListener('click', closeCupomModal);
  document.getElementById('btnCancelarCupom')?.addEventListener('click', closeCupomModal);
  document.getElementById('btnCancelDeleteCupom')?.addEventListener('click', () => {
    document.getElementById('cupomDeleteOverlay').style.display = 'none';
    cupomDeleteTargetId = null;
  });
  document.getElementById('btnConfirmDeleteCupom')?.addEventListener('click', doDeleteCupom);
  document.getElementById('btnCloseCupomUsos')?.addEventListener('click', () => {
    document.getElementById('cupomUsosOverlay').style.display = 'none';
  });

  document.getElementById('btnNovaPromocao')?.addEventListener('click', openNovaPromocaoModal);
  document.getElementById('formPromocao')?.addEventListener('submit', savePromocao);
  document.getElementById('btnClosePromocaoForm')?.addEventListener('click', closePromocaoModal);
  document.getElementById('btnCancelarPromocao')?.addEventListener('click', closePromocaoModal);
  document.getElementById('promoTipo')?.addEventListener('change', updatePromoTipoFields);
  document.getElementById('btnAddRegraProgressiva')?.addEventListener('click', () => {
    const atuais = coletarRegrasProgressivas();
    atuais.push({ qtd_minima: '', desconto_pct: '' });
    renderPromoRegrasList(atuais);
  });
  document.getElementById('btnCancelDeletePromocao')?.addEventListener('click', () => {
    document.getElementById('promocaoDeleteOverlay').style.display = 'none';
    promocaoDeleteTargetId = null;
  });
  document.getElementById('btnConfirmDeletePromocao')?.addEventListener('click', doDeletePromocao);

  document.getElementById('formBanner')?.addEventListener('submit', salvarBanner);
  document.getElementById('btnLimparBanner')?.addEventListener('click', limparBanner);
  document.getElementById('formConteudoInstitucional')?.addEventListener('submit', salvarConteudo);

  document.getElementById('btnNovoFuncionario')?.addEventListener('click', openNovoFuncionarioModal);
  document.getElementById('formFuncionario')?.addEventListener('submit', saveFuncionario);
  document.getElementById('btnCloseFuncionarioForm')?.addEventListener('click', closeFuncionarioModal);
  document.getElementById('btnCancelarFuncionario')?.addEventListener('click', closeFuncionarioModal);
  document.getElementById('btnVerHistoricoGeral')?.addEventListener('click', () => verHistorico(null, null));
  document.getElementById('btnCloseHistorico')?.addEventListener('click', () => {
    document.getElementById('historicoOverlay').style.display = 'none';
  });

  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    if (confirm('Deseja sair do painel?')) {
      try { await api.post('/auth/logout', {}); } catch (_) {}
      localStorage.removeItem('fc_token');
      localStorage.removeItem('fc_user');
      window.location.href = '../index.html';
    }
  });
});
