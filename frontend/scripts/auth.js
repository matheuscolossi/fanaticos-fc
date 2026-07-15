function getCurrentUser() {
  try {
    const raw = localStorage.getItem('fc_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem('fc_user');
    return null;
  }
}

function setSession(user) {
  // O JWT fica exclusivamente no cookie HttpOnly emitido pelo backend.
  localStorage.removeItem('fc_token');
  localStorage.setItem('fc_user', JSON.stringify(user));
}

async function clearSession() {
  try { await api.post('/auth/logout', {}); } catch (_) {}
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
    </div>
    <div id="registerForm" class="auth-form" style="display:${defaultTab === 'register' ? 'flex' : 'none'}">
      <label>Nome completo</label>
      <input type="text" id="regNome" placeholder="Seu nome completo" />
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
      setSession(data.user);
      updateUserUI();
      closeAuthModal();
      showToast(`Bem-vindo, ${data.user.nome.split(' ')[0]}! `);
      if (data.user.perfil === 'admin') {
        const inPages = window.location.pathname.includes('/pages/');
        if (confirm('Você entrou como admin. Ir para o Painel Administrativo?')) {
          window.location.href = inPages ? 'admin.html' : 'pages/admin.html';
        }
      }
    } catch (e) {
      if (e.code === 'EMAIL_NOT_VERIFIED') {
        showToast('Confirme seu e-mail para entrar.', 'error');
        openVerificationStep(email);
        return;
      }
      errEl.textContent = e.message;
      errEl.style.display = 'block';
    }
  });

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

  document.getElementById('btnRegSubmit').addEventListener('click', async () => {
    const nome     = document.getElementById('regNome').value.trim();
    const email    = document.getElementById('regEmail').value.trim();
    const cpf      = document.getElementById('regCpf').value.trim();
    const telefone = document.getElementById('regTelefone').value.trim();
    const senha    = document.getElementById('regSenha').value;
    const senhaConf = document.getElementById('regSenhaConf').value;
    const errEl    = document.getElementById('regError');

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

    try {
      const res = await api.post('/auth/register', { nome, email, senha, cpf, telefone });
      showToast('Conta criada! Enviamos um código para seu e-mail.');
      openVerificationStep(email);
    } catch (e) {
      if (e.code === 'EMAIL_SEND_FAILED') {
        showToast('Conta criada, mas o envio falhou. Use “Reenviar código” para tentar novamente.', 'error');
        openVerificationStep(email);
        return;
      }
      errEl.textContent = e.message;
      errEl.style.display = 'block';
    }
  });

  overlay.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (document.getElementById('btnVerifSubmit')) {
      document.getElementById('btnVerifSubmit').click();
      return;
    }
    const activeForm = document.getElementById('loginForm').style.display !== 'none'
      ? 'btnLoginSubmit' : 'btnRegSubmit';
    document.getElementById(activeForm)?.click();
  });
}

function closeAuthModal() {
  const overlay = document.getElementById('authOverlay');
  if (overlay) overlay.style.display = 'none';
}

function openVerificationStep(email) {
  const content = document.getElementById('authContent');
  if (!content) return;

  content.innerHTML = `
    <div class="auth-tabs">
      <button class="auth-tab active" disabled>Confirme seu e-mail</button>
    </div>
    <div class="auth-form" style="display:flex">
      <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:.5rem">
        Enviamos um código de 6 dígitos para <strong id="verifEmail"></strong>. Confira sua caixa de entrada (e o spam).
      </p>
      <label>Código de verificação</label>
      <input type="text" id="verifCodigo" placeholder="000000" maxlength="6" inputmode="numeric" style="letter-spacing:6px;font-size:1.2rem;text-align:center" />
      <p id="verifError" class="auth-error" style="display:none"></p>
      <button class="btn btn--primary" id="btnVerifSubmit">Confirmar código</button>
      <button class="btn btn--outline" id="btnVerifReenviar" style="margin-top:.5rem">Reenviar código</button>
    </div>
  `;

  document.getElementById('verifEmail').textContent = email;

  document.getElementById('verifCodigo')?.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
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
      setSession(data.user);
      updateUserUI();
      closeAuthModal();
      showToast(`E-mail confirmado! Bem-vindo, ${data.user.nome.split(' ')[0]}!`);
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
