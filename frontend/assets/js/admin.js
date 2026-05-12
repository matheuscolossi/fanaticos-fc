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
                    <th>Destaque</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
      `;

      for (const p of prods) {
        const img = (p.imagens || [])[0];
        html += `
                  <tr>
                    <td>
                      <div class="td-img">
                        ${img
                          ? `<img src="${img}" alt="${p.nome}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="td-img-placeholder" style="display:none"></div>`
                          : `<div class="td-img-placeholder"></div>`}
                      </div>
                    </td>
                    <td><span class="td-nome" title="${p.nome}">${p.nome}</span></td>
                    <td><span class="td-preco">${formatBRL(p.preco)}</span></td>
                    <td>${p.estoque}</td>
                    <td>
                      <span class="td-badge ${p.destaque ? '' : 'td-badge--off'}">
                        ${p.destaque ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td>
                      <div class="td-actions">
                        <button class="btn btn--outline btn--sm" onclick="openEditModal(${p.id})">Editar</button>
                        <button class="btn btn--danger btn--sm"  onclick="confirmDelete(${p.id})">Excluir</button>
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
    produtos: ['Gerenciar Produtos', 'Cadastre, edite e remova produtos do catálogo'],
    pedidos:  ['Pedidos Recebidos',  'Visualize todos os pedidos finalizados via WhatsApp'],
    usuarios: ['Usuários Cadastrados','Gerencie as contas de usuários'],
  };
  document.getElementById('adminTabTitle').textContent = titles[name][0];
  document.getElementById('adminTabSub').textContent   = titles[name][1];

  if (name === 'pedidos')  loadPedidos();
  if (name === 'usuarios') loadUsuarios();
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

async function loadProdutosAdmin() {
  try {
    allProdutosAdmin = await api.get('/produtos');
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

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Foto</th>
          <th>Nome</th>
          <th>Categoria</th>
          <th>Preço</th>
          <th>Estoque</th>
          <th>Destaque</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${page.map(p => {
          const img = (p.imagens || [])[0];
          return `
          <tr>
            <td>
              <div class="td-img">
                ${img
                  ? `<img src="${img}" alt="${p.nome}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="td-img-placeholder" style="display:none"></div>`
                  : `<div class="td-img-placeholder"></div>`}
              </div>
            </td>
            <td><span class="td-nome" title="${p.nome}">${p.nome}</span></td>
            <td><span class="td-cat">${p.categoria_nome || '—'}</span></td>
            <td><span class="td-preco">${formatBRL(p.preco)}</span></td>
            <td>${p.estoque}</td>
            <td>
              <span class="td-badge ${p.destaque ? '' : 'td-badge--off'}">
                ${p.destaque ? 'Sim' : 'Não'}
              </span>
            </td>
            <td>
              <div class="td-actions">
                <button class="btn btn--outline btn--sm" onclick="openEditModal(${p.id})">Editar</button>
                <button class="btn btn--danger btn--sm"  onclick="confirmDelete(${p.id})">Excluir</button>
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

function openNewModal() {
  editingImages = [];
  document.getElementById('produtoId').value = '';
  document.getElementById('pNome').value = '';
  document.getElementById('pPreco').value = '149.90';
  document.getElementById('pCategoria').value = '';
  document.getElementById('pEstoque').value = '';
  document.getElementById('pDescricao').value = '';
  document.getElementById('pDestaque').checked = false;
  document.getElementById('imagePreview').innerHTML = '';
  document.getElementById('modalFormTitle').textContent = 'Novo Produto';
  document.getElementById('modalOverlay').style.display = 'flex';
}

async function openEditModal(id) {
  try {
    const p = await api.get(`/produtos/${id}`);
    editingImages = [...(p.imagens || [])];
    document.getElementById('produtoId').value   = p.id;
    document.getElementById('pNome').value       = p.nome;
    document.getElementById('pPreco').value      = p.preco;
    document.getElementById('pCategoria').value  = p.categoria_id || '';
    document.getElementById('pEstoque').value    = p.estoque;
    document.getElementById('pDescricao').value  = p.descricao || '';
    document.getElementById('pDestaque').checked = !!p.destaque;
    document.getElementById('modalFormTitle').textContent = 'Editar Produto';
    renderImagePreview();
    document.getElementById('modalOverlay').style.display = 'flex';
  } catch(e) {
    showToast('Erro ao carregar produto.', 'error');
  }
}

function closeFormModal() {
  document.getElementById('modalOverlay').style.display = 'none';
  editingImages = [];
}

function renderImagePreview() {
  const preview = document.getElementById('imagePreview');
  if (!preview) return;
  if (editingImages.length === 0) {
    preview.innerHTML = '';
    return;
  }
  preview.innerHTML = editingImages.map((img, i) => {
    const isUrl = img.startsWith('http') && !img.startsWith('data:');
    return `
    <div class="preview-img" onclick="removePreviewImg(${i})" title="${isUrl ? img : 'Upload'}">
      <img src="${img}" alt="Foto ${i+1}" onerror="this.parentElement.querySelector('.preview-img__err').style.display='flex'" />
      <div class="preview-img__err" style="display:none;position:absolute;inset:0;background:var(--bg-card2);align-items:center;justify-content:center;font-size:.65rem;color:var(--text-muted);text-align:center;padding:.2rem">Erro ao carregar</div>
      <div class="preview-img__remove"></div>
      ${isUrl ? '<div class="preview-img__badge">URL</div>' : '<div class="preview-img__badge preview-img__badge--up">UP</div>'}
    </div>
  `}).join('');
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
  const data = {
    nome:        document.getElementById('pNome').value.trim(),
    preco:       parseFloat(document.getElementById('pPreco').value),
    categoria_id:document.getElementById('pCategoria').value || null,
    estoque:     parseInt(document.getElementById('pEstoque').value) || 0,
    descricao:   document.getElementById('pDescricao').value.trim(),
    destaque:    document.getElementById('pDestaque').checked,
    imagens:     editingImages,
  };
  if (!data.nome || isNaN(data.preco)) {
    showToast('Nome e preço são obrigatórios.', 'error'); return;
  }
  try {
    if (id) {
      await api.put(`/produtos/${id}`, data);
      showToast('Produto atualizado com sucesso! ');
    } else {
      await api.post('/produtos', data);
      showToast('Produto criado com sucesso! ');
    }
    closeFormModal();
    await loadProdutosAdmin();
  } catch(e) {
    showToast(e.message, 'error');
  }
}

function confirmDelete(id) {
  deleteTargetId = id;
  document.getElementById('deleteOverlay').style.display = 'flex';
}

async function doDelete() {
  if (!deleteTargetId) return;
  try {
    await api.delete(`/produtos/${deleteTargetId}`);
    showToast('Produto excluído.', 'success');
    document.getElementById('deleteOverlay').style.display = 'none';
    deleteTargetId = null;
    await loadProdutosAdmin();
  } catch(e) {
    showToast(e.message, 'error');
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

function filterAdminProdutos(term) {
  const q = normalizeText(term);
  filteredProdutos = q
    ? allProdutosAdmin.filter(p => normalizeText(p.nome).includes(q) || normalizeText(p.categoria_nome || '').includes(q))
    : [...allProdutosAdmin];
  currentPage = 1;
  renderTabelaProdutos();
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
      await loadProdutosAdmin();
    } catch(err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  });

  if (!checkAdminAuth()) return;

  await loadCategoriasAdmin();
  await loadProdutosAdmin();

  document.querySelectorAll('.sidebar__link[data-tab]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      setTab(link.dataset.tab);
    });
  });

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

  let st;
  document.getElementById('adminBusca')?.addEventListener('input', (e) => {
    clearTimeout(st);
    st = setTimeout(() => filterAdminProdutos(e.target.value), 300);
  });

  document.getElementById('btnLogout')?.addEventListener('click', () => {
    if (confirm('Deseja sair do painel?')) {
      localStorage.removeItem('fc_token');
      localStorage.removeItem('fc_user');
      window.location.href = '../index.html';
    }
  });
});
