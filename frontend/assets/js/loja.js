let allProdutos = [];
let categorias = [];
let catAtiva = '';
let currentProduto = null;

function produtoCard(p) {
  const img = (p.imagens || [])[0];
  return `
    <div class="produto-card" onclick="openProdutoModal(${p.id})">
      <div class="produto-card__img">
        ${img
          ? `<img src="${img}" alt="${p.nome}" loading="lazy" decoding="async" />`
          : `<div class="produto-card__placeholder">⚽</div>`}
        ${p.destaque ? `<span class="produto-card__badge">🔥 Destaque</span>` : ''}
      </div>
      <div class="produto-card__info">
        <div class="produto-card__cat">${p.categoria_nome || 'Sem categoria'}</div>
        <div class="produto-card__nome">${p.nome}</div>
        <div class="produto-card__footer">
          <span class="produto-card__preco">${formatBRL(p.preco)}</span>
          <button class="produto-card__btn" onclick="event.stopPropagation();addToCart(${JSON.stringify(JSON.stringify(p))})">
            + Carrinho
          </button>
        </div>
      </div>
    </div>
  `;
}

function getEmojiForTeam(nome) {
  const n = (nome || '').toLowerCase();
  if (n.includes('brasil') || n.includes('flamengo') || n.includes('palmeiras') || n.includes('corinthians') ||
      n.includes('são paulo') || n.includes('santos') || n.includes('botafogo') || n.includes('vasco') ||
      n.includes('grêmio') || n.includes('internacional') || n.includes('atletico') || n.includes('cruzeiro') ||
      n.includes('fluminense') || n.includes('bahia')) return '🇧🇷';
  if (n.includes('argentina') || n.includes('boca') || n.includes('river') || n.includes('racing') || n.includes('independiente')) return '🇦🇷';
  if (n.includes('real madrid') || n.includes('barcelona') || n.includes('atletico de madrid') || n.includes('sevilla') || n.includes('valencia') || n.includes('espanha')) return '🇪🇸';
  if (n.includes('manchester') || n.includes('liverpool') || n.includes('arsenal') || n.includes('chelsea') || n.includes('tottenham') || n.includes('inglaterra')) return '🏴󠁧󠁢󠁥󠁮󠁧󠁿';
  if (n.includes('juventus') || n.includes('milan') || n.includes('inter de') || n.includes('napoli') || n.includes('roma') || n.includes('lazio') || n.includes('itália')) return '🇮🇹';
  if (n.includes('bayern') || n.includes('dortmund') || n.includes('alemanha') || n.includes('bundesliga')) return '🇩🇪';
  if (n.includes('psg') || n.includes('marseille') || n.includes('lyon') || n.includes('mônaco') || n.includes('frança')) return '🇫🇷';
  if (n.includes('benfica') || n.includes('porto') || n.includes('sporting') || n.includes('portugal')) return '🇵🇹';
  if (n.includes('inter miami') || n.includes('galaxy') || n.includes('lafc') || n.includes('mls')) return '🇺🇸';
  if (n.includes('al hilal') || n.includes('al nassr')) return '🇸🇦';
  if (n.includes('ajax') || n.includes('psv')) return '🇳🇱';
  if (n.includes('galatasaray') || n.includes('fenerbahçe') || n.includes('besiktas')) return '🇹🇷';
  return '⚽';
}

function isGooglePhotosLink(url) {
  return url && (url.includes('photos.app.goo.gl') || url.includes('photos.google.com'));
}

function produtoCardSafe(p) {
  const imagens = p.imagens || [];
  const img = imagens[0];
  const isGPhotos = isGooglePhotosLink(img);
  const emoji = getEmojiForTeam(p.nome);
  const isJogador = p.nome.toLowerCase().includes('jogador');
  const card = document.createElement('div');
  card.className = 'produto-card';
  card.innerHTML = `
    <div class="produto-card__img">
      ${isGPhotos
        ? `<div class="produto-card__placeholder gphoto-placeholder">
             <span class="gphoto-emoji">${emoji}</span>
             <span class="gphoto-label">Ver Fotos</span>
           </div>`
        : img
          ? `<img src="${img}" alt="${p.nome}" loading="lazy" decoding="async" />`
          : `<div class="produto-card__placeholder">${emoji}</div>`}
      ${p.destaque ? `<span class="produto-card__badge">🔥 Destaque</span>` : ''}
      ${isJogador ? `<span class="produto-card__badge produto-card__badge--jogador">⭐ Jogador</span>` : ''}
    </div>
    <div class="produto-card__info">
      <div class="produto-card__cat">${p.categoria_nome || 'Sem categoria'}</div>
      <div class="produto-card__nome">${p.nome}</div>
      <div class="produto-card__preco">${formatBRL(p.preco)}</div>
      <button class="produto-card__btn">Adicionar ao Carrinho</button>
    </div>
  `;

  if (img && !isGPhotos) {
    const imgEl = card.querySelector('.produto-card__img img');
    if (imgEl) {
      let idx = 0;
      imgEl.addEventListener('error', function retry() {
        idx++;
        if (idx < imagens.length) {
          this.src = imagens[idx];
        } else {
          const ph = document.createElement('div');
          ph.className = 'produto-card__placeholder';
          ph.textContent = emoji;
          this.replaceWith(ph);
        }
      });
    }
  }

  card.addEventListener('click', () => openProdutoModal(p.id));
  card.querySelector('.produto-card__btn').addEventListener('click', (e) => {
    e.stopPropagation();
    addToCart(p);
  });
  return card;
}

function renderGrid(grid, produtos) {
  grid.innerHTML = '';
  if (produtos.length === 0) return;
  produtos.forEach(p => grid.appendChild(produtoCardSafe(p)));
}

async function loadCategorias() {
  try {
    categorias = await api.get('/categorias');
    const cont = document.getElementById('filtroCats');
    if (!cont) return;
    categorias.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'cat-btn';
      btn.dataset.cat = c.id;
      btn.textContent = c.nome;
      btn.addEventListener('click', () => filterByCategory(c.id));
      cont.appendChild(btn);
    });

    const sel = document.getElementById('pCategoria');
    if (sel) {
      categorias.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id; opt.textContent = c.nome;
        sel.appendChild(opt);
      });
    }
  } catch(e) { console.error('Erro ao carregar categorias', e); }
}

function filterByCategory(catId) {
  catAtiva = catId;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', String(b.dataset.cat) === String(catId)));
  document.querySelectorAll('.cat-nav-btn').forEach(b => b.classList.toggle('active', String(b.dataset.cat) === String(catId)));
  applyFilters();
}

function applyFilters() {
  const busca = normalizeText(document.getElementById('inputBusca')?.value || '');
  const precoMin = parseFloat(document.getElementById('precoMin')?.value) || 0;
  const precoMax = parseFloat(document.getElementById('precoMax')?.value) || Infinity;
  const ordem = document.getElementById('selectOrdem')?.value || 'recente';

  let filtered = allProdutos.filter(p => {
    const nome = normalizeText(p.nome);
    const matchBusca = !busca || nome.includes(busca) || normalizeText(p.categoria_nome || '').includes(busca);
    const matchCat = !catAtiva || String(p.categoria_id) === String(catAtiva);
    const matchPreco = p.preco >= precoMin && p.preco <= precoMax;
    return matchBusca && matchCat && matchPreco;
  });

  filtered = sortProdutos(filtered, ordem);

  const countEl = document.getElementById('filtrosCount');
  if (countEl) {
    countEl.textContent = filtered.length > 0
      ? `${filtered.length} produto${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`
      : '';
  }

  const grid = document.getElementById('gridProdutos');
  const empty = document.getElementById('emptyState');
  if (grid) {
    if (filtered.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'flex';
    } else {
      if (empty) empty.style.display = 'none';
      renderGrid(grid, filtered);
    }
  }
}

function sortProdutos(list, ordem) {
  const sorted = [...list];
  switch (ordem) {
    case 'az':         return sorted.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    case 'za':         return sorted.sort((a, b) => b.nome.localeCompare(a.nome, 'pt-BR'));
    case 'preco_asc':  return sorted.sort((a, b) => a.preco - b.preco);
    case 'preco_desc': return sorted.sort((a, b) => b.preco - a.preco);
    default:           return sorted;
  }
}

function clearFilters() {
  document.getElementById('inputBusca').value = '';
  document.getElementById('precoMin').value = '';
  document.getElementById('precoMax').value = '';
  const sel = document.getElementById('selectOrdem');
  if (sel) sel.value = 'recente';
  catAtiva = '';
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === ''));
  document.querySelectorAll('.cat-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === ''));
  const countEl = document.getElementById('filtrosCount');
  if (countEl) countEl.textContent = '';
  renderGrid(document.getElementById('gridProdutos'), allProdutos);
  document.getElementById('emptyState').style.display = 'none';
}

async function openProdutoModal(id) {
  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');
  if (!overlay || !content) return;

  content.innerHTML = '<div style="padding:3rem;text-align:center;"><div class="spinner" style="margin:0 auto"></div></div>';
  overlay.style.display = 'flex';

  try {
    const p = await api.get(`/produtos/${id}`);
    currentProduto = p;
    const imagens = p.imagens || [];
    const mainImg = imagens[0] || null;

    const isGPhotos = isGooglePhotosLink(mainImg);
    const emoji2 = getEmojiForTeam(p.nome);
    content.innerHTML = `
      <div class="product-detail">
        <div class="product-detail__gallery">
          <div class="product-detail__main-img" id="mainImg">
            ${isGPhotos
              ? `<div class="gphoto-detail">
                   <div class="gphoto-detail__emoji">${emoji2}</div>
                   <p class="gphoto-detail__text">Fotos disponíveis no álbum</p>
                   <a href="${mainImg}" target="_blank" rel="noopener" class="btn btn--primary gphoto-detail__btn">
                     📸 Ver Fotos do ${p.nome}
                   </a>
                 </div>`
              : mainImg
                ? `<img src="${mainImg}" alt="${p.nome}" id="mainImgEl" decoding="async" />`
                : `<div style="height:300px;display:flex;align-items:center;justify-content:center;font-size:5rem;">${emoji2}</div>`}
          </div>
        </div>
        <div class="product-detail__info">
          <div class="product-detail__cat">${p.categoria_nome || 'Sem categoria'}</div>
          <h2 class="product-detail__nome">${p.nome}</h2>
          <div class="product-detail__preco">${formatBRL(p.preco)}</div>
          <p class="product-detail__desc">${p.descricao || 'Sem descrição disponível.'}</p>
          ${p.estoque ? `<p class="product-detail__estoque">📦 ${p.estoque} em estoque</p>` : ''}
          <div class="product-detail__actions">
            <button class="btn btn--primary" id="btnAddModal">🛒 Adicionar ao Carrinho</button>
          </div>
        </div>
      </div>
    `;

    if (mainImg && !isGPhotos) {
      const modalImgEl = document.getElementById('mainImgEl');
      if (modalImgEl) {
        let idx = 0;
        modalImgEl.addEventListener('error', function retry() {
          idx++;
          if (idx < imagens.length) {
            this.src = imagens[idx];
          } else {
            this.replaceWith(Object.assign(document.createElement('div'), {
              style: 'height:300px;display:flex;align-items:center;justify-content:center;font-size:5rem',
              textContent: emoji2
            }));
          }
        });
      }
    }

    document.getElementById('btnAddModal')?.addEventListener('click', () => {
      addToCart(p);
      closeModal();
    });
  } catch(e) {
    content.innerHTML = `<p style="padding:2rem;color:var(--danger)">Erro ao carregar produto.</p>`;
  }
}

function switchImg(src, thumbEl) {
  document.getElementById('mainImgEl').src = src;
  document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
  thumbEl.classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
}

async function loadProdutos() {
  try {
    allProdutos = await api.get('/produtos');
    const destaques = allProdutos.filter(p => p.destaque);
    const gridD = document.getElementById('gridDestaques');
    if (gridD) renderGrid(gridD, destaques);
    const gridP = document.getElementById('gridProdutos');
    if (gridP) renderGrid(gridP, allProdutos);
  } catch(e) {
    const grid = document.getElementById('gridProdutos');
    if (grid) grid.innerHTML = `<div class="loading-state" style="color:var(--danger)">⚠️ Não foi possível conectar ao servidor. Certifique-se que o backend está rodando em http://localhost:3001</div>`;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadCategorias();
  await loadProdutos();

  let searchTimer;
  document.getElementById('inputBusca')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 300);
  });

  document.getElementById('selectOrdem')?.addEventListener('change', applyFilters);
  document.getElementById('btnFiltrar')?.addEventListener('click', applyFilters);
  document.getElementById('btnLimpar')?.addEventListener('click', clearFilters);
  document.getElementById('btnLimpar2')?.addEventListener('click', clearFilters);

  document.querySelector('.cat-btn[data-cat=""]')?.addEventListener('click', () => {
    filterByCategory('');
  });

  document.querySelector('.cat-nav-btn[data-cat=""]')?.addEventListener('click', () => {
    filterByCategory('');
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('btnCloseModal')?.addEventListener('click', closeModal);
  document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });

  document.querySelector('.hero__cta')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
  });

  // Auto-filtro por time via parâmetro de URL (?time=Flamengo)
  const urlParams = new URLSearchParams(window.location.search);
  const timeParam = urlParams.get('time');
  if (timeParam) {
    const inputBusca = document.getElementById('inputBusca');
    if (inputBusca) {
      inputBusca.value = timeParam;
      applyFilters();
      setTimeout(() => {
        document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }
  }
});
