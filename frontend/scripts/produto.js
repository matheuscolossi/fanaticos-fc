let produtoAtual = null;
let imagemAtual = 0;

const TAMANHOS = ['P', 'M', 'G', 'GG', 'XG', '2XG'];

function produtoIdFromUrl() {
  const fromQuery = new URLSearchParams(window.location.search).get('id');
  if (fromQuery) return fromQuery;
  // Fallback: URL no padrão /p/nome/:id (rewrite da Vercel para a URL "bonita")
  const match = window.location.pathname.match(/\/p\/[^/]+\/(\d+)/);
  return match ? match[1] : null;
}

function isGooglePhotosLink(url) {
  return url && (url.includes('photos.app.goo.gl') || url.includes('photos.google.com'));
}

function precoPaginaHtml(p) {
  if (!p.em_promocao) return `<div class="produto-page__price">${formatBRL(p.preco)}</div>`;
  return `
    <div class="produto-page__price-wrap">
      <span class="produto-page__price produto-page__price--riscado">${formatBRL(p.preco)}</span>
      <span class="produto-page__price produto-page__price--promo">${formatBRL(p.preco_exibicao)}</span>
    </div>
  `;
}

function attachCountdown(el, targetIso) {
  if (!el || !targetIso) return;
  const target = new Date(targetIso).getTime();
  const timer = setInterval(() => {
    if (!document.body.contains(el)) { clearInterval(timer); return; }
    const diff = target - Date.now();
    if (diff <= 0) { el.textContent = 'Promoção encerrada'; clearInterval(timer); return; }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = d > 0 ? `Termina em ${d}d ${h}h ${m}m` : `Termina em ${h}h ${m}m ${s}s`;
  }, 1000);
}

function getProductPlaceholderLabel() {
  return 'Imagem indisponível';
}

function getComentariosKey() {
  return `fc_comments_produto_${produtoAtual?.id || produtoIdFromUrl()}`;
}

function getComentarios() {
  const fallback = [
    { nome: 'Cliente verificado', nota: 5, texto: 'Camisa chegou muito bem embalada e com ótimo acabamento.' },
    { nome: 'Torcedor Fanáticos FC', nota: 5, texto: 'Tecido leve, tamanho ficou certo e a personalização veio como pedi.' },
  ];
  try {
    return JSON.parse(localStorage.getItem(getComentariosKey()) || 'null') || fallback;
  } catch (_) {
    return fallback;
  }
}

function saveComentarios(comentarios) {
  localStorage.setItem(getComentariosKey(), JSON.stringify(comentarios));
}

function renderStars(nota) {
  return `${Number(nota || 5)}/5`;
}

function renderProduto(p) {
  produtoAtual = p;
  const imagens = p.imagens || [];
  const mainImg = imagens[imagemAtual] || null;
  const isGPhotos = isGooglePhotosLink(mainImg);
  const placeholderLabel = getProductPlaceholderLabel();
  const content = document.getElementById('produtoContent');

  document.title = `${p.nome} - Fanáticos FC`;
  content.innerHTML = `
    <div class="produto-page__gallery">
      <div class="produto-page__main-img" id="produtoMainImg">
        ${isGPhotos
          ? `<div class="gphoto-detail">
               <p class="gphoto-detail__text">Fotos disponíveis no álbum</p>
               <a href="${mainImg}" target="_blank" rel="noopener" class="btn btn--primary gphoto-detail__btn">Ver fotos do produto</a>
             </div>`
          : mainImg
            ? `<img src="${mainImg}" alt="${p.nome}" id="produtoMainImgEl" decoding="async" />`
            : `<div class="produto-page__placeholder">${placeholderLabel}</div>`}
      </div>
      ${imagens.length > 1 && !isGPhotos ? `
        <div class="produto-page__thumbs">
          ${imagens.map((img, idx) => `
            <button class="produto-page__thumb ${idx === imagemAtual ? 'active' : ''}" data-img-index="${idx}" aria-label="Ver imagem ${idx + 1}">
              <img src="${img}" alt="${p.nome} ${idx + 1}" loading="lazy" decoding="async" />
            </button>
          `).join('')}
        </div>
      ` : ''}
    </div>
    <div class="produto-page__info">
      <div class="product-detail__cat">${p.categoria_nome || 'Sem categoria'}</div>
      ${p.em_promocao ? `<span class="produto-page__badge produto-page__badge--promo">${p.promocao_destaque ? '★ Oferta' : 'Promoção'}</span>` : ''}
      <h1 class="produto-page__title">${p.nome}</h1>
      ${precoPaginaHtml(p)}
      ${p.em_promocao && p.promocao_fim ? `<div class="produto-page__countdown"></div>` : ''}
      <p class="produto-page__desc">${p.descricao || 'Camisa premium com acabamento de alta qualidade, ideal para jogo, treino ou coleção.'}</p>

      <div class="produto-options">
        <div class="produto-options__header">
          <h2>Tamanho</h2>
          <span>Escolha antes de adicionar</span>
        </div>
        <div class="produto-size-grid" id="produtoSizeGrid">
          ${TAMANHOS.map(t => `<button class="produto-size" data-size="${t}">${t}</button>`).join('')}
        </div>
      </div>

      <div class="produto-options">
        <div class="produto-options__header">
          <h2>Personalização</h2>
          <span>Opcional</span>
        </div>
        <label class="produto-check">
          <input type="checkbox" id="produtoPersonalizar" />
          <span>Adicionar nome e número</span>
        </label>
        <div class="produto-custom" id="produtoCustomFields" style="display:none">
          <input type="text" id="produtoNomeCamisa" maxlength="18" placeholder="Nome na camisa" />
          <input type="number" id="produtoNumeroCamisa" min="0" max="99" placeholder="Número" />
        </div>
      </div>

      ${p.estoque ? `<p class="product-detail__estoque">${p.estoque} em estoque</p>` : ''}
      <div class="produto-page__actions">
        <button class="btn btn--primary" id="btnAddProduto">Adicionar ao Carrinho</button>
      </div>
    </div>
  `;

  content.querySelectorAll('.produto-page__thumb').forEach(btn => {
    btn.addEventListener('click', () => {
      imagemAtual = Number(btn.dataset.imgIndex);
      renderProduto(produtoAtual);
    });
  });

  document.getElementById('produtoPersonalizar')?.addEventListener('change', (event) => {
    document.getElementById('produtoCustomFields').style.display = event.target.checked ? 'grid' : 'none';
  });

  document.querySelectorAll('.produto-size').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.produto-size').forEach(item => item.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('btnAddProduto')?.addEventListener('click', addProdutoSelecionado);

  if (p.em_promocao && p.promocao_fim) {
    attachCountdown(content.querySelector('.produto-page__countdown'), p.promocao_fim);
  }

  renderComentarios();
}

function addProdutoSelecionado() {
  const tamanho = document.querySelector('.produto-size.active')?.dataset.size;
  if (!tamanho) {
    showToast('Escolha um tamanho antes de adicionar.', 'error');
    return;
  }

  const personalizar = document.getElementById('produtoPersonalizar')?.checked;
  const nome = document.getElementById('produtoNomeCamisa')?.value.trim() || '';
  const numero = document.getElementById('produtoNumeroCamisa')?.value.trim() || '';

  if (personalizar && (!nome || !numero)) {
    showToast('Preencha nome e número da personalização.', 'error');
    return;
  }

  addToCart(produtoAtual, {
    tamanho,
    personalizacao: personalizar ? { nome, numero } : null,
  });
}

function renderComentarios() {
  const section = document.getElementById('produtoComments');
  const comentarios = getComentarios();
  const media = comentarios.length
    ? (comentarios.reduce((sum, c) => sum + Number(c.nota || 5), 0) / comentarios.length).toFixed(1)
    : '0.0';
  section.style.display = 'block';
  section.innerHTML = `
    <div class="produto-comments__header">
      <div>
        <h2>Comentários sobre o produto</h2>
        <p>${comentarios.length} avaliação${comentarios.length !== 1 ? 'ões' : ''} de clientes</p>
      </div>
      <span class="produto-comments__score">${media}</span>
    </div>
    <div class="produto-comments__list">
      ${comentarios.map(c => `
        <article class="produto-comment">
          <div class="produto-comment__top">
            <strong>${c.nome}</strong>
            <span>${renderStars(c.nota || 5)}</span>
          </div>
          <p>${c.texto}</p>
        </article>
      `).join('')}
    </div>
    <form class="produto-comment-form" id="produtoCommentForm">
      <input type="text" id="commentNome" placeholder="Seu nome" required />
      <select id="commentNota" required>
        <option value="5">5 estrelas</option>
        <option value="4">4 estrelas</option>
        <option value="3">3 estrelas</option>
        <option value="2">2 estrelas</option>
        <option value="1">1 estrela</option>
      </select>
      <textarea id="commentTexto" rows="3" placeholder="Escreva seu comentário" required></textarea>
      <button class="btn btn--primary" type="submit">Enviar comentário</button>
    </form>
  `;

  document.getElementById('produtoCommentForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const novo = {
      nome: document.getElementById('commentNome').value.trim(),
      nota: Number(document.getElementById('commentNota').value),
      texto: document.getElementById('commentTexto').value.trim(),
    };
    if (!novo.nome || !novo.texto) return;
    saveComentarios([novo, ...comentarios]);
    showToast('Comentário publicado.');
    renderComentarios();
  });
}

async function loadProdutoPage() {
  const id = produtoIdFromUrl();
  const content = document.getElementById('produtoContent');
  if (!id) {
    content.innerHTML = '<div class="empty-state">Produto não encontrado.</div>';
    return;
  }

  try {
    const cached = JSON.parse(sessionStorage.getItem('fc_produto_cache') || 'null');
    if (cached && String(cached.id) === String(id)) {
      sessionStorage.removeItem('fc_produto_cache');
      renderProduto(cached);
      api.get(`/produtos/${id}`).then(p => renderProduto(p)).catch(() => {});
      return;
    }
  } catch (_) {}

  try {
    const produto = await api.get(`/produtos/${id}`);
    renderProduto(produto);
  } catch (err) {
    content.innerHTML = '<div class="loading-state" style="color:var(--danger)">Não foi possível carregar este produto.</div>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadProdutoPage();
  updateBadge();
  renderCart();

  document.getElementById('btnCart')?.addEventListener('click', openCart);
  document.getElementById('btnCloseCart')?.addEventListener('click', closeCart);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCart);
  document.getElementById('btnCheckout')?.addEventListener('click', goToCartPage);
  document.getElementById('btnUser')?.addEventListener('click', () => {
    window.location.href = '/pages/conta.html';
  });
});
