// ── Página de Carrinho Completo ───────────────────────────────────────────
// cupomAplicado vive em cart.js (getCupomAplicado/setCupomAplicado) porque o
// checkout (confirmarPedido) também precisa dele e roda em outras páginas.

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

  const subtotal = getTotal();

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
        <div class="cart-page__summary-row" id="cartFreteRow">
          <span>Frete</span>
          <span class="cart-summary__frete-calc">Calculando...</span>
        </div>
        <div class="cart-page__summary-row" id="cartDescontoRow" style="display:none">
          <span>Desconto</span>
          <span class="cart-summary__desconto"></span>
        </div>

        <div class="cart-page__cupom">
          <input type="text" id="inputCupom" placeholder="Código do cupom (ex: URI10)" value="${getCupomAplicado()}" />
          <button class="btn btn--outline btn--sm" id="btnAplicarCupom">Aplicar</button>
        </div>
        <p class="cart-summary__cupom-msg" id="cupomMsg"></p>

        <div class="cart-page__summary-total">
          <span>Total</span>
          <strong id="cartTotalFinal">${formatBRL(subtotal)}</strong>
        </div>
        <button class="btn btn--primary cart-page__checkout-btn" id="btnCartCheckout">
          Finalizar Pedido →
        </button>
        <a href="../index.html" class="btn btn--outline cart-page__back-btn">← Continuar comprando</a>
      </aside>
    </div>
  `;

  document.getElementById('btnCartCheckout').addEventListener('click', checkout);
  document.getElementById('btnAplicarCupom').addEventListener('click', () => {
    setCupomAplicado(document.getElementById('inputCupom').value.trim());
    atualizarResumoCarrinho();
  });
  document.getElementById('inputCupom').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btnAplicarCupom').click();
  });

  atualizarResumoCarrinho();
}

// Calcula frete/desconto/total via POST /cart (regra oficial: frete grátis >= R$200,
// senão R$25; cupom validado contra o banco, com todas as regras do admin). Calculado no backend, não no front.
async function atualizarResumoCarrinho() {
  const items = getCart();
  if (items.length === 0) return;

  const cupomAplicado = getCupomAplicado();
  const freteRow    = document.getElementById('cartFreteRow');
  const descontoRow = document.getElementById('cartDescontoRow');
  const totalEl      = document.getElementById('cartTotalFinal');
  const msgEl         = document.getElementById('cupomMsg');

  try {
    const resumo = await fetchCartSummary(
      items.map(i => ({ productId: i.id, qty: i.qty })),
      cupomAplicado || undefined
    );
    setCartResumo(resumo);

    if (freteRow) {
      const span = freteRow.querySelector('span:last-child');
      const gratis = resumo.freight === 0;
      span.className = gratis ? 'cart-summary__frete-gratis' : 'cart-summary__frete-calc';
      span.textContent = gratis ? 'Frete grátis' : formatBRL(resumo.freight);
    }

    if (descontoRow) {
      if (resumo.discount > 0) {
        descontoRow.style.display = 'flex';
        descontoRow.querySelector('span:last-child').textContent = `− ${formatBRL(resumo.discount)}`;
      } else {
        descontoRow.style.display = 'none';
      }
    }

    if (totalEl) totalEl.textContent = formatBRL(resumo.total);

    if (msgEl) {
      if (!cupomAplicado) {
        msgEl.textContent = '';
      } else if (resumo.discount > 0) {
        msgEl.textContent = `Cupom "${cupomAplicado}" aplicado.`;
        msgEl.className = 'cart-summary__cupom-msg cart-summary__cupom-msg--ok';
      } else {
        msgEl.textContent = resumo.cupomErro || 'Cupom inválido.';
        msgEl.className = 'cart-summary__cupom-msg cart-summary__cupom-msg--erro';
      }
    }
  } catch (e) {
    // Fallback: aplica a mesma regra de frete localmente se a API não responder
    const subtotal = getTotal();
    if (freteRow) {
      const span = freteRow.querySelector('span:last-child');
      const gratis = subtotal >= 200;
      span.className = gratis ? 'cart-summary__frete-gratis' : 'cart-summary__frete-calc';
      span.textContent = gratis ? 'Frete grátis' : formatBRL(25);
    }
    const frete = subtotal >= 200 ? 0 : 25;
    if (totalEl) totalEl.textContent = formatBRL(subtotal + frete);
    if (msgEl) {
      msgEl.textContent = cupomAplicado ? 'Não foi possível validar o cupom agora.' : '';
      msgEl.className = 'cart-summary__cupom-msg cart-summary__cupom-msg--erro';
    }
    setCartResumo({ subtotal, freight: frete, discount: 0, total: subtotal + frete });
  }
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
