const CART_KEY = 'fc_cart';
let cartItems = JSON.parse(localStorage.getItem(CART_KEY) || '[]');

function makeCartKey(produto, options = {}) {
  const tamanho = options.tamanho || '';
  const pers = options.personalizacao;
  const nome = pers?.nome || '';
  const numero = pers?.numero || '';
  return [produto.id, tamanho, nome, numero].join('|');
}

function getItemKey(item) {
  return item.key || String(item.id);
}

function cartItemDetails(item) {
  const details = [];
  if (item.tamanho) details.push(`Tam. ${item.tamanho}`);
  if (item.personalizacao?.nome || item.personalizacao?.numero) {
    details.push(`Nome ${item.personalizacao.nome || '-'} Nº ${item.personalizacao.numero || '-'}`);
  }
  return details.join(' · ');
}

function saveCart() { localStorage.setItem(CART_KEY, JSON.stringify(cartItems)); }
function getCart()  { return cartItems; }

function addToCart(produto, options = {}) {
  const key = makeCartKey(produto, options);
  const existing = cartItems.find(i => getItemKey(i) === key);
  if (existing) {
    existing.qty++;
  } else {
    cartItems.push({
      key,
      id: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      imagem: (produto.imagens || [])[0] || null,
      tamanho: options.tamanho || null,
      personalizacao: options.personalizacao || null,
      qty: 1,
    });
  }
  saveCart(); renderCart(); updateBadge();
  showToast(`"${produto.nome}" foi adicionado ao carrinho.`);
  openCart();
}

function removeFromCart(idOrKey) {
  cartItems = cartItems.filter(i => getItemKey(i) !== String(idOrKey) && String(i.id) !== String(idOrKey));
  saveCart(); renderCart(); updateBadge();
}

function changeQty(idOrKey, delta) {
  const item = cartItems.find(i => getItemKey(i) === String(idOrKey) || String(i.id) === String(idOrKey));
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart(); renderCart(); updateBadge();
}

function getTotal() { return cartItems.reduce((sum, i) => sum + i.preco * i.qty, 0); }

function updateBadge() {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  const count = cartItems.reduce((s, i) => s + i.qty, 0);
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

function openCart()  { document.getElementById('sideCart')?.classList.add('open'); }
function closeCart() { document.getElementById('sideCart')?.classList.remove('open'); }

function renderCart() {
  const body   = document.getElementById('cartBody');
  const footer = document.getElementById('cartFooter');
  if (!body) return;

  if (cartItems.length === 0) {
    body.innerHTML = '<div class="cart-empty"><p>Seu carrinho está vazio.</p></div>';
    if (footer) footer.style.display = 'none';
    return;
  }

  body.innerHTML = cartItems.map(item => {
    const itemKey = getItemKey(item);
    const details = cartItemDetails(item);
    const jsKey = JSON.stringify(itemKey);
    return `
    <div class="cart-item">
      <div class="cart-item__img">
        ${item.imagem
          ? `<img src="${item.imagem}" alt="${item.nome}" loading="lazy" decoding="async" />`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:.72rem;color:var(--text-dim);text-align:center;">Sem imagem</div>`}
      </div>
      <div class="cart-item__info">
        <div class="cart-item__nome">${item.nome}</div>
        ${details ? `<div class="cart-item__details">${details}</div>` : ''}
        <div class="cart-item__preco">${formatBRL(item.preco)}</div>
        <div class="cart-item__controls">
          <button class="qty-btn" onclick='changeQty(${jsKey}, -1)'>−</button>
          <span class="cart-item__qty">${item.qty}</span>
          <button class="qty-btn" onclick='changeQty(${jsKey}, +1)'>+</button>
          <span class="cart-item__remove" onclick='removeFromCart(${jsKey})'>Remover</span>
        </div>
      </div>
    </div>
  `;
  }).join('');

  if (footer) {
    footer.style.display = 'block';
    const totalEl = document.getElementById('cartTotal');
    if (totalEl) totalEl.textContent = formatBRL(getTotal());
  }
}

// ── PIX PAYLOAD (EMV/BRCode) ──────────────────────────────────────────────────

function _pixCampo(id, valor) {
  return `${id}${String(valor.length).padStart(2, '0')}${valor}`;
}

function _crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

function gerarPixPayload(chave, nomeLoja, cidade, valor) {
  const gui      = _pixCampo('00', 'BR.GOV.BCB.PIX');
  const key      = _pixCampo('01', chave);
  const merchant = _pixCampo('26', gui + key);
  const mcc      = _pixCampo('52', '0000');
  const currency = _pixCampo('53', '986');
  const amount   = valor ? _pixCampo('54', valor.toFixed(2)) : '';
  const country  = _pixCampo('58', 'BR');
  const name     = _pixCampo('59', nomeLoja.substring(0, 25));
  const city     = _pixCampo('60', cidade.substring(0, 15));
  const addData  = _pixCampo('62', _pixCampo('05', '***'));
  const body     = '000201' + merchant + mcc + currency + amount + country + name + city + addData + '6304';
  return body + _crc16(body);
}

// ── CHECKOUT MODAL (Step 1 — formulário) ─────────────────────────────────────

function checkout() {
  if (cartItems.length === 0) return;
  closeCart();
  const overlay = document.getElementById('checkoutOverlay');
  renderCheckoutStep1();
  overlay.style.display = 'flex';
}

function closeCheckoutModal() {
  document.getElementById('checkoutOverlay').style.display = 'none';
}

function renderCheckoutStep1() {
  const content = document.getElementById('checkoutContent');
  const linhasResumo = cartItems.map(i =>
    `<div class="co-resumo-item"><span>${i.nome} <em>x${i.qty}</em></span><span>${formatBRL(i.preco * i.qty)}</span></div>`
  ).join('');

  content.innerHTML = `
    <div class="co-header">
      <h2>Finalizar pedido</h2>
      <button class="modal__close" id="btnFecharCheckout">Fechar</button>
    </div>
    <div class="co-resumo">
      ${linhasResumo}
      <div class="co-resumo-total"><span>Total</span><strong>${formatBRL(getTotal())}</strong></div>
    </div>
    <div class="co-form">
      <h3 class="co-section-title">Dados do cliente</h3>
      <div class="co-form-row">
        <div class="co-form-group">
          <label>Nome completo *</label>
          <input type="text" id="co_nome" placeholder="Nome e sobrenome" />
        </div>
        <div class="co-form-group">
          <label>Telefone *</label>
          <input type="tel" id="co_telefone" placeholder="(54) 99999-9999" />
        </div>
      </div>
      <div class="co-form-row">
        <div class="co-form-group">
          <label>E-mail *</label>
          <input type="email" id="co_email" placeholder="email@dominio.com" />
        </div>
      </div>
      <div class="co-form-row">
        <div class="co-form-group">
          <label>Endereço *</label>
          <input type="text" id="co_endereco" placeholder="Rua, número e bairro" />
        </div>
        <div class="co-form-group">
          <label>Cidade e estado *</label>
          <input type="text" id="co_cidade" placeholder="Cidade / UF" />
        </div>
      </div>
      <div class="co-form-row">
        <div class="co-form-group">
          <label>CEP *</label>
          <input type="text" id="co_cep" placeholder="00000-000" maxlength="9" />
        </div>
      </div>
      <h3 class="co-section-title">Forma de pagamento</h3>
      <div class="co-payment-opts">
        <label class="co-payment-opt">
          <input type="radio" name="co_pagamento" value="pix" checked />
          <div class="co-payment-card">
            <span class="co-payment-icon"></span>
            <div><strong>PIX</strong><small>Pagamento instantâneo</small></div>
          </div>
        </label>
        <label class="co-payment-opt">
          <input type="radio" name="co_pagamento" value="whatsapp" />
          <div class="co-payment-card">
            <span class="co-payment-icon"></span>
            <div><strong>WhatsApp</strong><small>Combine pelo chat</small></div>
          </div>
        </label>
      </div>
      <button type="button" id="btnConfirmarPedido" class="btn btn--primary co-btn-submit">Confirmar pedido</button>
    </div>
  `;

  // Pré-preenche com dados salvos do usuário
  try {
    const saved = JSON.parse(localStorage.getItem('fc_user') || 'null');
    if (saved) {
      if (saved.nome)         document.getElementById('co_nome').value = saved.nome;
      if (saved.telefone)     document.getElementById('co_telefone').value = saved.telefone;
      if (saved.email)        document.getElementById('co_email').value = saved.email;
      if (saved.endereco_rua) document.getElementById('co_endereco').value = saved.endereco_rua;
      if (saved.cidade)       document.getElementById('co_cidade').value = saved.cidade;
      if (saved.cep)          document.getElementById('co_cep').value = saved.cep;
    }
  } catch(_) {}

  const btnFechar = document.getElementById('btnFecharCheckout');
  const btnConfirmar = document.getElementById('btnConfirmarPedido');
  // cloneNode remove quaisquer listeners antigos antes de adicionar novo
  const btnConfirmarClean = btnConfirmar.cloneNode(true);
  btnConfirmar.parentNode.replaceChild(btnConfirmarClean, btnConfirmar);
  btnFechar.addEventListener('click', closeCheckoutModal);
  btnConfirmarClean.addEventListener('click', confirmarPedido);
}

async function confirmarPedido() {
  try {
    const nome     = document.getElementById('co_nome').value.trim();
    const telefone = document.getElementById('co_telefone').value.trim();
    const email    = document.getElementById('co_email').value.trim();
    const endRua   = document.getElementById('co_endereco').value.trim();
    const cidade   = document.getElementById('co_cidade').value.trim();
    const cep      = document.getElementById('co_cep').value.trim();

    if (!nome || !telefone || !email || !endRua || !cidade || !cep) {
      showToast('Preencha todos os campos obrigatórios.', 'error');
      return;
    }

    const metodoEl = document.querySelector('input[name="co_pagamento"]:checked');
    const metodo   = metodoEl ? metodoEl.value : 'pix';
    const endereco = `${endRua} — ${cidade} — CEP: ${cep}`;
    const total    = getTotal();

    const btn = document.getElementById('btnConfirmarPedido');
    if (btn) { btn.disabled = true; btn.textContent = 'Processando...'; }

    let pedidoId = null;
    try {
      const res = await api.post('/pedidos', {
        itens: cartItems, total,
        nome_cliente: nome, email_cliente: email,
        telefone_cliente: telefone, endereco,
        metodo_pagamento: metodo,
      });
      pedidoId = res.id;
    } catch(apiErr) {
      console.warn('[checkout:order:create:error]', apiErr);
    }

    // Captura itens antes de limpar (para mensagem WhatsApp)
    const itensCopia = [...cartItems];

    // Limpa carrinho
    cartItems = [];
    saveCart();
    renderCart();
    updateBadge();

    // Fecha o checkout form
    closeCheckoutModal();

    if (metodo === 'pix') {
      abrirPixOverlay(pedidoId, total);
    } else {
      const linhas = itensCopia.map(i => {
        const details = cartItemDetails(i);
        return `• ${i.nome}${details ? ` — ${details}` : ''} (x${i.qty}) — ${formatBRL(i.preco * i.qty)}`;
      }).join('\n');
      const msg = `Novo pedido - Fanáticos FC\n\nPedido #${pedidoId || '?'}\n\n${linhas}\n\nTotal: ${formatBRL(total)}\n\n${nome}\n${telefone}\n${email}\n${endereco}\n\nSolicito a finalização deste pedido.`;
      window.open(`https://wa.me/5554991138217?text=${encodeURIComponent(msg)}`, '_blank');
      showToast('Pedido enviado via WhatsApp.');
    }
  } catch(err) {
    console.error('[checkout:unexpected:error]', err);
    showToast('Erro ao processar pedido. Tente novamente.', 'error');
    const btn = document.getElementById('btnConfirmarPedido');
    if (btn) { btn.disabled = false; btn.textContent = 'Confirmar pedido'; }
  }
}

// ── PIX OVERLAY (criado dinamicamente, imune a interferências) ────────────────

function abrirPixOverlay(pedidoId, total) {
  console.log('[pix:overlay:open]', { total });
  // Se já está aberto, não faz nada (evita fechar e reabrir)
  if (document.getElementById('_pixModal')) {
    console.warn('[pix:overlay:already-open]');
    return;
  }

  const PIX_CPF    = '032.962.710-40';
  const PIX_NOME   = 'Fanaticos FC';
  const PIX_CIDADE = 'Caxias do Sul';

  const payload      = gerarPixPayload(PIX_CPF, PIX_NOME, PIX_CIDADE, total);
  const qrUrl        = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}`;
  const cpfFormatado = PIX_CPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

  // Cria overlay diretamente no body — z-index 9999 garante que nada fique na frente
  const overlay = document.createElement('div');
  overlay.id = '_pixModal';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:9999',
    'background:rgba(0,0,0,0.85)', 'backdrop-filter:blur(4px)',
    'display:flex', 'align-items:flex-start', 'justify-content:center',
    'overflow-y:auto', 'padding:1rem',
  ].join(';');

  overlay.innerHTML = `
    <div class="modal modal--checkout" style="margin:auto;width:100%;max-width:640px">
      <div class="co-header">
        <h2>Pague via PIX</h2>
        <button class="modal__close" id="_btnFecharPix">Fechar</button>
      </div>
      <div class="pix-box">
        <div class="pix-qr-wrap">
          <img src="${qrUrl}" alt="QR Code PIX" class="pix-qr-img" />
          <p class="pix-qr-hint">Escaneie com o app do seu banco</p>
        </div>
        <div class="pix-divider"><span>ou use a chave abaixo</span></div>
        <div class="pix-key-wrap">
          <div class="pix-key-label">Chave PIX — CPF</div>
          <div class="pix-key-value" id="_pixKey">${cpfFormatado}</div>
          <button class="btn btn--outline pix-copy-btn" id="_btnCopiarChave">Copiar Chave</button>
        </div>
        <div class="pix-key-wrap" style="margin-top:.75rem">
          <div class="pix-key-label">PIX Copia e Cola</div>
          <div class="pix-key-value pix-key-value--sm" id="_pixPayload">${payload}</div>
          <button class="btn btn--outline pix-copy-btn" id="_btnCopiarPayload">Copiar código completo</button>
        </div>
        <div class="pix-info-row">
          <div class="pix-info-item"><span>Beneficiário</span><strong>Fanáticos FC</strong></div>
          <div class="pix-info-item"><span>Valor</span><strong>${formatBRL(total)}</strong></div>
          ${pedidoId ? `<div class="pix-info-item"><span>Nº do Pedido</span><strong>#${pedidoId}</strong></div>` : ''}
        </div>
        <div class="pix-steps">
          <div class="pix-step"><span class="pix-step-num">1</span> Abra o app do seu banco</div>
          <div class="pix-step"><span class="pix-step-num">2</span> Escaneie o QR code <em>ou</em> use a chave CPF</div>
          <div class="pix-step"><span class="pix-step-num">3</span> Confirme o valor e pague</div>
          <div class="pix-step"><span class="pix-step-num">4</span> Envie o comprovante pelo WhatsApp</div>
        </div>
        ${pedidoId ? `<p class="pix-rastreio-hint">Guarde o número <strong>#${pedidoId}</strong> para rastrear seu pedido.</p>` : ''}
      </div>
      <div class="co-pix-actions">
        <button class="btn btn--whatsapp" id="_btnEnviarComp">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
          Enviar comprovante via WhatsApp
        </button>
        <button class="btn btn--outline" id="_btnJaPaguei">Confirmar pagamento</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  function fechar() { overlay.remove(); }

  overlay.querySelector('#_btnFecharPix').addEventListener('click', fechar);
  overlay.querySelector('#_btnCopiarChave').addEventListener('click', () => {
    navigator.clipboard.writeText(PIX_CPF).then(() => showToast('Chave PIX copiada.'));
  });
  overlay.querySelector('#_btnCopiarPayload').addEventListener('click', () => {
    navigator.clipboard.writeText(overlay.querySelector('#_pixPayload').textContent)
      .then(() => showToast('Código PIX copiado.'));
  });
  overlay.querySelector('#_btnEnviarComp').addEventListener('click', () => {
    const msg = `Olá. Realizei o pagamento via PIX do pedido #${pedidoId || '?'}. Segue o comprovante.`;
    window.open(`https://wa.me/5554991138217?text=${encodeURIComponent(msg)}`, '_blank');
  });
  overlay.querySelector('#_btnJaPaguei').addEventListener('click', () => {
    fechar();
    showToast('Pedido registrado. Aguarde a confirmação.');
  });
}

function fecharPixOverlay() {
  document.getElementById('_pixModal')?.remove();
}

// ── RASTREAR PEDIDO ───────────────────────────────────────────────────────────

function openTrackingModal() {
  const overlay = document.getElementById('trackingOverlay');
  if (!overlay) return;

  document.getElementById('trackingContent').innerHTML = `
    <div class="co-header">
      <h2>Rastrear pedido</h2>
      <button class="modal__close" id="btnFecharRastreio">Fechar</button>
    </div>
    <p class="tracking-hint">Informe o número do seu pedido para ver o status da entrega.</p>
    <div class="co-form">
      <div class="co-form-group">
        <label>Número do pedido *</label>
        <input type="number" id="trackingId" placeholder="Exemplo: 42" min="1" />
      </div>
      <button type="button" id="btnBuscarRastreio" class="btn btn--primary co-btn-submit">Consultar status</button>
    </div>
    <div id="trackingResult"></div>
  `;

  overlay.style.display = 'flex';

  document.getElementById('btnFecharRastreio').addEventListener('click', () => {
    overlay.style.display = 'none';
  });
  document.getElementById('btnBuscarRastreio').addEventListener('click', buscarRastreio);
}

async function buscarRastreio() {
  const id = document.getElementById('trackingId').value;
  if (!id) return;
  const result = document.getElementById('trackingResult');
  result.innerHTML = '<div class="loading-state" style="padding:1rem"><div class="spinner"></div></div>';

  const STATUS_MAP = {
    'pendente':             { label: 'Pedido Recebido',       icon: '', step: 1 },
    'aguardando_pagamento': { label: 'Aguardando Pagamento',  icon: '', step: 1 },
    'pago':                 { label: 'Pagamento Confirmado',  icon: '', step: 2 },
    'em_separacao':         { label: 'Em Separação',          icon: '', step: 3 },
    'enviado':              { label: 'Enviado / Em Trânsito', icon: '', step: 4 },
    'entregue':             { label: 'Entregue',              icon: '', step: 5 },
    'cancelado':            { label: 'Cancelado',             icon: '', step: 0 },
  };

  try {
    const pedido = await api.get(`/pedidos/${id}/rastreio`);
    const info   = STATUS_MAP[pedido.status] || { label: pedido.status, icon: '', step: 1 };
    const steps  = ['Pedido Recebido', 'Pagamento', 'Em Separação', 'Enviado', 'Entregue'];

    result.innerHTML = `
      <div class="tracking-result">
        <div class="tracking-status-badge">
          <span>${info.icon}</span>
          <div>
            <strong>${info.label}</strong>
            <small>Pedido #${pedido.id} · ${formatBRL(pedido.total)}</small>
          </div>
        </div>
        <div class="tracking-steps">
          ${steps.map((s, i) => `
            <div class="tracking-step ${info.step > i ? 'done' : ''} ${info.step === i + 1 ? 'active' : ''}">
              <div class="tracking-step__dot"></div>
              <div class="tracking-step__label">${s}</div>
            </div>
          `).join('')}
        </div>
        ${pedido.codigo_rastreio ? `
          <div class="tracking-code-box">
            <span>Código de Rastreio</span>
            <strong id="trackCode">${pedido.codigo_rastreio}</strong>
            <button class="btn btn--outline btn--sm" id="btnCopyTrack">Copiar</button>
          </div>
        ` : ''}
        <p class="tracking-date">Pedido em ${new Date(pedido.created_at).toLocaleString('pt-BR')}</p>
      </div>
    `;

    document.getElementById('btnCopyTrack')?.addEventListener('click', () => {
      navigator.clipboard.writeText(pedido.codigo_rastreio).then(() => showToast('Código copiado.'));
    });
  } catch(_) {
    result.innerHTML = `<p style="color:var(--danger);text-align:center;padding:1rem">Pedido #${id} não encontrado.</p>`;
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  updateBadge();
  renderCart();

  document.getElementById('btnCart')?.addEventListener('click', openCart);
  document.getElementById('btnCloseCart')?.addEventListener('click', closeCart);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCart);
  document.getElementById('btnCheckout')?.addEventListener('click', checkout);
  document.getElementById('btnRastrear')?.addEventListener('click', openTrackingModal);

  // Fecha checkout form ao clicar no fundo
  document.getElementById('checkoutOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'checkoutOverlay') closeCheckoutModal();
  });
});
