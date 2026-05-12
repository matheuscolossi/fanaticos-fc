// ── Página de Carrinho Completo ───────────────────────────────────────────

function renderCartPage() {
  const layout = document.getElementById('cartPageLayout');
  if (!layout) return;

  const items = getCart();
  updateBadge();

  if (items.length === 0) {
    layout.innerHTML = `
      <div class="cart-page__empty">
        <span></span>
        <h2>Seu carrinho está vazio</h2>
        <p>Adicione produtos para continuar</p>
        <a href="../index.html" class="btn btn--primary">Ver Catálogo</a>
      </div>
    `;
    return;
  }

  const subtotal    = getTotal();
  const freteGratis = subtotal >= 300;
  const totalFinal  = subtotal; // frete é grátis acima de R$300, senão calculado no checkout

  layout.innerHTML = `
    <div class="cart-page__inner">
      <div class="cart-page__items">
        <div class="cart-page__items-header">
          <span>Produto</span>
          <span>Qtd</span>
          <span>Subtotal</span>
          <span></span>
        </div>
        ${items.map(item => {
          const itemKey = getItemKey(item);
          const details = cartItemDetails(item);
          const jsKey = JSON.stringify(itemKey);
          return `
          <div class="cart-page__item">
            <div class="cart-page__item-product">
              <div class="cart-page__item-img">
                ${item.imagem
                  ? `<img src="${item.imagem}" alt="${item.nome}" loading="lazy" decoding="async" />`
                  : `<div class="cart-page__item-placeholder"></div>`}
              </div>
              <div class="cart-page__item-info">
                <div class="cart-page__item-nome">${item.nome}</div>
                ${details ? `<div class="cart-page__item-details">${details}</div>` : ''}
                <div class="cart-page__item-preco">${formatBRL(item.preco)} / un.</div>
              </div>
            </div>
            <div class="cart-page__item-controls">
              <button class="qty-btn" onclick='changeQty(${jsKey}, -1); renderCartPage()'>−</button>
              <span class="cart-item__qty">${item.qty}</span>
              <button class="qty-btn" onclick='changeQty(${jsKey}, +1); renderCartPage()'>+</button>
            </div>
            <div class="cart-page__item-subtotal">${formatBRL(item.preco * item.qty)}</div>
            <button class="cart-page__item-remove" onclick='removeFromCart(${jsKey}); renderCartPage()' title="Remover item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        `;
        }).join('')}
        <div class="cart-page__items-footer">
          <button class="btn btn--ghost btn--sm" onclick="cartPageClearAll()"> Limpar carrinho</button>
        </div>
      </div>

      <aside class="cart-page__summary">
        <h3 class="cart-page__summary-title">Resumo do Pedido</h3>
        <div class="cart-page__summary-row">
          <span>Subtotal (${items.reduce((s, i) => s + i.qty, 0)} itens)</span>
          <span>${formatBRL(subtotal)}</span>
        </div>
        <div class="cart-page__summary-row">
          <span>Frete</span>
          <span class="${freteGratis ? 'cart-summary__frete-gratis' : 'cart-summary__frete-calc'}">
            ${freteGratis ? 'Frete grátis' : 'A calcular'}
          </span>
        </div>
        ${!freteGratis ? `
          <div class="cart-summary__frete-bar">
            <div class="cart-summary__frete-bar-fill" style="width:${Math.min(100, (subtotal / 300) * 100).toFixed(0)}%"></div>
          </div>
          <p class="cart-summary__frete-hint">Faltam <strong>${formatBRL(300 - subtotal)}</strong> para frete grátis</p>
        ` : ''}
        <div class="cart-page__summary-total">
          <span>Total</span>
          <strong>${formatBRL(totalFinal)}</strong>
        </div>
        <button class="btn btn--primary cart-page__checkout-btn" id="btnCartCheckout">
          Finalizar Pedido →
        </button>
        <a href="../index.html" class="btn btn--outline cart-page__back-btn">← Continuar comprando</a>
      </aside>
    </div>
  `;

  document.getElementById('btnCartCheckout').addEventListener('click', checkout);
}

function cartPageClearAll() {
  if (!confirm('Remover todos os itens do carrinho?')) return;
  const items = getCart();
  items.forEach(item => removeFromCart(getItemKey(item)));
  renderCartPage();
}

document.addEventListener('DOMContentLoaded', () => {
  renderCartPage();

  // Ícone do carrinho vai para a própria página (já está aqui)
  document.getElementById('btnCart')?.addEventListener('click', () => {
    window.location.href = 'carrinho.html';
  });

  // Botão de usuário
  document.getElementById('btnUser')?.addEventListener('click', () => {
    const raw = localStorage.getItem('fc_user');
    if (raw) {
      window.location.href = 'conta.html';
    } else {
      window.location.href = 'conta.html';
    }
  });
});
