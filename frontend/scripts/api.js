// Em produção, /api é encaminhado pelo Vercel ao Render para manter a sessão
// HttpOnly no mesmo site. FANATICOS_API_BASE pode substituir isso em staging.
const IS_LOCAL_FRONTEND = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const DEFAULT_API_BASE = IS_LOCAL_FRONTEND
  ? 'http://localhost:3001/api'
  : (window.location.protocol === 'file:' ? 'https://fanaticos-fc.onrender.com/api' : '/api');
const API_BASE = window.FANATICOS_API_BASE || DEFAULT_API_BASE;
let STRIPE_PUBLISHABLE_KEY = window.FANATICOS_STRIPE_PUBLISHABLE || '';

// Remove tokens legados assim que qualquer página carrega. Sessões antigas
// precisarão autenticar uma vez para receber o novo cookie HttpOnly.
localStorage.removeItem('fc_token');

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const method = String(options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers['X-CSRF-Protection'] = '1';
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    const sessionInvalid = res.status === 401
      || (res.status === 403 && ['ACCESS_DISABLED', 'AUTH_USER_NOT_FOUND'].includes(err.code));
    if (sessionInvalid) {
      localStorage.removeItem('fc_user');
      // Na página admin: mostra o painel de login restrito
      const loginRequired = document.getElementById('loginRequired');
      if (loginRequired) {
        loginRequired.style.display = 'flex';
        throw new Error('Sessão expirada. Faça login novamente.');
      }
    }
    const error = new Error(err.error || `HTTP ${res.status}`);
    error.code = err.code;
    error.status = res.status;
    error.details = err.details;
    throw error;
  }
  if (res.status === 204) return null;
  return res.json();
}

// Dados externos nunca devem ser interpolados crus em innerHTML. Use safeText
// para conteúdo, safeAttr para atributos e safeUrl para src/href.
function safeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeAttr(value) {
  return safeText(value).replace(/`/g, '&#96;');
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ''), window.location.origin);
    if (!['http:', 'https:', 'blob:'].includes(url.protocol)) return '';
    return safeAttr(url.href);
  } catch {
    return '';
  }
}

const api = {
  get:    (path)         => apiFetch(path),
  post:   (path, body)   => apiFetch(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (path, body)   => apiFetch(path, { method: 'PUT',    body: JSON.stringify(body) }),
  patch:  (path, body)   => apiFetch(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: (path, body)   => apiFetch(path, { method: 'DELETE', ...(body ? { body: JSON.stringify(body) } : {}) }),
};

// POST /cart vive na raiz da API (fora do prefixo /api), no formato exigido pelo PDF
const CART_ROOT_BASE = API_BASE.replace(/\/api\/?$/, '');

async function fetchCartSummary(items, cupomCode, uf) {
  const res = await fetch(`${CART_ROOT_BASE}/cart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ items, cupomCode, uf }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    const error = new Error(err.error || `HTTP ${res.status}`);
    error.code = err.code;
    throw error;
  }
  return res.json();
}

async function loadStripeConfig() {
  if (STRIPE_PUBLISHABLE_KEY) return STRIPE_PUBLISHABLE_KEY;
  try {
    const config = await api.get('/config');
    STRIPE_PUBLISHABLE_KEY = config.stripePublishableKey || '';
    return STRIPE_PUBLISHABLE_KEY;
  } catch (err) {
    return '';
  }
}

function showToast(msg, type = 'success') {
  let cont = document.querySelector('.toast-container');
  if (!cont) {
    cont = document.createElement('div');
    cont.className = 'toast-container';
    document.body.appendChild(cont);
  }
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.textContent = msg;
  cont.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function startVerificationResendCooldown(button, seconds = 60, label = 'Reenviar código') {
  let remaining = Math.max(1, Number(seconds) || 60);
  button.disabled = true;
  const update = () => {
    button.textContent = `${label} (${remaining}s)`;
    remaining -= 1;
    if (remaining < 0) {
      clearInterval(timer);
      button.disabled = false;
      button.textContent = label;
    }
  };
  const timer = setInterval(update, 1000);
  update();
}

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function normalizeText(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function analyticsSessionId() {
  let id = sessionStorage.getItem('fc_analytics_session');
  if (!id) {
    id = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem('fc_analytics_session', id);
  }
  return id;
}

async function trackCommerceEvent(evento, dados = {}) {
  if (localStorage.getItem('fc_privacy_consent') !== 'accepted') return false;
  try {
    const result = await api.post('/recursos/analytics/eventos', {
      sessionId: analyticsSessionId(), evento, dados,
    });
    return Boolean(result.recorded);
  } catch { return false; }
}

function renderPrivacyConsent() {
  if (localStorage.getItem('fc_privacy_consent')) return;
  const banner = document.createElement('section');
  banner.className = 'privacy-consent';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Preferências de privacidade');
  const paragraph = document.createElement('p');
  paragraph.textContent = 'Usamos dados essenciais para a loja funcionar. Você escolhe separadamente analytics e lembretes de carrinho; nenhum deles registra senha, CPF ou pagamento.';
  const preferences = document.createElement('div');
  preferences.className = 'privacy-consent__preferences';
  const analyticsLabel = document.createElement('label');
  const analyticsInput = document.createElement('input');
  analyticsInput.type = 'checkbox';
  analyticsLabel.append(analyticsInput, document.createTextNode(' Permitir analytics'));
  const marketingLabel = document.createElement('label');
  const marketingInput = document.createElement('input');
  marketingInput.type = 'checkbox';
  marketingLabel.append(marketingInput, document.createTextNode(' Receber lembrete de carrinho'));
  preferences.append(analyticsLabel, marketingLabel);
  const actions = document.createElement('div');
  const reject = document.createElement('button');
  reject.className = 'btn btn--outline btn--sm';
  reject.textContent = 'Somente essenciais';
  const accept = document.createElement('button');
  accept.className = 'btn btn--primary btn--sm';
  accept.textContent = 'Salvar preferências';
  actions.append(reject, accept);
  banner.append(paragraph, preferences, actions);
  document.body.appendChild(banner);

  const save = async (analytics, marketing) => {
    localStorage.setItem('fc_privacy_consent', analytics ? 'accepted' : 'essential');
    localStorage.setItem('fc_marketing_consent', marketing ? 'accepted' : 'declined');
    banner.remove();
    renderPrivacySettingsButton();
    await api.post('/recursos/privacidade/consentimento', {
      sessionId: analyticsSessionId(), analytics, marketing,
    }).catch(() => {});
    if (analytics) trackCommerceEvent('page_view', { path: window.location.pathname });
  };
  reject.addEventListener('click', () => save(false, false));
  accept.addEventListener('click', () => save(analyticsInput.checked, marketingInput.checked));
}

function renderPrivacySettingsButton() {
  if (document.querySelector('.privacy-settings') || !localStorage.getItem('fc_privacy_consent')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'privacy-settings';
  button.textContent = 'Privacidade';
  button.addEventListener('click', () => {
    localStorage.removeItem('fc_privacy_consent');
    localStorage.removeItem('fc_marketing_consent');
    button.remove();
    renderPrivacyConsent();
  });
  document.body.appendChild(button);
}

document.addEventListener('DOMContentLoaded', () => {
  renderPrivacyConsent();
  renderPrivacySettingsButton();
  if (localStorage.getItem('fc_privacy_consent') === 'accepted') {
    trackCommerceEvent('page_view', { path: window.location.pathname });
  }
});

// --- CEP (ViaCEP) -----------------------------------------------------------
async function buscarCep(cep) {
  const cleaned = String(cep || '').replace(/\D/g, '');
  if (cleaned.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return data; // { logradouro, bairro, localidade, uf, ... }
  } catch {
    return null;
  }
}

function maskCep(value) {
  return value.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d{0,3})/, '$1-$2').replace(/-$/, '');
}

// Mesma regra validada no backend (authService.js) — mín. 8 caracteres, letras e números.
function erroSenhaFraca(senha) {
  if (senha.length < 8) return 'A senha deve ter no mínimo 8 caracteres.';
  if (!/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) return 'A senha deve conter letras e números.';
  return null;
}

// --- CEP (ViaCEP) -----------------------------------------------------------
(function () {
  const saved = localStorage.getItem('fc_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('fc_theme', next);
  _updateThemeBtns();
}

function _updateThemeBtns() {
  const isDark = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark';
  const sunSvg  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  const moonSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  document.querySelectorAll('.btn-theme').forEach(btn => {
    btn.innerHTML  = isDark ? sunSvg : moonSvg;
    btn.title      = isDark ? 'Tema Claro' : 'Tema Escuro';
    btn.setAttribute('aria-label', isDark ? 'Ativar tema claro' : 'Ativar tema escuro');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  _updateThemeBtns();
  document.querySelectorAll('.btn-theme').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });
});
