let produtoAtual = null;
let imagemAtual = 0;
let avaliacoesState = null;

function productSizes(product) {
  let sizes = product?.tamanhos;
  if (typeof sizes === 'string') {
    try { sizes = JSON.parse(sizes); } catch (_) { sizes = []; }
  }
  return Array.isArray(sizes)
    ? sizes.map((size) => String(size || '').trim()).filter(Boolean)
    : [];
}

function variantStock(product, size) {
  const variants = Array.isArray(product?.variantes) ? product.variantes : [];
  const variant = variants.find((item) => String(item.tamanho) === String(size));
  if (variants.length > 0) return variant ? Number(variant.estoque) : 0;
  return Number(product?.estoque || 0);
}

function colorVariantStock(product, size, color) {
  const variants = Array.isArray(product?.variantes_cores) ? product.variantes_cores : [];
  if (!variants.length) return variantStock(product, size);
  const variant = variants.find((item) => String(item.tamanho) === String(size) && String(item.cor) === String(color));
  return variant ? Number(variant.estoque) : 0;
}

function refreshProductVariantOptions() {
  const colorVariants = Array.isArray(produtoAtual?.variantes_cores) ? produtoAtual.variantes_cores : [];
  if (!colorVariants.length) return;
  const selectedSize = document.querySelector('#produtoSizeGrid .produto-size.active')?.dataset.size || null;
  const selectedColor = document.querySelector('.produto-color.active')?.dataset.color || null;
  document.querySelectorAll('#produtoSizeGrid .produto-size').forEach((button) => {
    const available = selectedColor
      ? colorVariantStock(produtoAtual, button.dataset.size, selectedColor)
      : colorVariants.filter((item) => String(item.tamanho) === button.dataset.size).reduce((sum, item) => sum + Number(item.estoque || 0), 0);
    button.disabled = available <= 0;
    if (button.disabled && button.classList.contains('active')) button.classList.remove('active');
  });
  document.querySelectorAll('.produto-color').forEach((button) => {
    const available = selectedSize
      ? colorVariantStock(produtoAtual, selectedSize, button.dataset.color)
      : colorVariants.filter((item) => String(item.cor) === button.dataset.color).reduce((sum, item) => sum + Number(item.estoque || 0), 0);
    button.disabled = available <= 0;
    if (button.disabled && button.classList.contains('active')) button.classList.remove('active');
  });
  const finalSize = document.querySelector('#produtoSizeGrid .produto-size.active')?.dataset.size;
  const finalColor = document.querySelector('.produto-color.active')?.dataset.color;
  const message = document.getElementById('produtoStockMessage');
  if (message && finalSize && finalColor) message.textContent = `${colorVariantStock(produtoAtual, finalSize, finalColor)} em estoque nesta combinação`;
}

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

function renderStars(nota) {
  const value = Math.min(5, Math.max(1, Number(nota) || 1));
  return `${'★'.repeat(value)}${'☆'.repeat(5 - value)}`;
}

function renderProduto(p) {
  produtoAtual = p;
  const imagens = p.imagens || [];
  const mainImg = imagens[imagemAtual] || null;
  const isGPhotos = isGooglePhotosLink(mainImg);
  const placeholderLabel = getProductPlaceholderLabel();
  const content = document.getElementById('produtoContent');
  const sizes = productSizes(p);
  const colors = Array.isArray(p.cores) ? p.cores.map(String).filter(Boolean) : [];
  const sizeGuide = Array.isArray(p.guia_tamanhos) ? p.guia_tamanhos : [];

  document.title = `${p.nome} - Fanáticos FC`;
  content.innerHTML = `
    <div class="produto-page__gallery">
      <div class="produto-page__main-img" id="produtoMainImg">
        ${isGPhotos
          ? `<div class="gphoto-detail">
               <p class="gphoto-detail__text">Fotos disponíveis no álbum</p>
               <a href="${safeUrl(mainImg)}" target="_blank" rel="noopener" class="btn btn--primary gphoto-detail__btn">Ver fotos do produto</a>
             </div>`
          : mainImg
            ? `<img src="${safeUrl(mainImg)}" alt="${safeAttr(p.nome)}" id="produtoMainImgEl" decoding="async" />`
            : `<div class="produto-page__placeholder">${placeholderLabel}</div>`}
      </div>
      ${imagens.length > 1 && !isGPhotos ? `
        <div class="produto-page__thumbs">
          ${imagens.map((img, idx) => `
            <button class="produto-page__thumb ${idx === imagemAtual ? 'active' : ''}" data-img-index="${idx}" aria-label="Ver imagem ${idx + 1}">
              <img src="${safeUrl(img)}" alt="${safeAttr(`${p.nome} ${idx + 1}`)}" loading="lazy" decoding="async" />
            </button>
          `).join('')}
        </div>
      ` : ''}
    </div>
    <div class="produto-page__info">
      <div class="product-detail__cat">${safeText(p.categoria_nome || 'Sem categoria')}</div>
      ${p.em_promocao ? `<span class="produto-page__badge produto-page__badge--promo">${p.promocao_destaque ? '★ Oferta' : 'Promoção'}</span>` : ''}
      <h1 class="produto-page__title">${safeText(p.nome)}</h1>
      ${precoPaginaHtml(p)}
      ${p.em_promocao && p.promocao_fim ? `<div class="produto-page__countdown"></div>` : ''}
      <p class="produto-page__desc">${safeText(p.descricao || 'Camisa premium com acabamento de alta qualidade, ideal para jogo, treino ou coleção.')}</p>

      ${sizes.length > 0 ? `<div class="produto-options">
        <div class="produto-options__header">
          <h2>Tamanho</h2>
          <span>Escolha antes de adicionar</span>
        </div>
        <div class="produto-size-grid" id="produtoSizeGrid">
          ${sizes.map((size) => {
            const stock = variantStock(p, size);
            return `<button class="produto-size" data-size="${safeAttr(size)}" ${stock <= 0 ? 'disabled' : ''}
              aria-label="Tamanho ${safeAttr(size)}${stock <= 0 ? ' esgotado' : ''}">${safeText(size)}${stock <= 0 ? ' — Esgotado' : ''}</button>`;
          }).join('')}
        </div>
      </div>` : ''}

      ${colors.length > 0 ? `<div class="produto-options">
        <div class="produto-options__header"><h2>Cor</h2><span>Escolha antes de adicionar</span></div>
        <div class="produto-size-grid" id="produtoColorGrid">
          ${colors.map((color) => `<button class="produto-size produto-color" data-color="${safeAttr(color)}">${safeText(color)}</button>`).join('')}
        </div>
      </div>` : ''}

      ${sizeGuide.length > 0 ? `<details class="produto-size-guide">
        <summary>Ver guia de tamanhos e medidas</summary>
        <div class="table-wrap"><table><thead><tr><th>Tamanho</th><th>Largura</th><th>Comprimento</th></tr></thead><tbody>
          ${sizeGuide.map((row) => `<tr><td>${safeText(row.tamanho)}</td><td>${Number(row.largura)} cm</td><td>${Number(row.comprimento)} cm</td></tr>`).join('')}
        </tbody></table></div>
      </details>` : ''}

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

      <p class="product-detail__estoque" id="produtoStockMessage">${p.estoque > 0 ? `${p.estoque} em estoque` : 'Produto esgotado'}</p>
      <div class="produto-page__actions">
        <button class="btn btn--primary" id="btnAddProduto" ${p.estoque <= 0 ? 'disabled' : ''}>Adicionar ao Carrinho</button>
        <button class="btn btn--outline" id="btnFavoriteProduto" type="button">♡ Favoritar</button>
        ${p.estoque <= 0 ? '<button class="btn btn--outline" id="btnRestockAlert" type="button">Avise-me quando voltar</button>' : ''}
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

  document.querySelectorAll('#produtoSizeGrid .produto-size').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#produtoSizeGrid .produto-size').forEach(item => item.classList.remove('active'));
      btn.classList.add('active');
      const stockMessage = document.getElementById('produtoStockMessage');
      if (stockMessage) stockMessage.textContent = `${variantStock(produtoAtual, btn.dataset.size)} em estoque neste tamanho`;
      refreshProductVariantOptions();
    });
  });

  document.querySelectorAll('.produto-color').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.produto-color').forEach((item) => item.classList.remove('active'));
      btn.classList.add('active');
      refreshProductVariantOptions();
    });
  });

  document.getElementById('btnAddProduto')?.addEventListener('click', addProdutoSelecionado);
  document.getElementById('btnFavoriteProduto')?.addEventListener('click', toggleFavoriteProduto);
  document.getElementById('btnRestockAlert')?.addEventListener('click', createRestockAlertProduto);
  refreshProductVariantOptions();

  if (p.em_promocao && p.promocao_fim) {
    attachCountdown(content.querySelector('.produto-page__countdown'), p.promocao_fim);
  }

  loadAvaliacoesProduto();
  loadProductEngagement();
}

function addProdutoSelecionado() {
  const sizes = productSizes(produtoAtual);
  const tamanho = document.querySelector('#produtoSizeGrid .produto-size.active')?.dataset.size;
  const colors = Array.isArray(produtoAtual?.cores) ? produtoAtual.cores : [];
  const cor = document.querySelector('.produto-color.active')?.dataset.color;
  if (sizes.length > 0 && !tamanho) {
    showToast('Escolha um tamanho antes de adicionar.', 'error');
    return;
  }
  if (colors.length > 0 && !cor) {
    showToast('Escolha uma cor antes de adicionar.', 'error');
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
    tamanho: tamanho || null,
    cor: cor || null,
    personalizacao: personalizar ? { nome, numero } : null,
  });
}

async function toggleFavoriteProduto() {
  const button = document.getElementById('btnFavoriteProduto');
  if (!button || !produtoAtual?.id) return;
  try {
    const favorites = await api.get('/recursos/favoritos');
    const isFavorite = favorites.some((item) => String(item.id) === String(produtoAtual.id));
    if (isFavorite) await api.delete(`/recursos/favoritos/${produtoAtual.id}`);
    else await api.post(`/recursos/favoritos/${produtoAtual.id}`, {});
    button.textContent = isFavorite ? '♡ Favoritar' : '♥ Nos favoritos';
    showToast(isFavorite ? 'Removido dos favoritos.' : 'Adicionado aos favoritos.');
  } catch (error) {
    if (error.status === 401) window.location.href = '/pages/conta.html';
    else showToast(error.message, 'error');
  }
}

async function createRestockAlertProduto() {
  try {
    const tamanho = document.querySelector('#produtoSizeGrid .produto-size.active')?.dataset.size || null;
    const cor = document.querySelector('.produto-color.active')?.dataset.color || null;
    const result = await api.post(`/recursos/alertas-reposicao/${produtoAtual.id}`, { tamanho, cor });
    showToast(result.message);
  } catch (error) {
    if (error.status === 401) window.location.href = '/pages/conta.html';
    else showToast(error.message, 'error');
  }
}

function engagementProductCard(product) {
  const image = product.imagens?.[0];
  const slug = normalizeText(product.nome).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `<a class="produto-related-card" href="/p/${safeAttr(slug)}/${Number(product.id)}">
    ${image ? `<img src="${safeUrl(image)}" alt="${safeAttr(product.nome)}" loading="lazy" />` : '<div class="produto-page__placeholder">Imagem indisponível</div>'}
    <strong>${safeText(product.nome)}</strong><span>${formatBRL(product.preco_promocional ?? product.preco)}</span>
  </a>`;
}

async function loadProductEngagement() {
  if (!produtoAtual?.id) return;
  if (typeof trackCommerceEvent === 'function') trackCommerceEvent('view_product', { product_id: produtoAtual.id });
  api.post(`/recursos/vistos-recentemente/${produtoAtual.id}`, {}).catch(() => {});
  api.get('/recursos/favoritos').then((favorites) => {
    const button = document.getElementById('btnFavoriteProduto');
    if (button && favorites.some((item) => String(item.id) === String(produtoAtual.id))) button.textContent = '♥ Nos favoritos';
  }).catch(() => {});
  try {
    const [related, recent] = await Promise.all([
      api.get(`/recursos/produtos/${produtoAtual.id}/relacionados`),
      api.get('/recursos/vistos-recentemente').catch(() => []),
    ]);
    let section = document.getElementById('produtoRecommendations');
    if (!section) {
      section = document.createElement('section');
      section.id = 'produtoRecommendations';
      section.className = 'produto-recommendations';
      document.getElementById('produtoComments')?.after(section);
    }
    const recentWithoutCurrent = recent.filter((item) => String(item.id) !== String(produtoAtual.id));
    section.innerHTML = `${related.length ? `<h2>Produtos relacionados</h2><div class="produto-related-grid">${related.map(engagementProductCard).join('')}</div>` : ''}
      ${recentWithoutCurrent.length ? `<h2>Vistos recentemente</h2><div class="produto-related-grid">${recentWithoutCurrent.map(engagementProductCard).join('')}</div>` : ''}`;
  } catch (_) {}
}

function reviewStatusMessage(review) {
  if (!review) return '';
  if (review.status === 'pendente') return 'Sua avaliação está aguardando moderação.';
  if (review.status === 'rejeitada') {
    return `Sua avaliação precisa ser revisada${review.motivo_moderacao ? `: ${review.motivo_moderacao}` : '.'}`;
  }
  return 'Sua avaliação foi aprovada e está publicada.';
}

function renderFormularioAvaliacao(state) {
  const review = state.minha_avaliacao;
  if (!state.autenticado) {
    return `<div class="produto-comment-form">
      <p>Entre na sua conta para avaliar uma compra realizada.</p>
      <a class="btn btn--outline" href="/pages/conta.html">Entrar na conta</a>
    </div>`;
  }
  if (!state.pode_avaliar) {
    return `<div class="produto-comment-form">
      <p>A avaliação é liberada somente para contas com pagamento confirmado deste produto.</p>
    </div>`;
  }
  return `<form class="produto-comment-form" id="produtoReviewForm">
    ${review ? `<p class="produto-review-status">${safeText(reviewStatusMessage(review))}</p>` : ''}
    <label for="reviewNota">Nota</label>
    <select id="reviewNota" required>
      ${[5, 4, 3, 2, 1].map(nota =>
        `<option value="${nota}" ${Number(review?.nota || 5) === nota ? 'selected' : ''}>${nota} estrela${nota > 1 ? 's' : ''}</option>`
      ).join('')}
    </select>
    <label for="reviewTitulo">Título <span>(opcional)</span></label>
    <input type="text" id="reviewTitulo" maxlength="100" value="${safeAttr(review?.titulo || '')}" placeholder="Resuma sua experiência" />
    <label for="reviewComentario">Sua avaliação</label>
    <textarea id="reviewComentario" rows="4" minlength="20" maxlength="2000" placeholder="Conte como foi sua experiência com o produto" required>${safeText(review?.comentario || '')}</textarea>
    <button class="btn btn--primary" type="submit">${review ? 'Reenviar para moderação' : 'Enviar para moderação'}</button>
  </form>`;
}

function renderAvaliacoes(state) {
  const section = document.getElementById('produtoComments');
  const reviews = state.avaliacoes || [];
  const summary = state.resumo || { total: 0, media: 0 };
  section.style.display = 'block';
  section.innerHTML = `
    <div class="produto-comments__header">
      <div>
        <h2>Avaliações de compradores</h2>
        <p>${summary.total} avaliação${summary.total !== 1 ? 'ões' : ''} aprovada${summary.total !== 1 ? 's' : ''}</p>
      </div>
      <span class="produto-comments__score">${Number(summary.media || 0).toFixed(1)}</span>
    </div>
    <div class="produto-comments__list">
      ${reviews.length ? reviews.map(review => `
        <article class="produto-comment">
          <div class="produto-comment__top">
            <div>
              <strong>${safeText(review.autor_nome)}</strong>
              ${review.compra_verificada ? '<span class="produto-review-verified">Compra verificada</span>' : ''}
            </div>
            <span aria-label="${Number(review.nota)} de 5 estrelas">${renderStars(review.nota)}</span>
          </div>
          ${review.titulo ? `<h3>${safeText(review.titulo)}</h3>` : ''}
          <p>${safeText(review.comentario)}</p>
          <time datetime="${safeAttr(review.created_at)}">${new Date(review.created_at).toLocaleDateString('pt-BR')}</time>
        </article>
      `).join('') : '<p class="produto-comments__empty">Ainda não há avaliações publicadas para este produto.</p>'}
    </div>
    ${renderFormularioAvaliacao(state)}
  `;

  document.getElementById('produtoReviewForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const payload = {
      nota: Number(document.getElementById('reviewNota').value),
      titulo: document.getElementById('reviewTitulo').value.trim() || null,
      comentario: document.getElementById('reviewComentario').value.trim(),
    };
    if (payload.comentario.length < 20) {
      showToast('A avaliação deve ter pelo menos 20 caracteres.', 'error');
      return;
    }
    button.disabled = true;
    button.textContent = 'Enviando...';
    try {
      const result = state.minha_avaliacao
        ? await api.put(`/avaliacoes/${state.minha_avaliacao.id}`, payload)
        : await api.post(`/avaliacoes/produto/${produtoAtual.id}`, payload);
      showToast(result.message);
      await loadAvaliacoesProduto();
    } catch (error) {
      showToast(error.message, 'error');
      button.disabled = false;
      button.textContent = state.minha_avaliacao ? 'Reenviar para moderação' : 'Enviar para moderação';
    }
  });
}

async function loadAvaliacoesProduto() {
  if (!produtoAtual?.id) return;
  const requestedProductId = String(produtoAtual.id);
  const section = document.getElementById('produtoComments');
  section.style.display = 'block';
  section.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando avaliações...</p></div>';
  try {
    const state = await api.get(`/avaliacoes/produto/${requestedProductId}`);
    if (String(produtoAtual?.id) !== requestedProductId) return;
    avaliacoesState = state;
    renderAvaliacoes(state);
  } catch (error) {
    section.innerHTML = '<div class="loading-state" style="color:var(--danger)">Não foi possível carregar as avaliações.</div>';
  }
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
