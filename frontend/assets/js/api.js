const API_BASE = 'http://localhost:3001/api';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('fc_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('fc_token');
      localStorage.removeItem('fc_user');
      // Na página admin: mostra o painel de login restrito
      const loginRequired = document.getElementById('loginRequired');
      if (loginRequired) {
        loginRequired.style.display = 'flex';
        throw new Error('Sessão expirada. Faça login novamente.');
      }
    }
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

const api = {
  get:    (path)         => apiFetch(path),
  post:   (path, body)   => apiFetch(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (path, body)   => apiFetch(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: (path)         => apiFetch(path, { method: 'DELETE' }),
};

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

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function normalizeText(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ── Theme ──────────────────────────────────────────────────────────────────
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
