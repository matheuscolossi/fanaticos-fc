function produtoUrl(p) {
  // Abrindo direto do disco (file://) o rewrite /p/nome/:id da Vercel não existe — usa o link relativo.
  if (window.location.protocol === 'file:') {
    return `pages/produto.html?id=${encodeURIComponent(p.id)}`;
  }
  const slug = normalizeText(p.nome).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `/p/${slug}/${p.id}`;
}

let allProdutos = [];
let categorias = [];
let catAtiva = '';
let currentProduto = null;
let currentPage = 1;
let totalPages = 1;
let isLoadingMore = false;

const CACHE_KEY = 'fc_produtos_v1';
const CACHE_TTL = 10 * 60 * 1000; // 10 min

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    return Date.now() - ts < CACHE_TTL ? data : null;
  } catch (_) { return null; }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch (_) {}
}

function produtoCard(p) {
  const img = (p.imagens || [])[0];
  return `
    <div class="produto-card" onclick="openProdutoModal(${p.id})">
      <div class="produto-card__img">
        ${img
          ? `<img src="${img}" alt="${p.nome}" loading="lazy" decoding="async" />`
          : `<div class="produto-card__placeholder"></div>`}
        ${p.destaque ? `<span class="produto-card__badge">Destaque</span>` : ''}
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

function getProductPlaceholderLabel() {
  return 'Imagem indisponível';
}

function isGooglePhotosLink(url) {
  return url && (url.includes('photos.app.goo.gl') || url.includes('photos.google.com'));
}

function produtoCardSafe(p) {
  const imagens = p.imagens || [];
  const img = imagens[0];
  const isGPhotos = isGooglePhotosLink(img);
  const placeholderLabel = getProductPlaceholderLabel();
  const isJogador = p.nome.toLowerCase().includes('jogador');
  const card = document.createElement('div');
  card.className = 'produto-card';
  card.innerHTML = `
    <div class="produto-card__img">
      ${isGPhotos
        ? `<div class="produto-card__placeholder gphoto-placeholder">
             <span class="gphoto-label">Ver imagens</span>
           </div>`
        : img
          ? `<img src="${img}" alt="${p.nome}" loading="lazy" decoding="async" />`
          : `<div class="produto-card__placeholder">${placeholderLabel}</div>`}
      ${p.destaque ? `<span class="produto-card__badge">Destaque</span>` : ''}
      ${isJogador ? `<span class="produto-card__badge produto-card__badge--jogador">Jogador</span>` : ''}
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
          ph.textContent = placeholderLabel;
          this.replaceWith(ph);
        }
      });
    }
  }

  card.addEventListener('click', () => {
    try { sessionStorage.setItem('fc_produto_cache', JSON.stringify(p)); } catch (_) {}
    window.location.href = produtoUrl(p);
  });
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

// Busca/categoria/preço precisam ser resolvidos no backend (allProdutos só tem
// a página atual, no máximo 24 itens) — por isso delega para loadProdutos().
async function applyFilters() {
  await loadProdutos();
}

function clearFilters() {
  document.getElementById('inputBusca').value = '';
  document.getElementById('precoMin').value = '';
  document.getElementById('precoMax').value = '';
  const sel = document.getElementById('selectOrdem');
  if (sel) sel.value = 'az';
  catAtiva = '';
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === ''));
  document.querySelectorAll('.cat-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === ''));
  const countEl = document.getElementById('filtrosCount');
  if (countEl) countEl.textContent = '';
  document.getElementById('emptyState').style.display = 'none';
  loadProdutos();
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
                     Ver Fotos do ${p.nome}
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
          ${p.estoque ? `<p class="product-detail__estoque">${p.estoque} em estoque</p>` : ''}
          <div class="product-detail__actions">
            <button class="btn btn--primary" id="btnAddModal"> Adicionar ao Carrinho</button>
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

function renderPagination() {
  const container = document.getElementById('paginacaoProdutos');
  if (!container) return;

  if (totalPages <= 1) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== '...') pages.push('...');
  }

  container.innerHTML = `
    <button class="btn btn--outline btn--sm" id="btnPagAnterior" ${currentPage <= 1 ? 'disabled' : ''}>← Anterior</button>
    ${pages.map(p => p === '...'
      ? `<span class="pagination__ellipsis">...</span>`
      : `<button class="pagination__page ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`
    ).join('')}
    <button class="btn btn--outline btn--sm" id="btnPagProximo" ${currentPage >= totalPages ? 'disabled' : ''}>Próximo →</button>
  `;
  container.style.display = 'flex';

  container.querySelectorAll('.pagination__page').forEach(btn => {
    btn.addEventListener('click', () => goToPage(Number(btn.dataset.page)));
  });
  document.getElementById('btnPagAnterior')?.addEventListener('click', () => goToPage(currentPage - 1));
  document.getElementById('btnPagProximo')?.addEventListener('click', () => goToPage(currentPage + 1));
}

function buildApiParams(page = 1) {
  const params = new URLSearchParams({ page, limit: 24 });
  const busca = document.getElementById('inputBusca')?.value.trim();
  const precoMin = document.getElementById('precoMin')?.value;
  const precoMax = document.getElementById('precoMax')?.value;
  const ordem = document.getElementById('selectOrdem')?.value || 'az';
  if (busca) params.set('busca', busca);
  if (catAtiva) params.set('categoria', catAtiva);
  if (precoMin) params.set('precoMin', precoMin);
  if (precoMax) params.set('precoMax', precoMax);
  if (ordem) params.set('ordem', ordem);
  return params.toString();
}

async function loadHeroGallery() {
  const gallery = document.getElementById('heroGallery');
  if (!gallery) return;
  try {
    let { produtos } = await api.get('/produtos?destaque=true&limit=4');
    if (produtos.length < 4) {
      const { produtos: recentes } = await api.get('/produtos?limit=4&ordem=recente');
      produtos = recentes;
    }
    const fotos = produtos
      .map(p => (p.imagens || [])[0])
      .filter(Boolean)
      .filter(url => !isGooglePhotosLink(url));
    gallery.innerHTML = fotos
      .map(url => `<div class="hero__gallery-item" style="background-image:url('${url}')"></div>`)
      .join('');
  } catch (e) {
    console.warn('[hero-gallery:error]', e);
  }
}

async function loadDestaques() {
  const gridD = document.getElementById('gridDestaques');
  if (!gridD) return;
  try {
    const { produtos } = await api.get('/produtos?destaque=true&limit=12');
    renderGrid(gridD, produtos);
  } catch (e) {
    console.warn('[destaques:error]', e);
  }
}

function hasActiveFilters() {
  return Boolean(
    document.getElementById('inputBusca')?.value.trim() ||
    catAtiva ||
    document.getElementById('precoMin')?.value ||
    document.getElementById('precoMax')?.value
  );
}

async function loadProdutos() {
  currentPage = 1;
  const filtering = hasActiveFilters();

  if (!filtering) {
    const cached = readCache();
    if (cached) {
      allProdutos = cached.produtos || cached;
      totalPages = cached.totalPages || 1;
      const gridP = document.getElementById('gridProdutos');
      if (gridP) renderGrid(gridP, allProdutos);
      renderPagination();
    }
  }

  try {
    const fresh = await api.get(`/produtos?${buildApiParams(1)}`);
    const { produtos, totalPages: tp } = fresh;
    totalPages = tp || 1;
    allProdutos = produtos;
    if (!filtering) writeCache({ produtos, totalPages });
    const gridP = document.getElementById('gridProdutos');
    if (gridP) renderGrid(gridP, allProdutos);
    renderPagination();
    const empty = document.getElementById('emptyState');
    if (empty) empty.style.display = allProdutos.length === 0 ? 'flex' : 'none';
    const countEl = document.getElementById('filtrosCount');
    if (countEl) countEl.textContent = allProdutos.length > 0
      ? `${allProdutos.length} de ${fresh.total} produto${fresh.total !== 1 ? 's' : ''}` : '';
  } catch (e) {
    if (!allProdutos.length) {
      const grid = document.getElementById('gridProdutos');
      if (grid) grid.innerHTML = `<div class="loading-state" style="text-align:center;padding:2rem">
        <p style="color:var(--danger);margin-bottom:1rem">Estamos com dificuldades técnicas. Tente novamente em instantes.</p>
        <button onclick="loadProdutos()" class="btn btn--primary">Tentar novamente</button>
      </div>`;
    }
  }
}

async function goToPage(page) {
  if (isLoadingMore || page < 1 || page > totalPages || page === currentPage) return;
  isLoadingMore = true;
  const grid = document.getElementById('gridProdutos');
  if (grid) grid.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  try {
    const { produtos } = await api.get(`/produtos?${buildApiParams(page)}`);
    currentPage = page;
    allProdutos = produtos;
    if (grid) renderGrid(grid, allProdutos);
    renderPagination();
    grid?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { /* mantém página atual */ }

  isLoadingMore = false;
}

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([loadCategorias(), loadProdutos(), loadDestaques(), loadHeroGallery()]);

  let searchTimer;
  document.getElementById('inputBusca')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 300);
  });

  document.getElementById('selectOrdem')?.addEventListener('change', loadProdutos);
  document.getElementById('btnFiltrar')?.addEventListener('click', loadProdutos);
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

  // Auto-filtro via parâmetros de URL: ?time=Flamengo (interno) ou
  // ?query=&cat= (padrão exigido em /busca pelo trabalho da faculdade)
  const urlParams = new URLSearchParams(window.location.search);
  const timeParam = urlParams.get('time');
  const queryParam = urlParams.get('query');
  const catParam = urlParams.get('cat');
  const termoBusca = timeParam || queryParam;

  if (termoBusca || catParam) {
    const inputBusca = document.getElementById('inputBusca');
    if (inputBusca && termoBusca) inputBusca.value = termoBusca;

    let categoriaEncontrada = null;
    if (catParam) {
      categoriaEncontrada = categorias.find(
        c => String(c.id) === String(catParam) || c.nome.toLowerCase() === catParam.toLowerCase()
      );
    }

    if (categoriaEncontrada) filterByCategory(categoriaEncontrada.id);
    else applyFilters();

    setTimeout(() => {
      document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
    }, 300);
  }
});
