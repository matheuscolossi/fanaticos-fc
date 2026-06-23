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
                <span class="time-nome">${time}</span>
                <span class="time-liga">${liga}</span>
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
                          ? `<img src="${img}" alt="${p.nome}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="td-img-placeholder" style="display:none"></div>`
                          : `<div class="td-img-placeholder"></div>`}
                      </div>
                    </td>
                    <td>
                      <span class="td-nome" title="${p.nome}">${p.nome}</span>
                      ${p.sku ? `<div class="td-sku">${p.sku}</div>` : ''}
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
                          <div class="action-dropdown__item" onclick="closeAllDropdowns();toggleStatus(${p.id},'${p.status||'ativo'}')">
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

function checkAdminAuth() {
  const token = localStorage.getItem('fc_token');
  const user  = JSON.parse(localStorage.getItem('fc_user') || 'null');
  if (!token || !user || user.perfil !== 'admin') {
    document.getElementById('loginRequired').style.display = 'flex';
    return false;
  }
  document.getElementById('loginRequired').style.display = 'none';
  document.getElementById('adminUserName').textContent = `${user.nome}`;
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
    pedidos:    ['Pedidos Recebidos',    'Visualize todos os pedidos finalizados via WhatsApp'],
    usuarios:   ['Usuários Cadastrados', 'Gerencie as contas de usuários'],
    cupons:     ['Gerenciar Cupons',     'Crie e administre cupons de desconto'],
  };
  document.getElementById('adminTabTitle').textContent = titles[name]?.[0] ?? name;
  document.getElementById('adminTabSub').textContent   = titles[name]?.[1] ?? '';

  if (name === 'dashboard') loadDashboard();
  if (name === 'pedidos')   loadPedidos();
  if (name === 'usuarios')  loadUsuarios();
  if (name === 'produtos' && allProdutosAdmin.length === 0) loadProdutosAdmin();
  if (name === 'cupons')   loadCuponsAdmin();
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
              <td title="${p.nome}" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.nome}</td>
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
              <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.nome_cliente || '—'}</td>
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
        borderColor: '#ff6b00',
        backgroundColor: 'rgba(255,107,0,.1)',
        fill: true,
        tension: 0.4,
        pointRadius: grafico.length <= 14 ? 4 : 2,
        pointBackgroundColor: '#ff6b00',
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
                  ? `<img src="${img}" alt="${p.nome}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="td-img-placeholder" style="display:none"></div>`
                  : `<div class="td-img-placeholder"></div>`}
              </div>
            </td>
            <td>
              <span class="td-nome" title="${p.nome}">${p.nome}</span>
              ${p.sku ? `<div class="td-sku">${p.sku}</div>` : ''}
            </td>
            <td><span class="td-cat">${p.time || '—'}</span></td>
            <td><span class="td-cat">${p.tipo || '—'}</span></td>
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
                  <div class="action-dropdown__item" onclick="closeAllDropdowns();toggleStatus(${p.id},'${p.status||'ativo'}')">
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
    categoriasAdmin = await api.get('/categorias');
    const sel = document.getElementById('pCategoria');
    if (sel) {
      sel.innerHTML = '<option value="">Selecione...</option>';
      categoriasAdmin.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id; opt.textContent = c.nome;
        sel.appendChild(opt);
      });
    }
    renderTabelaCategorias();
  } catch(e) {}
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
                  ? `<img src="${c.imagem}" alt="${c.nome}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="td-img-placeholder" style="display:none"></div>`
                  : `<div class="td-img-placeholder"></div>`}
              </div>
            </td>
            <td><span class="td-nome">${c.nome}</span></td>
            <td><span class="td-cat">${c.categoria_pai_nome || '—'}</span></td>
            <td>${c.ordem ?? 0}</td>
            <td><span class="td-badge ${prodCount > 0 ? '' : 'td-badge--off'}">${prodCount}</span></td>
            <td><span class="td-status ${isAtivo ? 'td-status-ativo' : 'td-status-inativo'}">${isAtivo ? 'Ativo' : 'Inativo'}</span></td>
            <td>
              <div class="td-actions">
                <button class="btn btn--outline btn--sm" onclick="openEditCategoriaModal(${c.id})">Editar</button>
                <button class="btn btn--outline btn--sm" onclick="toggleCategoriaStatus(${c.id},'${c.status || 'ativo'}')">${isAtivo ? 'Desativar' : 'Ativar'}</button>
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
    ? `<div class="preview-img"><img src="${editingCategoriaImagem}" alt="Categoria" onerror="this.style.display='none'" /><div class="preview-img__remove" onclick="removeCatImage()"></div></div>`
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
        ${outras.map(o => `<option value="${o.id}">${o.nome}</option>`).join('')}
      </select>
    `;
    btnConfirm.style.display = '';
  } else {
    body.innerHTML = `<p>Tem certeza que deseja excluir a categoria <strong>${c.nome}</strong>? Esta ação não pode ser desfeita.</p>`;
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

function _resetFormFields() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  const chk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
  set('produtoId', ''); set('pNome', ''); set('pSku', ''); set('pSlug', '');
  set('pPreco', '149.90'); set('pPrecoPromo', ''); set('pCusto', '');
  set('pCategoria', ''); set('pTime', ''); set('pPais', '');
  set('pCompeticao', ''); set('pTemporada', '');
  set('pTipo', 'torcedor'); set('pMarca', ''); set('pGenero', 'masculino');
  set('pEstoque', ''); set('pEstoqueMin', '');
  set('pDescricao', ''); set('pDescricaoCurta', ''); set('pInfoLavagem', '');
  set('pStatus', 'ativo'); set('pCores', ''); set('pImagemUrl', '');
  set('pPeso', ''); set('pDimComp', ''); set('pDimLarg', ''); set('pDimAlt', '');
  set('pKeywords', ''); set('pMetaTitulo', ''); set('pMetaDescricao', '');
  chk('pDestaque', false); chk('pProdutoNovo', false); chk('pProdutoPromo', false);
  document.querySelectorAll('#sizePicker input').forEach(cb => { cb.checked = false; });
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

  const cores = parseAdminJson(p.cores, []);
  set('pCores', Array.isArray(cores) ? cores.join(', ') : '');

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
    <div class="preview-img" title="${isUrl ? img : 'Upload local'}">
      <img src="${img}" alt="Foto ${i+1}" onerror="this.style.display='none'" />
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

  const tamanhos = [...document.querySelectorAll('#sizePicker input:checked')].map(c => c.value);
  const coresText = v('pCores');
  const cores = coresText ? coresText.split(',').map(s => s.trim()).filter(Boolean) : [];
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
    cores,
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

let pedidosCache = [];

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
  const metodo = p.metodo_pagamento === 'pix' ? ' PIX' : ' WhatsApp';
  const itensHtml = p.itens.map(i =>
    `<div style="display:flex;justify-content:space-between;padding:.35rem 0;border-bottom:1px solid var(--border)">
      <span>${i.nome} <em style="color:var(--text-muted)">x${i.qty}</em></span>
      <span>${formatBRL(i.preco * i.qty)}</span>
    </div>`
  ).join('');

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
          <span style="background:${st.color}22;color:${st.color};padding:.3rem .75rem;border-radius:20px;font-size:.82rem;font-weight:600">${st.label}</span>
          <span style="color:var(--text-muted);font-size:.8rem">${new Date(p.created_at).toLocaleString('pt-BR')}</span>
        </div>

        <!-- Endereço de Entrega -->
        <div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:10px;padding:1rem;margin-bottom:1rem">
          <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.5rem">Endereço de Entrega</div>
          ${p.endereco
            ? `<div style="font-size:.95rem;font-weight:500;line-height:1.6">${p.endereco.replace(/ — /g, '<br>')}</div>`
            : '<div style="color:var(--text-muted);font-size:.85rem">Não informado</div>'}
        </div>

        <!-- Dados do Cliente -->
        <div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:10px;padding:1rem;margin-bottom:1rem">
          <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.5rem">Dados do Cliente</div>
          <div style="display:grid;gap:.35rem;font-size:.88rem">
            ${p.nome_cliente ? `<div><span style="color:var(--text-muted)">Nome:</span> <strong>${p.nome_cliente}</strong></div>` : ''}
            ${p.telefone_cliente ? `<div><span style="color:var(--text-muted)">Telefone:</span> ${p.telefone_cliente}</div>` : ''}
            ${p.email_cliente ? `<div><span style="color:var(--text-muted)">E-mail:</span> ${p.email_cliente}</div>` : ''}
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
          ${p.codigo_rastreio ? `<span>| Rastreio: <strong style="color:var(--text)">${p.codigo_rastreio}</strong></span>` : ''}
        </div>

        <!-- Ações -->
        ${p.telefone_cliente ? `
        <div style="margin-top:1rem">
          <a href="https://wa.me/55${p.telefone_cliente.replace(/\D/g,'')}" target="_blank"
             class="btn btn--whatsapp" style="width:100%;justify-content:center">
             Contatar cliente pelo WhatsApp
          </a>
        </div>` : ''}
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
    const pedidos = await api.get('/pedidos');
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
    wrap.innerHTML = '<div class="loading-state">Nenhum pedido registrado ainda.</div>';
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
        <span>Página ${pedidosPage} de ${totalPages}</span>
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
            const metodoIcon = p.metodo_pagamento === 'pix' ? ' PIX' : ' WhatsApp';
            return `
            <tr id="pedido-row-${p.id}">
              <td><strong>#${p.id}</strong></td>
              <td>
                ${p.nome_cliente ? `<div style="font-weight:600">${p.nome_cliente}</div>` : '<span style="color:var(--text-muted)">—</span>'}
                ${p.telefone_cliente ? `<div style="font-size:.78rem;color:var(--text-muted)">${p.telefone_cliente}</div>` : ''}
                ${p.email_cliente ? `<div style="font-size:.78rem;color:var(--text-muted)">${p.email_cliente}</div>` : ''}
                ${p.endereco ? `<div style="font-size:.75rem;color:var(--text-dim);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${p.endereco}">${p.endereco}</div>` : ''}
              </td>
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${p.itens.map(i => `${i.nome} (x${i.qty})`).join(', ')}
              </td>
              <td><span class="td-preco">${formatBRL(p.total)}</span></td>
              <td><span style="font-size:.82rem">${metodoIcon}</span></td>
              <td>
                <div style="margin-bottom:4px;font-size:.75rem;font-weight:600;color:${st.color}">${st.label}</div>
                <select class="pedido-status-select" data-id="${p.id}" onchange="salvarStatusPedido(${p.id})">
                  ${Object.entries(STATUS_PEDIDO).map(([val, info]) =>
                    `<option value="${val}" ${p.status === val ? 'selected' : ''}>${info.label}</option>`
                  ).join('')}
                </select>
              </td>
              <td>
                <div style="display:flex;gap:4px;align-items:center">
                  <input type="text" class="pedido-rastreio-input" data-id="${p.id}"
                    value="${p.codigo_rastreio || ''}" placeholder="Cód. rastreio"
                    style="width:120px;font-size:.8rem;padding:4px 8px;background:var(--bg-card2);border:1px solid var(--border);color:var(--text);border-radius:6px" />
                  <button class="btn btn--outline btn--sm" onclick="salvarRastreioPedido(${p.id})" title="Salvar rastreio">Salvar</button>
                </div>
              </td>
              <td style="color:var(--text-muted);font-size:.82rem;white-space:nowrap">${new Date(p.created_at).toLocaleString('pt-BR')}</td>
              <td>
                <div style="display:flex;gap:4px;flex-wrap:wrap">
                  <button class="btn btn--outline btn--sm" onclick="verDetalhesPedido(${p.id})" title="Ver detalhes do pedido">Ver</button>
                  ${p.telefone_cliente ? `
                  <a href="https://wa.me/55${p.telefone_cliente.replace(/\D/g,'')}" target="_blank"
                     class="btn btn--whatsapp btn--sm" title="Contatar cliente"></a>` : ''}
                  <button class="btn btn--danger btn--sm" onclick="excluirPedido(${p.id})" title="Excluir pedido">Excluir</button>
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
}

async function salvarStatusPedido(id) {
  const select = document.querySelector(`.pedido-status-select[data-id="${id}"]`);
  if (!select) return;
  try {
    await api.put(`/pedidos/${id}`, { status: select.value });
    showToast(`Status do pedido #${id} atualizado!`);
  } catch(e) {
    showToast('Erro ao atualizar status');
  }
}

async function salvarRastreioPedido(id) {
  const input = document.querySelector(`.pedido-rastreio-input[data-id="${id}"]`);
  if (!input) return;
  try {
    await api.put(`/pedidos/${id}`, { codigo_rastreio: input.value.trim() });
    showToast(`Rastreio do pedido #${id} salvo!`);
  } catch(e) {
    showToast('Erro ao salvar rastreio');
  }
}

async function excluirPedido(id) {
  if (!confirm(`Excluir o pedido #${id}? Essa ação não pode ser desfeita.`)) return;
  try {
    await api.delete(`/pedidos/${id}`);
    pedidosCache = pedidosCache.filter(p => String(p.id) !== String(id));
    showToast(`Pedido #${id} excluído.`);
    renderPedidos();
  } catch(e) {
    showToast(e.message || 'Erro ao excluir pedido', 'error');
  }
}

let usuariosCache = [];
let usuarioDeleteTargetId = null;

async function loadUsuarios() {
  const wrap = document.getElementById('tabelaUsuariosWrap');
  try {
    const users = await api.get('/admin/usuarios');
    usuariosCache = users;
    const currentUser = JSON.parse(localStorage.getItem('fc_user') || 'null');

    wrap.innerHTML = `
      <div class="admin-stats">
        <div class="admin-stat">
          <div class="admin-stat__label">Total Usuários</div>
          <div class="admin-stat__val">${users.length}</div>
        </div>
        <div class="admin-stat">
          <div class="admin-stat__label">Admins</div>
          <div class="admin-stat__val admin-stat__val--green">${users.filter(u => u.perfil === 'admin').length}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Pedidos</th><th>Cadastro</th><th>Ações</th></tr></thead>
        <tbody>
          ${users.map(u => {
            const isSelf = currentUser && String(currentUser.id) === String(u.id);
            return `
            <tr>
              <td style="font-weight:600">${u.nome}${isSelf ? ' <span style="color:var(--text-dim);font-size:.75rem">(você)</span>' : ''}</td>
              <td style="color:var(--text-muted)">${u.email}</td>
              <td><span class="td-badge ${u.perfil === 'admin' ? '' : 'td-badge--off'}">${u.perfil}</span></td>
              <td>${u.pedidos_count ?? 0}</td>
              <td style="color:var(--text-muted);font-size:.82rem">${new Date(u.created_at).toLocaleString('pt-BR')}</td>
              <td>
                ${isSelf
                  ? '<span style="color:var(--text-dim);font-size:.78rem">—</span>'
                  : `<button class="btn btn--danger btn--sm" onclick="confirmDeleteUsuario(${u.id})">Excluir</button>`}
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
    <p>Tem certeza que deseja excluir o usuário <strong>${u.nome}</strong> (${u.email})?</p>
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
    showToast('Usuário excluído.');
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
  const ordem        = document.getElementById('adminOrdem')?.value         || 'nome';

  let list = [...allProdutosAdmin];
  if (q) list = list.filter(p =>
    normalizeText(p.nome).includes(q) ||
    normalizeText(p.sku  || '').includes(q) ||
    normalizeText(p.time || '').includes(q)
  );
  if (statusFilter) list = list.filter(p => (p.status || 'ativo') === statusFilter);
  if (tipoFilter)   list = list.filter(p => p.tipo === tipoFilter);

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
    const token = localStorage.getItem('fc_token');
    const res = await fetch(`${API_BASE}/produtos/export`, {
      headers: { Authorization: `Bearer ${token}` },
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
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      await api.post('/produtos/import', { csv: ev.target.result });
      showToast('Importação concluída! Recarregando...');
      await loadProdutosAdmin();
    } catch(e) {
      showToast(e.message, 'error');
    }
  };
  reader.readAsText(file, 'utf-8');
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
  if (!isOpen) dd.classList.add('open');
}

function closeAllDropdowns() {
  document.querySelectorAll('.action-dropdown.open').forEach(d => d.classList.remove('open'));
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
            <td style="font-weight:700">${c.codigo}${c.frete_gratis ? ' <span class=\"td-badge\">Frete grátis</span>' : ''}</td>
            <td style="color:var(--text-muted)">${c.descricao || '—'}</td>
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
                  <div class="action-dropdown__item" onclick="closeAllDropdowns();toggleCupomStatus(${c.id},'${c.status}')">${isAtivo ? 'Desativar' : 'Ativar'}</div>
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
  sel.innerHTML = items.map(item => `
    <option value="${item.id}" ${selecionados.includes(String(item.id)) ? 'selected' : ''}>${labelFn(item)}</option>
  `).join('');

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
    `<p>Tem certeza que deseja excluir o cupom <strong>${c.codigo}</strong>? Esta ação não pode ser desfeita.</p>`;
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
              <td>${p.nome_cliente || p.email_cliente || '—'}</td>
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
      localStorage.setItem('fc_token', data.token);
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

  if (!checkAdminAuth()) return;

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
  document.getElementById('adminOrdem')?.addEventListener('change', applyAdminFilters);

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

  document.getElementById('btnLogout')?.addEventListener('click', () => {
    if (confirm('Deseja sair do painel?')) {
      localStorage.removeItem('fc_token');
      localStorage.removeItem('fc_user');
      window.location.href = '../index.html';
    }
  });
});
