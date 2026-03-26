const CART_KEY = 'fc_cart';
let cartItems = JSON.parse(localStorage.getItem(CART_KEY) || '[]');

function saveCart() { localStorage.setItem(CART_KEY, JSON.stringify(cartItems)); }

function getCart() { return cartItems; }

function addToCart(produto) {
  const existing = cartItems.find(i => i.id === produto.id);
  if (existing) {
    existing.qty++;
  } else {
    cartItems.push({ id: produto.id, nome: produto.nome, preco: produto.preco, imagem: (produto.imagens || [])[0] || null, qty: 1 });
  }
  saveCart();
  renderCart();
  updateBadge();
  showToast(`"${produto.nome}" adicionado ao carrinho! 🛒`);
  openCart();
}

function removeFromCart(id) {
  cartItems = cartItems.filter(i => i.id !== id);
  saveCart();
  renderCart();
  updateBadge();
}

function changeQty(id, delta) {
  const item = cartItems.find(i => i.id === id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart();
  renderCart();
  updateBadge();
}

function getTotal() { return cartItems.reduce((sum, i) => sum + i.preco * i.qty, 0); }

function updateBadge() {
  const badge = document.getElementById('cartBadge');
  if (badge) {
    const total = cartItems.reduce((s, i) => s + i.qty, 0);
    badge.textContent = total;
    badge.style.display = total > 0 ? 'flex' : 'none';
  }
}

function openCart() {
  document.getElementById('sideCart')?.classList.add('open');
}
function closeCart() {
  document.getElementById('sideCart')?.classList.remove('open');
}

function renderCart() {
  const body = document.getElementById('cartBody');
  const footer = document.getElementById('cartFooter');
  const totalEl = document.getElementById('cartTotal');
  if (!body) return;

  if (cartItems.length === 0) {
    body.innerHTML = '<div class="cart-empty"><span>🛒</span><p>Seu carrinho está vazio</p></div>';
    if (footer) footer.style.display = 'none';
    return;
  }

  body.innerHTML = cartItems.map(item => `
    <div class="cart-item" data-id="${item.id}">
      <div class="cart-item__img">
        ${item.imagem
          ? `<img src="${item.imagem}" alt="${item.nome}" loading="lazy" />`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.8rem;">⚽</div>`}
      </div>
      <div class="cart-item__info">
        <div class="cart-item__nome">${item.nome}</div>
        <div class="cart-item__preco">${formatBRL(item.preco)}</div>
        <div class="cart-item__controls">
          <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
          <span class="cart-item__qty">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${item.id}, +1)">+</button>
          <span class="cart-item__remove" onclick="removeFromCart(${item.id})">✕ Remover</span>
        </div>
      </div>
    </div>
  `).join('');

  if (footer) {
    footer.style.display = 'block';
    if (totalEl) totalEl.textContent = formatBRL(getTotal());
  }
}

function checkout() {
  if (cartItems.length === 0) return;

  api.post('/pedidos', { itens: cartItems, total: getTotal() }).catch(() => {});

  const linhas = cartItems.map(i => `• ${i.nome} (x${i.qty}) — ${formatBRL(i.preco * i.qty)}`).join('\n');
  const msg = `🛒 *Novo Pedido — Fanáticos FC*\n\n${linhas}\n\n*Total: ${formatBRL(getTotal())}*\n\nGostaria de finalizar meu pedido!`;
  const encoded = encodeURIComponent(msg);
  const whatsapp = `https://wa.me/5554991138217?text=${encoded}`;
  window.open(whatsapp, '_blank');
}

document.addEventListener('DOMContentLoaded', () => {
  updateBadge();
  renderCart();
  document.getElementById('btnCart')?.addEventListener('click', openCart);
  document.getElementById('btnCloseCart')?.addEventListener('click', closeCart);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCart);
  document.getElementById('btnCheckout')?.addEventListener('click', checkout);
});
