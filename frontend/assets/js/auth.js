function getCurrentUser() {
  const raw = localStorage.getItem('fc_user');
  return raw ? JSON.parse(raw) : null;
}

function setSession(token, user) {
  localStorage.setItem('fc_token', token);
  localStorage.setItem('fc_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('fc_token');
  localStorage.removeItem('fc_user');
}

function updateUserUI() {
  const user = getCurrentUser();
  const display = document.getElementById('userNameDisplay');
  if (display) {
    display.textContent = user ? `Olá, ${user.nome.split(' ')[0]}` : '';
  }
}

function openAuthModal(defaultTab = 'login') {
  const overlay = document.getElementById('authOverlay');
  const content = document.getElementById('authContent');
  if (!overlay || !content) return;

  content.innerHTML = `
    <div class="auth-tabs">
      <button class="auth-tab ${defaultTab === 'login' ? 'active' : ''}" id="tabLogin">Entrar</button>
      <button class="auth-tab ${defaultTab === 'register' ? 'active' : ''}" id="tabRegister">Criar Conta</button>
    </div>
    <div id="loginForm" class="auth-form" style="display:${defaultTab === 'login' ? 'flex' : 'none'}">
      <label>E-mail</label>
      <input type="email" id="loginEmail" placeholder="seu@email.com" />
      <label>Senha</label>
      <input type="password" id="loginSenha" placeholder="••••••••" />
      <p id="loginError" class="auth-error" style="display:none"></p>
      <button class="btn btn--primary" id="btnLoginSubmit">Entrar</button>
      <p class="auth-link">Admin padrão: admin@fanaticosfc.com / admin123</p>
    </div>
    <div id="registerForm" class="auth-form" style="display:${defaultTab === 'register' ? 'flex' : 'none'}">
      <label>Nome</label>
      <input type="text" id="regNome" placeholder="Seu nome" />
      <label>E-mail</label>
      <input type="email" id="regEmail" placeholder="seu@email.com" />
      <label>Senha</label>
      <input type="password" id="regSenha" placeholder="Mínimo 6 caracteres" />
      <p id="regError" class="auth-error" style="display:none"></p>
      <button class="btn btn--primary" id="btnRegSubmit">Criar Conta</button>
    </div>
  `;

  overlay.style.display = 'flex';

  document.getElementById('tabLogin').addEventListener('click', () => {
    document.getElementById('tabLogin').classList.add('active');
    document.getElementById('tabRegister').classList.remove('active');
    document.getElementById('loginForm').style.display = 'flex';
    document.getElementById('registerForm').style.display = 'none';
  });
  document.getElementById('tabRegister').addEventListener('click', () => {
    document.getElementById('tabRegister').classList.add('active');
    document.getElementById('tabLogin').classList.remove('active');
    document.getElementById('registerForm').style.display = 'flex';
    document.getElementById('loginForm').style.display = 'none';
  });

  document.getElementById('btnLoginSubmit').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value;
    const errEl = document.getElementById('loginError');
    try {
      const data = await api.post('/auth/login', { email, senha });
      setSession(data.token, data.user);
      updateUserUI();
      closeAuthModal();
      showToast(`Bem-vindo, ${data.user.nome.split(' ')[0]}! 👋`);
      if (data.user.perfil === 'admin') {
        const inPages = window.location.pathname.includes('/pages/');
        if (confirm('Você entrou como admin. Ir para o Painel Administrativo?')) {
          window.location.href = inPages ? 'admin.html' : 'pages/admin.html';
        }
      }
    } catch (e) {
      errEl.textContent = e.message;
      errEl.style.display = 'block';
    }
  });

  document.getElementById('btnRegSubmit').addEventListener('click', async () => {
    const nome = document.getElementById('regNome').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const senha = document.getElementById('regSenha').value;
    const errEl = document.getElementById('regError');
    try {
      await api.post('/auth/register', { nome, email, senha });
      showToast('Conta criada com sucesso! Faça login.');
      document.getElementById('tabLogin').click();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.style.display = 'block';
    }
  });

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const activeForm = document.getElementById('loginForm').style.display !== 'none'
        ? 'btnLoginSubmit' : 'btnRegSubmit';
      document.getElementById(activeForm)?.click();
    }
  });
}

function closeAuthModal() {
  const overlay = document.getElementById('authOverlay');
  if (overlay) overlay.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  updateUserUI();

  document.getElementById('btnUser')?.addEventListener('click', () => {
    const user = getCurrentUser();
    const inPages = window.location.pathname.includes('/pages/');
    const contaUrl = inPages ? 'conta.html' : 'pages/conta.html';
    if (user) {
      window.location.href = contaUrl;
    } else {
      openAuthModal('login');
    }
  });

  document.getElementById('btnCloseAuth')?.addEventListener('click', closeAuthModal);
  document.getElementById('authOverlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('authOverlay')) closeAuthModal();
  });
});
