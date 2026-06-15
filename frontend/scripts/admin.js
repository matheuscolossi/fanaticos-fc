const ITEMS_PER_PAGE = 15;
const ORDERS_PER_PAGE = 25;
let allProdutosAdmin = [];
let filteredProdutos = [];
let currentPage = 1;
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
  if (pag) pag.style.display = 'none';

  if (produtos.length === 0) {
    wrap.innerHTML = '<div class="loading-state">Nenhum produto encontrado.</div>';
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

  const openIds = getOpenIds();
  let html = '<div class="ligas-view">';

  for (const group of sortedTeams) {
      const { liga, time, produtos: prods } = group;
      const timeId  = 'time_' + normalizeText(`${liga}_${time}`).replace(/[^a-z0-9]/g, '_');
      const timeOpen = openIds.has(`${timeId}_body`) || sortedTeams.length <= 8;

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
    dashboard: ['Dashboard',           'Visão geral das métricas e vendas'],
    produtos:  ['Gerenciar Produtos',  'Cadastre, edite e remova produtos do catálogo'],
    pedidos:   ['Pedidos Recebidos',   'Visualize todos os pedidos finalizados via WhatsApp'],
    usuarios:  ['Usuários Cadastrados','Gerencie as contas de usuários'],
  };
  document.getElementById('adminTabTitle').textContent = titles[name]?.[0] ?? name;
  document.getElementById('adminTabSub').textContent   = titles[name]?.[1] ?? '';

  if (name === 'dashboard') loadDashboard();
  if (name === 'pedidos')   loadPedidos();
  if (name === 'usuarios')  loadUsuarios();
  if (name === 'produtos' && allProdutosAdmin.length === 0) loadProdutosAdmin();
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
  document.getElementById('btnViewLigas')?.classList.toggle('active', mode === 'ligas');
  document.getElementById('btnViewLista')?.classList.toggle('active', mode === 'lista');
  const pag = document.getElementById('paginacaoProdutos');
  if (pag) pag.style.display = mode === 'lista' ? '' : 'none';
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
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione...</option>';
    categoriasAdmin.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.nome;
      sel.appendChild(opt);
    });
  } catch(e) {}
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
        <button class="modal__close" id="_btnFecharDetalhe">Fechar</button>
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
  const totalGeral = pedidos.reduce((s, p) => s + p.total, 0);
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

async function loadUsuarios() {
  const wrap = document.getElementById('tabelaUsuariosWrap');
  try {
    const users = await api.get('/admin/usuarios');
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
        <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Cadastro</th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td style="font-weight:600">${u.nome}</td>
              <td style="color:var(--text-muted)">${u.email}</td>
              <td><span class="td-badge ${u.perfil === 'admin' ? '' : 'td-badge--off'}">${u.perfil}</span></td>
              <td style="color:var(--text-muted);font-size:.82rem">${new Date(u.created_at).toLocaleString('pt-BR')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch(e) {
    wrap.innerHTML = '<div class="loading-state" style="color:var(--danger)">Erro ao carregar usuários.</div>';
  }
}

function applyAdminFilters() {
  const q = normalizeText(document.getElementById('adminBusca')?.value || '');
  const statusFilter = document.getElementById('adminFiltroStatus')?.value || '';
  const tipoFilter   = document.getElementById('adminFiltroTipo')?.value   || '';
  const ordem        = document.getElementById('adminOrdem')?.value         || 'recente';

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
    case 'nome':       list.sort((a, b) => (a.nome||'').localeCompare(b.nome||'','pt-BR')); break;
    default:           list.sort((a, b) => b.id - a.id); break;
  }

  filteredProdutos = list;
  currentPage = 1;
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
    if (currentPage > 1) { currentPage--; renderTabelaProdutos(); }
  });
  document.getElementById('btnProximo')?.addEventListener('click', () => {
    if (currentPage < Math.ceil(filteredProdutos.length / ITEMS_PER_PAGE)) {
      currentPage++; renderTabelaProdutos();
    }
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

  document.getElementById('btnLogout')?.addEventListener('click', () => {
    if (confirm('Deseja sair do painel?')) {
      localStorage.removeItem('fc_token');
      localStorage.removeItem('fc_user');
      window.location.href = '../index.html';
    }
  });
});
