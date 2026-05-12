// ── Página de Conta ───────────────────────────────────────────────────────

const STATUS_CONTA = {
  'pendente':             { label: 'Pedido Recebido',      icon: '📋', cor: '' },
  'aguardando_pagamento': { label: 'Aguardando Pagamento', icon: '⏳', cor: 'warning' },
  'pago':                 { label: 'Pagamento Confirmado', icon: '✅', cor: 'success' },
  'em_separacao':         { label: 'Em Separação',         icon: '📦', cor: 'info' },
  'enviado':              { label: 'Enviado / Em Trânsito',icon: '🚚', cor: 'info' },
  'entregue':             { label: 'Entregue',             icon: '🎉', cor: 'success' },
  'cancelado':            { label: 'Cancelado',            icon: '❌', cor: 'danger' },
};

let contaTab = 'pedidos';
let contaUser = null;

function getContaUser() {
  try { return JSON.parse(localStorage.getItem('fc_user') || 'null'); } catch { return null; }
}

// ── Render principal ──────────────────────────────────────────────────────

function renderContaPage() {
  contaUser = getContaUser();
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
        <div class="conta-avatar">${contaUser.nome.charAt(0).toUpperCase()}</div>
        <div>
          <h1 class="conta-header__nome">${contaUser.nome}</h1>
          <p class="conta-header__email">${contaUser.email}</p>
          ${contaUser.perfil === 'admin' ? '<span class="conta-badge-admin">Admin</span>' : ''}
        </div>
      </div>
      <div class="conta-header__actions">
        ${contaUser.perfil === 'admin' ? `<a href="admin.html" class="btn btn--outline btn--sm">⚙ Painel Admin</a>` : ''}
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
    </div>

    <div id="contaTabContent"></div>
  `;

  document.getElementById('btnContaLogout').addEventListener('click', () => {
    if (confirm('Deseja sair da sua conta?')) {
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
          <p style="font-size:3rem">📦</p>
          <p>Você ainda não fez nenhum pedido.</p>
          <a href="../index.html" class="btn btn--primary">Ver Catálogo</a>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div class="pedidos-conta-list">
        ${pedidos.map(pedido => {
          const info = STATUS_CONTA[pedido.status] || { label: pedido.status, icon: '📋', cor: '' };
          const data = new Date(pedido.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
          return `
            <div class="pedido-conta-card">
              <div class="pedido-conta-card__header">
                <div class="pedido-conta-card__id">
                  Pedido <strong>#${pedido.id}</strong>
                  <span class="pedido-conta-card__date">${data}</span>
                </div>
                <div class="pedido-conta-card__status status--${info.cor}">
                  ${info.icon} ${info.label}
                </div>
              </div>

              <div class="pedido-conta-card__meta">
                <span>${pedido.metodo_pagamento === 'pix' ? '🏦 PIX' : '💬 WhatsApp'}</span>
                ${pedido.endereco ? `<span>📦 ${pedido.endereco}</span>` : ''}
                <strong class="pedido-conta-card__total">${formatBRL(pedido.total)}</strong>
              </div>

              ${pedido.itens && pedido.itens.length > 0 ? `
                <div class="pedido-conta-card__itens">
                  ${pedido.itens.map(i => `
                    <div class="pedido-conta-card__item">
                      ${i.imagem
                        ? `<img src="${i.imagem}" alt="${i.nome}" />`
                        : `<div class="pedido-item-placeholder">⚽</div>`}
                      <div>
                        <div class="pedido-item-nome">${i.nome}</div>
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
                  <strong id="trackCode_${pedido.id}">${pedido.codigo_rastreio}</strong>
                  <button class="btn btn--outline btn--sm" data-copy="${pedido.id}">📋 Copiar</button>
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
        if (code) navigator.clipboard.writeText(code).then(() => showToast('Código copiado! 📋'));
      });
    });

  } catch (e) {
    content.innerHTML = `
      <div class="empty-state" style="padding:3rem 1rem">
        <p style="color:var(--danger)">${e.message}</p>
        <button class="btn btn--outline" onclick="renderPedidosTab()">Tentar novamente</button>
      </div>
    `;
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
            <input type="text" id="perfilNome" value="${perfil.nome}" />
          </div>
          <div class="co-form-group">
            <label>E-mail (não editável)</label>
            <input type="email" value="${perfil.email}" disabled />
          </div>
        </div>
        <p id="perfilNomeMsg" class="perfil-msg" style="display:none"></p>
        <button class="btn btn--primary btn--sm" id="btnSalvarNome">Salvar alterações</button>
      </div>

      <div class="perfil-card">
        <h2 class="perfil-card__title">📦 Endereço de Entrega</h2>
        <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:1rem">
          Seu endereço padrão será preenchido automaticamente no checkout.
        </p>
        <div class="co-form-row">
          <div class="co-form-group" style="flex:2">
            <label>Rua, Número e Bairro *</label>
            <input type="text" id="endRua" placeholder="Rua das Flores, 123, Centro"
              value="${perfil.endereco_rua || ''}" />
          </div>
          <div class="co-form-group">
            <label>CEP *</label>
            <input type="text" id="endCep" placeholder="00000-000" maxlength="9"
              value="${perfil.cep || ''}" />
          </div>
        </div>
        <div class="co-form-row">
          <div class="co-form-group">
            <label>Cidade / Estado *</label>
            <input type="text" id="endCidade" placeholder="Porto Alegre / RS"
              value="${perfil.cidade || ''}" />
          </div>
          <div class="co-form-group">
            <label>WhatsApp / Telefone</label>
            <input type="tel" id="endTelefone" placeholder="(54) 99999-9999"
              value="${perfil.telefone || ''}" />
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
            <input type="password" id="novaSenha" placeholder="Mínimo 6 caracteres" />
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
      showToast('Nome atualizado com sucesso! ✅');
    } catch (e) {
      showToast(e.message, 'error');
    }
    btn.disabled = false; btn.textContent = 'Salvar alterações';
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
      showToast('Endereço salvo com sucesso! 📦');
    } catch(e) {
      showToast(e.message, 'error');
    }
    btn.disabled = false; btn.textContent = 'Salvar endereço';
  });

  document.getElementById('btnAlterarSenha').addEventListener('click', async () => {
    const senhaAtual = document.getElementById('senhaAtual').value;
    const novaSenha  = document.getElementById('novaSenha').value;
    if (!senhaAtual || !novaSenha) { showToast('Preencha os dois campos de senha.', 'error'); return; }
    if (novaSenha.length < 6) { showToast('A nova senha deve ter pelo menos 6 caracteres.', 'error'); return; }
    const btn = document.getElementById('btnAlterarSenha');
    btn.disabled = true; btn.textContent = 'Alterando...';
    try {
      await api.put('/auth/perfil', { senhaAtual, novaSenha });
      document.getElementById('senhaAtual').value = '';
      document.getElementById('novaSenha').value = '';
      showToast('Senha alterada com sucesso! ✅');
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
          <span>⚽</span>
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
          <p id="loginError" class="auth-error" style="display:none"></p>
          <button class="btn btn--primary" id="btnLoginSubmit">Entrar</button>
        </div>
        <div id="registerForm" class="auth-form" style="display:none">
          <label>Nome completo</label>
          <input type="text" id="regNome" placeholder="Seu nome" />
          <label>E-mail</label>
          <input type="email" id="regEmail" placeholder="seu@email.com" />
          <label>Senha</label>
          <input type="password" id="regSenha" placeholder="Mínimo 6 caracteres" />
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
    localStorage.setItem('fc_token', data.token);
    localStorage.setItem('fc_user', JSON.stringify(data.user));
    showToast(`Bem-vindo, ${data.user.nome.split(' ')[0]}! 👋`);
    contaTab = 'pedidos';
    renderContaPage();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Entrar';
  }
}

async function doRegister() {
  const nome  = document.getElementById('regNome').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const senha = document.getElementById('regSenha').value;
  const errEl = document.getElementById('regError');
  errEl.style.display = 'none';
  const btn = document.getElementById('btnRegSubmit');
  btn.disabled = true; btn.textContent = 'Criando...';
  try {
    await api.post('/auth/register', { nome, email, senha });
    const data = await api.post('/auth/login', { email, senha });
    localStorage.setItem('fc_token', data.token);
    localStorage.setItem('fc_user', JSON.stringify(data.user));
    showToast('Conta criada com sucesso! 🎉');
    contaTab = 'pedidos';
    renderContaPage();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Criar Conta';
  }
}

// ── Init ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  renderContaPage();
});
