// ── Página de Conta ───────────────────────────────────────────────────────

const STATUS_CONTA = {
  'pendente':             { label: 'Pedido Recebido',      icon: '', cor: '' },
  'aguardando_pagamento': { label: 'Aguardando Pagamento', icon: '', cor: 'warning' },
  'pago':                 { label: 'Pagamento Confirmado', icon: '', cor: 'success' },
  'em_separacao':         { label: 'Em Separação',         icon: '', cor: 'info' },
  'enviado':              { label: 'Enviado / Em Trânsito',icon: '', cor: 'info' },
  'entregue':             { label: 'Entregue',             icon: '', cor: 'success' },
  'cancelado':            { label: 'Cancelado',            icon: '', cor: 'danger' },
};

let contaTab = 'pedidos';
let contaUser = null;

function getContaUser() {
  try { return JSON.parse(localStorage.getItem('fc_user') || 'null'); } catch { return null; }
}

// ── Render principal ──────────────────────────────────────────────────────

async function renderContaPage() {
  contaUser = getContaUser();

  // O perfil salvo no navegador é apenas um cache. Atualiza-o pelo servidor
  // antes de exibir qualquer badge ou link administrativo.
  try {
    const serverUser = await api.get('/auth/perfil');
    contaUser = serverUser;
    localStorage.removeItem('fc_token');
    localStorage.setItem('fc_user', JSON.stringify(serverUser));
  } catch (e) {
    const authFailure = ['AUTH_TOKEN_REQUIRED', 'AUTH_TOKEN_INVALID', 'AUTH_USER_NOT_FOUND', 'ACCESS_DISABLED']
      .includes(e.code);
    if (authFailure) {
      localStorage.removeItem('fc_token');
      localStorage.removeItem('fc_user');
      contaUser = null;
    } else if (contaUser) {
      // Sem resposta do backend, não conceda privilégios visuais baseados no cache.
      contaUser = { ...contaUser, perfil: 'cliente', cargo: null, permissoes: [] };
    }
  }

  const content = document.getElementById('contaContent');
  if (!content) return;

  // Atualiza badge do carrinho no header
  const cartBadge = document.getElementById('cartBadge');
  if (cartBadge) {
    const cart = JSON.parse(localStorage.getItem('fc_cart') || '[]');
    const count = cart.reduce((s, i) => s + i.qty, 0);
    cartBadge.textContent = count;
    cartBadge.style.display = count > 0 ? 'flex' : 'none';
  }

  if (!contaUser) {
    renderContaLogin();
    return;
  }

  content.innerHTML = `
    <div class="conta-header">
      <div class="conta-header__info">
        <div class="conta-avatar">${safeText(contaUser.nome.charAt(0).toUpperCase())}</div>
        <div>
          <h1 class="conta-header__nome">${safeText(contaUser.nome)}</h1>
          <p class="conta-header__email">${safeText(contaUser.email)}</p>
          ${contaUser.perfil === 'admin' ? '<span class="conta-badge-admin">Admin</span>' : ''}
        </div>
      </div>
      <div class="conta-header__actions">
        ${contaUser.perfil === 'admin' ? `<a href="admin.html" class="btn btn--outline btn--sm">Painel Admin</a>` : ''}
        <button class="btn btn--outline btn--sm" id="btnContaLogout">Sair</button>
      </div>
    </div>

    <div class="conta-tabs">
      <button class="conta-tab ${contaTab === 'pedidos' ? 'active' : ''}" data-tab="pedidos">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        Meus Pedidos
      </button>
      <button class="conta-tab ${contaTab === 'perfil' ? 'active' : ''}" data-tab="perfil">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        Meu Perfil
      </button>
      <button class="conta-tab ${contaTab === 'favoritos' ? 'active' : ''}" data-tab="favoritos">♥ Favoritos</button>
      <button class="conta-tab ${contaTab === 'trocas' ? 'active' : ''}" data-tab="trocas">Trocas e devoluções</button>
    </div>

    <div id="contaTabContent"></div>
  `;

  document.getElementById('btnContaLogout').addEventListener('click', async () => {
    if (confirm('Deseja sair da sua conta?')) {
      try { await api.post('/auth/logout', {}); } catch (_) {}
      localStorage.removeItem('fc_token');
      localStorage.removeItem('fc_user');
      renderContaPage();
    }
  });

  document.querySelectorAll('.conta-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      contaTab = btn.dataset.tab;
      document.querySelectorAll('.conta-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderContaTab();
    });
  });

  renderContaTab();
}

function renderContaTab() {
  if (contaTab === 'perfil') renderPerfilTab();
  else if (contaTab === 'favoritos') renderFavoritosTab();
  else if (contaTab === 'trocas') renderTrocasTab();
  else renderPedidosTab();
}

// ── Aba Pedidos ───────────────────────────────────────────────────────────

async function renderPedidosTab() {
  const content = document.getElementById('contaTabContent');
  content.innerHTML = `
    <div class="loading-state" style="padding:3rem 0">
      <div class="spinner"></div>
      <p>Carregando pedidos...</p>
    </div>
  `;

  try {
    const pedidos = await api.get('/pedidos/meus');

    if (pedidos.length === 0) {
      content.innerHTML = `
        <div class="empty-state" style="padding:4rem 1rem">
          <p style="font-size:3rem"></p>
          <p>Você ainda não fez nenhum pedido.</p>
          <a href="../index.html" class="btn btn--primary">Ver Catálogo</a>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div class="pedidos-conta-list">
        ${pedidos.map(pedido => {
          const info = STATUS_CONTA[pedido.status] || { label: pedido.status, icon: '', cor: '' };
          const data = new Date(pedido.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
          return `
            <div class="pedido-conta-card">
              <div class="pedido-conta-card__header">
                <div class="pedido-conta-card__id">
                  Pedido <strong>#${pedido.id}</strong>
                  <span class="pedido-conta-card__date">${data}</span>
                </div>
                <div class="pedido-conta-card__status status--${info.cor}">
                  ${safeText(info.icon)} ${safeText(info.label)}
                </div>
              </div>

              <div class="pedido-conta-card__meta">
                <span>${pedido.stripe_session_id || pedido.metodo_pagamento === 'stripe' ? 'Stripe (cartão ou PIX)' : 'Pagamento legado'}</span>
                ${pedido.endereco ? `<span>${safeText(pedido.endereco)}</span>` : ''}
                <strong class="pedido-conta-card__total">${formatBRL(pedido.total)}</strong>
              </div>

              ${pedido.itens && pedido.itens.length > 0 ? `
                <div class="pedido-conta-card__itens">
                  ${pedido.itens.map(i => `
                    <div class="pedido-conta-card__item">
                      ${i.imagem
                        ? `<img src="${safeUrl(i.imagem)}" alt="${safeAttr(i.nome)}" />`
                        : `<div class="pedido-item-placeholder"></div>`}
                      <div>
                        <div class="pedido-item-nome">${safeText(i.nome)}</div>
                        <div class="pedido-item-qty">x${i.qty} · ${formatBRL(i.preco * i.qty)}</div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}

              ${pedido.codigo_rastreio ? `
                <div class="pedido-conta-card__rastreio">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>Código de rastreio:</span>
                  <strong id="trackCode_${pedido.id}">${safeText(pedido.codigo_rastreio)}</strong>
                  <button class="btn btn--outline btn--sm" data-copy="${pedido.id}">Copiar</button>
                  ${pedido.rastreio_url ? `<a class="btn btn--primary btn--sm" href="${safeUrl(pedido.rastreio_url)}" target="_blank" rel="noopener">Acompanhar na ${safeText(pedido.transportadora || 'transportadora')}</a>` : ''}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Botões copiar rastreio
    content.querySelectorAll('[data-copy]').forEach(btn => {
      const id = btn.dataset.copy;
      btn.addEventListener('click', () => {
        const code = document.getElementById(`trackCode_${id}`)?.textContent;
        if (code) navigator.clipboard.writeText(code).then(() => showToast('Código copiado! '));
      });
    });

  } catch (e) {
    content.innerHTML = `
      <div class="empty-state" style="padding:3rem 1rem">
        <p style="color:var(--danger)">${safeText(e.message)}</p>
        <button class="btn btn--outline" id="btnRetryPedidos">Tentar novamente</button>
      </div>
    `;
    document.getElementById('btnRetryPedidos')?.addEventListener('click', renderPedidosTab);
  }
}

// ── Favoritos, alertas e trocas ──────────────────────────────────────────

async function renderFavoritosTab() {
  const content = document.getElementById('contaTabContent');
  content.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  try {
    const [favorites, alerts] = await Promise.all([
      api.get('/recursos/favoritos'),
      api.get('/recursos/alertas-reposicao'),
    ]);
    content.innerHTML = `
      <div class="perfil-card"><h2 class="perfil-card__title">Minha lista de desejos</h2>
        ${favorites.length ? `<div class="produto-related-grid">${favorites.map((product) => {
          const slug = normalizeText(product.nome).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          return `<article class="produto-related-card">
            <a href="/p/${safeAttr(slug)}/${Number(product.id)}">${product.imagens?.[0] ? `<img src="${safeUrl(product.imagens[0])}" alt="${safeAttr(product.nome)}" />` : ''}<strong>${safeText(product.nome)}</strong></a>
            <span>${formatBRL(product.preco_promocional ?? product.preco)}</span>
            <button class="btn btn--outline btn--sm" data-remove-favorite="${Number(product.id)}">Remover</button>
          </article>`;
        }).join('')}</div>` : '<p>Nenhum produto favoritado.</p>'}
      </div>
      <div class="perfil-card"><h2 class="perfil-card__title">Alertas de reposição</h2>
        ${alerts.length ? alerts.map((alert) => `<div class="pedido-conta-card__meta"><span>${safeText(alert.produto_nome)}${alert.tamanho ? ` · ${safeText(alert.tamanho)}` : ''}${alert.cor ? ` · ${safeText(alert.cor)}` : ''}</span><span>${safeText(alert.status)}</span><button class="btn btn--outline btn--sm" data-cancel-alert="${Number(alert.id)}">Cancelar</button></div>`).join('') : '<p>Nenhum alerta ativo.</p>'}
      </div>`;
    content.querySelectorAll('[data-remove-favorite]').forEach((button) => button.addEventListener('click', async () => {
      await api.delete(`/recursos/favoritos/${button.dataset.removeFavorite}`);
      renderFavoritosTab();
    }));
    content.querySelectorAll('[data-cancel-alert]').forEach((button) => button.addEventListener('click', async () => {
      await api.delete(`/recursos/alertas-reposicao/${button.dataset.cancelAlert}`);
      renderFavoritosTab();
    }));
  } catch (error) {
    content.innerHTML = `<p style="color:var(--danger)">${safeText(error.message)}</p>`;
  }
}

async function renderTrocasTab() {
  const content = document.getElementById('contaTabContent');
  content.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  try {
    const [orders, requests] = await Promise.all([api.get('/pedidos/meus'), api.get('/recursos/trocas')]);
    const eligibleOrders = orders.filter((order) => ['enviado', 'entregue'].includes(order.status));
    content.innerHTML = `
      <div class="perfil-card"><h2 class="perfil-card__title">Iniciar troca ou devolução</h2>
        ${eligibleOrders.length ? `<form id="returnRequestForm">
          <div class="co-form-group"><label>Pedido</label><select id="returnOrderId">${eligibleOrders.map((order) => `<option value="${Number(order.id)}">Pedido #${Number(order.id)}</option>`).join('')}</select></div>
          <div class="co-form-group"><label>Tipo</label><select id="returnType"><option value="troca">Troca</option><option value="devolucao">Devolução</option></select></div>
          <div id="returnItems"></div>
          <div class="co-form-group"><label>Motivo</label><textarea id="returnReason" minlength="20" maxlength="2000" rows="4" required></textarea></div>
          <button class="btn btn--primary" type="submit">Enviar solicitação</button>
        </form>` : '<p>Nenhum pedido está elegível no momento. Solicitações ficam disponíveis após o envio.</p>'}
      </div>
      <div class="perfil-card"><h2 class="perfil-card__title">Minhas solicitações</h2>
        ${requests.length ? requests.map((request) => `<div class="pedido-conta-card"><strong>#${Number(request.id)} · Pedido #${Number(request.pedido_id)}</strong><p>${safeText(request.tipo)} — ${safeText(request.status)}</p><p>${safeText(request.motivo)}</p>${request.resposta_admin ? `<p><strong>Resposta:</strong> ${safeText(request.resposta_admin)}</p>` : ''}</div>`).join('') : '<p>Nenhuma solicitação registrada.</p>'}
      </div>`;

    const orderSelect = document.getElementById('returnOrderId');
    const renderItems = () => {
      const order = eligibleOrders.find((item) => String(item.id) === orderSelect?.value);
      const wrap = document.getElementById('returnItems');
      if (!wrap || !order) return;
      wrap.innerHTML = `<label>Itens</label>${order.itens.map((item) => `<label class="produto-check"><input type="checkbox" name="returnItem" value="${Number(item.id)}" /><span>${safeText(item.nome)} · ${safeText(item.tamanho || '')}</span></label>`).join('')}`;
    };
    orderSelect?.addEventListener('change', renderItems);
    renderItems();
    document.getElementById('returnRequestForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const itens = Array.from(document.querySelectorAll('input[name="returnItem"]:checked')).map((input) => Number(input.value));
      if (!itens.length) return showToast('Selecione ao menos um item.', 'error');
      try {
        const result = await api.post('/recursos/trocas', {
          pedidoId: Number(orderSelect.value),
          tipo: document.getElementById('returnType').value,
          motivo: document.getElementById('returnReason').value.trim(),
          itens,
        });
        showToast(result.message);
        renderTrocasTab();
      } catch (error) { showToast(error.message, 'error'); }
    });
  } catch (error) {
    content.innerHTML = `<p style="color:var(--danger)">${safeText(error.message)}</p>`;
  }
}

// ── Aba Perfil ────────────────────────────────────────────────────────────

async function renderPerfilTab() {
  const content = document.getElementById('contaTabContent');
  content.innerHTML = `<div class="loading-state" style="padding:3rem 0"><div class="spinner"></div></div>`;

  // Busca perfil completo (inclui endereço)
  let perfil = contaUser;
  try {
    perfil = await api.get('/auth/perfil');
  } catch(e) { /* usa dados do localStorage */ }

  content.innerHTML = `
    <div class="perfil-section">
      <div class="perfil-card">
        <h2 class="perfil-card__title">Informações da Conta</h2>
        <div class="co-form-row">
          <div class="co-form-group">
            <label>Nome completo</label>
            <input type="text" id="perfilNome" value="${safeAttr(perfil.nome)}" />
          </div>
          <div class="co-form-group">
            <label>E-mail (não editável)</label>
            <input type="email" value="${safeAttr(perfil.email)}" disabled />
          </div>
        </div>
        <p id="perfilNomeMsg" class="perfil-msg" style="display:none"></p>
        <button class="btn btn--primary btn--sm" id="btnSalvarNome">Salvar alterações</button>
      </div>

      <div class="perfil-card">
        <h2 class="perfil-card__title">Endereço de Entrega</h2>
        <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:1rem">
          Seu endereço padrão será preenchido automaticamente no checkout.
        </p>
        <div class="co-form-row">
          <div class="co-form-group" style="flex:2">
            <label>Rua, Número e Bairro *</label>
            <input type="text" id="endRua" placeholder="Rua das Flores, 123, Centro"
              value="${safeAttr(perfil.endereco_rua || '')}" />
          </div>
          <div class="co-form-group">
            <label>CEP *</label>
            <input type="text" id="endCep" placeholder="00000-000" maxlength="9"
              value="${safeAttr(perfil.cep || '')}" />
          </div>
        </div>
        <div class="co-form-row">
          <div class="co-form-group">
            <label>Cidade / Estado *</label>
            <input type="text" id="endCidade" placeholder="Porto Alegre / RS"
              value="${safeAttr(perfil.cidade || '')}" />
          </div>
          <div class="co-form-group">
            <label>Telefone</label>
            <input type="tel" id="endTelefone" placeholder="(54) 99999-9999"
              value="${safeAttr(perfil.telefone || '')}" />
          </div>
        </div>
        <p id="endMsg" class="perfil-msg" style="display:none"></p>
        <button class="btn btn--primary btn--sm" id="btnSalvarEndereco">Salvar endereço</button>
      </div>

      <div class="perfil-card">
        <h2 class="perfil-card__title">Alterar Senha</h2>
        <div class="co-form-row">
          <div class="co-form-group">
            <label>Senha atual</label>
            <input type="password" id="senhaAtual" placeholder="••••••••" />
          </div>
          <div class="co-form-group">
            <label>Nova senha</label>
            <input type="password" id="novaSenha" placeholder="Mín. 8 caracteres, com letras e números" />
          </div>
        </div>
        <p id="senhaMsg" class="perfil-msg" style="display:none"></p>
        <button class="btn btn--outline btn--sm" id="btnAlterarSenha">Alterar Senha</button>
      </div>
    </div>
  `;

  document.getElementById('btnSalvarNome').addEventListener('click', async () => {
    const nome = document.getElementById('perfilNome').value.trim();
    const msg = document.getElementById('perfilNomeMsg');
    if (!nome) { showToast('Informe o nome.', 'error'); return; }
    const btn = document.getElementById('btnSalvarNome');
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      const res = await api.put('/auth/perfil', { nome });
      const user = JSON.parse(localStorage.getItem('fc_user') || '{}');
      user.nome = res.user.nome;
      localStorage.setItem('fc_user', JSON.stringify(user));
      contaUser = user;
      // Atualiza header
      const headerNome = document.querySelector('.conta-header__nome');
      const avatar = document.querySelector('.conta-avatar');
      if (headerNome) headerNome.textContent = user.nome;
      if (avatar) avatar.textContent = user.nome.charAt(0).toUpperCase();
      showToast('Nome atualizado com sucesso! ');
    } catch (e) {
      showToast(e.message, 'error');
    }
    btn.disabled = false; btn.textContent = 'Salvar alterações';
  });

  const endCepInput = document.getElementById('endCep');
  endCepInput?.addEventListener('input', (e) => { e.target.value = maskCep(e.target.value); });
  endCepInput?.addEventListener('blur', async (e) => {
    const data = await buscarCep(e.target.value);
    if (!data) return;
    const ruaEl = document.getElementById('endRua');
    const cidadeEl = document.getElementById('endCidade');
    if (ruaEl && !ruaEl.value.trim()) {
      ruaEl.value = [data.logradouro, data.bairro].filter(Boolean).join(', ');
    }
    if (cidadeEl && !cidadeEl.value.trim()) {
      cidadeEl.value = `${data.localidade} / ${data.uf}`;
    }
  });

  document.getElementById('btnSalvarEndereco').addEventListener('click', async () => {
    const rua     = document.getElementById('endRua').value.trim();
    const cep     = document.getElementById('endCep').value.trim();
    const cidade  = document.getElementById('endCidade').value.trim();
    const telefone = document.getElementById('endTelefone').value.trim();
    if (!rua || !cep || !cidade) { showToast('Preencha rua, CEP e cidade.', 'error'); return; }
    const btn = document.getElementById('btnSalvarEndereco');
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      await api.put('/auth/perfil', { endereco_rua: rua, cidade, cep, telefone });
      // Persiste no localStorage para o checkout usar
      const user = JSON.parse(localStorage.getItem('fc_user') || '{}');
      Object.assign(user, { endereco_rua: rua, cidade, cep, telefone });
      localStorage.setItem('fc_user', JSON.stringify(user));
      contaUser = user;
      showToast('Endereço salvo com sucesso! ');
    } catch(e) {
      showToast(e.message, 'error');
    }
    btn.disabled = false; btn.textContent = 'Salvar endereço';
  });

  document.getElementById('btnAlterarSenha').addEventListener('click', async () => {
    const senhaAtual = document.getElementById('senhaAtual').value;
    const novaSenha  = document.getElementById('novaSenha').value;
    if (!senhaAtual || !novaSenha) { showToast('Preencha os dois campos de senha.', 'error'); return; }
    const erroSenha = erroSenhaFraca(novaSenha);
    if (erroSenha) { showToast(erroSenha, 'error'); return; }
    const btn = document.getElementById('btnAlterarSenha');
    btn.disabled = true; btn.textContent = 'Alterando...';
    try {
      await api.put('/auth/perfil', { senhaAtual, novaSenha });
      document.getElementById('senhaAtual').value = '';
      document.getElementById('novaSenha').value = '';
      showToast('Senha alterada com sucesso! ');
    } catch (e) {
      showToast(e.message, 'error');
    }
    btn.disabled = false; btn.textContent = 'Alterar Senha';
  });
}

// ── Tela de Login / Cadastro ──────────────────────────────────────────────

function renderContaLogin() {
  const content = document.getElementById('contaContent');
  content.innerHTML = `
    <div class="conta-login">
      <div class="conta-login__card">
        <div class="conta-login__logo">
          <span></span>
          <h1>Minha Conta</h1>
          <p>Entre para acompanhar seus pedidos</p>
        </div>
        <div class="auth-tabs">
          <button class="auth-tab active" id="tabLogin">Entrar</button>
          <button class="auth-tab" id="tabRegister">Criar Conta</button>
        </div>
        <div id="loginForm" class="auth-form">
          <label>E-mail</label>
          <input type="email" id="loginEmail" placeholder="seu@email.com" />
          <label>Senha</label>
          <input type="password" id="loginSenha" placeholder="••••••••" />
          <a href="recuperar-senha.html" style="align-self:flex-end;font-size:.85rem">Esqueci minha senha</a>
          <p id="loginError" class="auth-error" style="display:none"></p>
          <button class="btn btn--primary" id="btnLoginSubmit">Entrar</button>
        </div>
        <div id="registerForm" class="auth-form" style="display:none">
          <label>Nome completo</label>
          <input type="text" id="regNome" placeholder="Seu nome" />
          <label>E-mail</label>
          <input type="email" id="regEmail" placeholder="seu@email.com" />
          <label>CPF</label>
          <input type="text" id="regCpf" placeholder="000.000.000-00" maxlength="14" />
          <label>Telefone</label>
          <input type="tel" id="regTelefone" placeholder="(00) 99999-9999" maxlength="15" />
          <label>Senha</label>
          <input type="password" id="regSenha" placeholder="Mín. 8 caracteres, com letras e números" />
          <label>Confirmar senha</label>
          <input type="password" id="regSenhaConf" placeholder="Repita a senha" />
          <p id="regError" class="auth-error" style="display:none"></p>
          <button class="btn btn--primary" id="btnRegSubmit">Criar Conta</button>
        </div>
      </div>
    </div>
  `;

  const showLogin = () => {
    document.getElementById('tabLogin').classList.add('active');
    document.getElementById('tabRegister').classList.remove('active');
    document.getElementById('loginForm').style.display = 'flex';
    document.getElementById('registerForm').style.display = 'none';
  };
  const showReg = () => {
    document.getElementById('tabRegister').classList.add('active');
    document.getElementById('tabLogin').classList.remove('active');
    document.getElementById('registerForm').style.display = 'flex';
    document.getElementById('loginForm').style.display = 'none';
  };

  document.getElementById('tabLogin').addEventListener('click', showLogin);
  document.getElementById('tabRegister').addEventListener('click', showReg);

  document.getElementById('loginSenha').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('btnLoginSubmit').addEventListener('click', doLogin);
  document.getElementById('btnRegSubmit').addEventListener('click', doRegister);

  document.getElementById('regCpf').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{0,3})/, '$1.$2');
    e.target.value = v;
  });

  document.getElementById('regTelefone').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 6) v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    else if (v.length > 2) v = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    e.target.value = v;
  });
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const senha = document.getElementById('loginSenha').value;
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';
  const btn = document.getElementById('btnLoginSubmit');
  btn.disabled = true; btn.textContent = 'Entrando...';
  try {
    const data = await api.post('/auth/login', { email, senha });
    localStorage.removeItem('fc_token');
    localStorage.setItem('fc_user', JSON.stringify(data.user));
    showToast(`Bem-vindo, ${data.user.nome.split(' ')[0]}! `);
    contaTab = 'pedidos';
    renderContaPage();
  } catch (e) {
    if (e.code === 'EMAIL_NOT_VERIFIED') {
      showToast('Confirme seu e-mail para entrar.', 'error');
      renderContaVerification(email);
      return;
    }
    errEl.textContent = e.message;
    errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Entrar';
  }
}

async function doRegister() {
  const nome      = document.getElementById('regNome').value.trim();
  const email     = document.getElementById('regEmail').value.trim();
  const cpf       = document.getElementById('regCpf').value.trim();
  const telefone  = document.getElementById('regTelefone').value.trim();
  const senha     = document.getElementById('regSenha').value;
  const senhaConf = document.getElementById('regSenhaConf').value;
  const errEl = document.getElementById('regError');
  errEl.style.display = 'none';

  if (senha !== senhaConf) {
    errEl.textContent = 'As senhas não coincidem.';
    errEl.style.display = 'block';
    return;
  }
  const erroSenha = erroSenhaFraca(senha);
  if (erroSenha) {
    errEl.textContent = erroSenha;
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('btnRegSubmit');
  btn.disabled = true; btn.textContent = 'Criando...';
  try {
    const res = await api.post('/auth/register', { nome, email, senha, cpf, telefone });
    showToast('Conta criada! Enviamos um código para seu e-mail.');
    renderContaVerification(email);
  } catch (e) {
    if (e.code === 'EMAIL_SEND_FAILED') {
      showToast('Conta criada, mas o envio falhou. Use “Reenviar código” para tentar novamente.', 'error');
      renderContaVerification(email);
      return;
    }
    errEl.textContent = e.message;
    errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Criar Conta';
  }
}

function renderContaVerification(email) {
  const content = document.getElementById('contaContent');
  content.innerHTML = `
    <div class="conta-login">
      <div class="conta-login__card">
        <div class="auth-tabs">
          <button class="auth-tab active" disabled>Confirme seu e-mail</button>
        </div>
        <div class="auth-form" style="display:flex">
          <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:.5rem">
            Enviamos um código de 6 dígitos para <strong id="contaVerifEmail"></strong>. Confira sua caixa de entrada (e o spam).
          </p>
          <label>Código de verificação</label>
          <input type="text" id="verifCodigo" placeholder="000000" maxlength="6" inputmode="numeric" style="letter-spacing:6px;font-size:1.2rem;text-align:center" />
          <p id="verifError" class="auth-error" style="display:none"></p>
          <button class="btn btn--primary" id="btnVerifSubmit">Confirmar código</button>
          <button class="btn btn--outline" id="btnVerifReenviar" style="margin-top:.5rem">Reenviar código</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('contaVerifEmail').textContent = email;

  document.getElementById('verifCodigo')?.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  });
  document.getElementById('verifCodigo')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btnVerifSubmit').click();
  });

  document.getElementById('btnVerifSubmit').addEventListener('click', async () => {
    const codigo = document.getElementById('verifCodigo').value.trim();
    const errEl = document.getElementById('verifError');
    if (codigo.length !== 6) {
      errEl.textContent = 'Informe os 6 dígitos do código.';
      errEl.style.display = 'block';
      return;
    }
    try {
      const data = await api.post('/auth/verificar-email', { email, codigo });
      localStorage.removeItem('fc_token');
      localStorage.setItem('fc_user', JSON.stringify(data.user));
      showToast(`E-mail confirmado! Bem-vindo, ${data.user.nome.split(' ')[0]}!`);
      contaTab = 'pedidos';
      renderContaPage();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.style.display = 'block';
    }
  });

  document.getElementById('btnVerifReenviar').addEventListener('click', async () => {
    const btn = document.getElementById('btnVerifReenviar');
    btn.disabled = true; btn.textContent = 'Enviando...';
    try {
      const result = await api.post('/auth/reenviar-codigo', { email });
      showToast('Código reenviado para seu e-mail.');
      startVerificationResendCooldown(btn, result.resendCooldownSeconds);
    } catch (e) {
      showToast(e.message, 'error');
      btn.disabled = false; btn.textContent = 'Reenviar código';
    }
  });
}

// ── Init ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  renderContaPage();
});
