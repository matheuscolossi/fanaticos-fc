const ITEMS_PER_PAGE = 15;
let allProdutosAdmin = [];
let filteredProdutos = [];
let currentPage = 1;
let deleteTargetId = null;
let categoriasAdmin = [];
let editingImages = [];
let viewMode = 'ligas'; // 'ligas' | 'lista'
const openAccordionIds = new Set();

// ── Liga View Config ──────────────────────────────────────────────────────────
const LIGA_ORDER = [
  'Brasileirão', 'Seleções',
  'Liga Espanhola', 'Liga Inglesa', 'Liga Italiana', 'Liga Alemã',
  'Liga Francesa', 'Liga Portuguesa', 'Liga Argentina', 'Liga Holandesa',
  'Liga Mexicana', 'Liga Americana (MLS)', 'NBA', 'Outras Ligas', 'Outros'
];

const LIGA_FLAGS = {
  'Brasileirão':        '🇧🇷',
  'Seleções':           '🌎',
  'Liga Espanhola':     '🇪🇸',
  'Liga Inglesa':       '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Liga Italiana':      '🇮🇹',
  'Liga Alemã':         '🇩🇪',
  'Liga Francesa':      '🇫🇷',
  'Liga Portuguesa':    '🇵🇹',
  'Liga Argentina':     '🇦🇷',
  'Liga Holandesa':     '🇳🇱',
  'Liga Mexicana':      '🇲🇽',
  'Liga Americana (MLS)': '🇺🇸',
  'NBA':                '🏀',
  'Outras Ligas':       '🌍',
  'Outros':             '📦'
};

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

function extractTime(nome) {
  const words = nome.split(' ');
  const teamWords = [];
  for (const word of words) {
    if (TYPE_KEYWORDS.has(word)) break;
    teamWords.push(word);
  }
  return teamWords.length > 0 ? teamWords.join(' ') : nome;
}

function getLiga(produto) {
  const time = extractTime(produto.nome);
  if (TEAM_TO_LIGA[time]) return TEAM_TO_LIGA[time];
  if (BRAZILIAN_TEAMS.has(time)) return 'Brasileirão';
  if (SELECOES_TEAMS.has(time)) return 'Seleções';
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
  if (isOpen) openAccordionIds.delete(bodyId);
  else openAccordionIds.add(bodyId);
}

function restoreOpenAccordions() {
  for (const id of openAccordionIds) {
    const body = document.getElementById(id);
    if (!body) { openAccordionIds.delete(id); continue; }
    body.style.display = 'block';
    const arrow = document.getElementById(id.replace(/_body$/, '_arrow'));
    if (arrow) arrow.textContent = '▼';
  }
}

function renderLigaView(produtos) {
  const wrap = document.getElementById('tabelaProdutosWrap');
  const pag  = document.getElementById('paginacaoProdutos');
  if (pag) pag.style.display = 'none';

  if (produtos.length === 0) {
    wrap.innerHTML = '<div class="loading-state">Nenhum produto encontrado.</div>';
    return;
  }

  // Agrupar por liga → time
  const ligaMap = new Map();
  for (const p of produtos) {
    const liga = getLiga(p);
    const time = extractTime(p.nome);
    if (!ligaMap.has(liga)) ligaMap.set(liga, new Map());
    const timeMap = ligaMap.get(liga);
    if (!timeMap.has(time)) timeMap.set(time, []);
    timeMap.get(time).push(p);
  }

  // Ordenar ligas conforme LIGA_ORDER
  const sortedLigas = [...ligaMap.keys()].sort((a, b) => {
    const ia = LIGA_ORDER.indexOf(a);
    const ib = LIGA_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  let html = '<div class="ligas-view">';

  for (const liga of sortedLigas) {
    const timeMap   = ligaMap.get(liga);
    const totalProds = [...timeMap.values()].reduce((s, arr) => s + arr.length, 0);
    const flag      = LIGA_FLAGS[liga] || '🏆';
    const ligaId    = 'liga_' + normalizeText(liga).replace(/[^a-z0-9]/g, '_');
    const ligaOpen  = openAccordionIds.has(`${ligaId}_body`);

    html += `
      <div class="liga-section">
        <div class="liga-header" onclick="toggleAccordion('${ligaId}_body','${ligaId}_arrow')">
          <div class="liga-header__left">
            <span class="liga-arrow" id="${ligaId}_arrow">${ligaOpen ? '▼' : '▶'}</span>
            <span class="liga-flag">${flag}</span>
            <span class="liga-nome">${liga}</span>
          </div>
          <span class="liga-count">${totalProds} produto${totalProds !== 1 ? 's' : ''}</span>
        </div>
        <div class="liga-body" id="${ligaId}_body" style="display:${ligaOpen ? 'block' : 'none'}">
    `;

    const sortedTimes = [...timeMap.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    for (const time of sortedTimes) {
      const prods   = timeMap.get(time);
      const timeId  = ligaId + '_time_' + normalizeText(time).replace(/[^a-z0-9]/g, '_');
      const timeOpen = openAccordionIds.has(`${timeId}_body`);

      html += `
          <div class="time-section">
            <div class="time-header" onclick="toggleAccordion('${timeId}_body','${timeId}_arrow')">
              <div class="time-header__left">
                <span class="time-arrow" id="${timeId}_arrow">${timeOpen ? '▼' : '▶'}</span>
                <span class="time-nome">📂 ${time}</span>
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
                          ? `<img src="${img}" alt="${p.nome}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="td-img-placeholder" style="display:none">⚽</div>`
                          : `<div class="td-img-placeholder">⚽</div>`}
                      </div>
                    </td>
                    <td><span class="td-nome" title="${p.nome}">${p.nome}</span></td>
                    <td><span class="td-preco">${formatBRL(p.preco)}</span></td>
                    <td>${p.estoque}</td>
                    <td>
                      <span class="td-badge ${p.destaque ? '' : 'td-badge--off'}">
                        ${p.destaque ? '🔥 Sim' : 'Não'}
                      </span>
                    </td>
                    <td>
                      <div class="td-actions">
                        <button class="btn btn--outline btn--sm" onclick="openEditModal(${p.id})">✏️ Editar</button>
                        <button class="btn btn--danger btn--sm"  onclick="confirmDelete(${p.id})">🗑️</button>
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

    html += `
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
  document.getElementById('adminUserName').textContent = `👤 ${user.nome}`;
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
      `<div class="loading-state" style="color:var(--danger)">⚠️ Erro ao carregar produtos. Backend rodando?</div>`;
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
                  ? `<img src="${img}" alt="${p.nome}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="td-img-placeholder" style="display:none">⚽</div>`
                  : `<div class="td-img-placeholder">⚽</div>`}
              </div>
            </td>
            <td><span class="td-nome" title="${p.nome}">${p.nome}</span></td>
            <td><span class="td-cat">${p.categoria_nome || '—'}</span></td>
            <td><span class="td-preco">${formatBRL(p.preco)}</span></td>
            <td>${p.estoque}</td>
            <td>
              <span class="td-badge ${p.destaque ? '' : 'td-badge--off'}">
                ${p.destaque ? '🔥 Sim' : 'Não'}
              </span>
            </td>
            <td>
              <div class="td-actions">
                <button class="btn btn--outline btn--sm" onclick="openEditModal(${p.id})">✏️ Editar</button>
                <button class="btn btn--danger btn--sm"  onclick="confirmDelete(${p.id})">🗑️</button>
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
      <div class="preview-img__remove">🗑️</div>
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
      showToast('Produto atualizado com sucesso! ✅');
    } else {
      await api.post('/produtos', data);
      showToast('Produto criado com sucesso! 🎉');
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

async function loadPedidos() {
  const wrap = document.getElementById('tabelaPedidosWrap');
  try {
    const pedidos = await api.get('/pedidos');
    if (pedidos.length === 0) {
      wrap.innerHTML = '<div class="loading-state">Nenhum pedido registrado ainda.</div>'; return;
    }
    const totalGeral = pedidos.reduce((s, p) => s + p.total, 0);
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
      </div>
      <table>
        <thead><tr><th>#</th><th>Itens</th><th>Total</th><th>Status</th><th>Data</th></tr></thead>
        <tbody>
          ${pedidos.map(p => `
            <tr>
              <td>#${p.id}</td>
              <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${p.itens.map(i => `${i.nome} (x${i.qty})`).join(', ')}
              </td>
              <td><span class="td-preco">${formatBRL(p.total)}</span></td>
              <td><span class="td-badge">${p.status}</span></td>
              <td style="color:var(--text-muted);font-size:.82rem">${new Date(p.created_at).toLocaleString('pt-BR')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch(e) {
    wrap.innerHTML = '<div class="loading-state" style="color:var(--danger)">Erro ao carregar pedidos.</div>';
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
