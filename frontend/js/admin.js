const ITEMS_PER_PAGE = 15;
let allProdutosAdmin = [];
let filteredProdutos = [];
let currentPage = 1;
let deleteTargetId = null;
let categoriasAdmin = [];
let editingImages = [];

function checkAdminAuth() {
  const token = localStorage.getItem('fc_token');
  const user  = JSON.parse(localStorage.getItem('fc_user') || 'null');
  if (!token || !user || user.perfil !== 'admin') {
    document.getElementById('loginRequired').style.display = 'flex';
    return false;
  }
  document.getElementById('loginRequired').style.display = 'none';
  document.getElementById('adminUserName').textContent = `👤 ${user.nome}`;
  return true;
}

function setTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sidebar__link[data-tab]').forEach(l => l.classList.remove('active'));
  document.getElementById(`tab${capitalize(name)}`)?.classList.add('active');
  document.querySelector(`.sidebar__link[data-tab="${name}"]`)?.classList.add('active');

  const titles = {
    produtos: ['Gerenciar Produtos', 'Cadastre, edite e remova produtos do catálogo'],
    pedidos:  ['Pedidos Recebidos',  'Visualize todos os pedidos finalizados via WhatsApp'],
    usuarios: ['Usuários Cadastrados','Gerencie as contas de usuários'],
  };
  document.getElementById('adminTabTitle').textContent = titles[name][0];
  document.getElementById('adminTabSub').textContent   = titles[name][1];

  if (name === 'pedidos')  loadPedidos();
  if (name === 'usuarios') loadUsuarios();
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

async function loadProdutosAdmin() {
  try {
    allProdutosAdmin = await api.get('/produtos');
    filteredProdutos = [...allProdutosAdmin];
    currentPage = 1;
    renderTabelaProdutos();
  } catch(e) {
    document.getElementById('tabelaProdutosWrap').innerHTML =
      `<div class="loading-state" style="color:var(--danger)">⚠️ Erro ao carregar produtos. Backend rodando?</div>`;
  }
}

function renderTabelaProdutos() {
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const page  = filteredProdutos.slice(start, start + ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredProdutos.length / ITEMS_PER_PAGE);
  const wrap  = document.getElementById('tabelaProdutosWrap');
  const pag   = document.getElementById('paginacaoProdutos');

  if (filteredProdutos.length === 0) {
    wrap.innerHTML = '<div class="loading-state">Nenhum produto encontrado.</div>';
    if (pag) pag.style.display = 'none';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Foto</th>
          <th>Nome</th>
          <th>Categoria</th>
          <th>Preço</th>
          <th>Estoque</th>
          <th>Destaque</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${page.map(p => {
          const img = (p.imagens || [])[0];
          return `
          <tr>
            <td>
              <div class="td-img">
                ${img
                  ? `<img src="${img}" alt="${p.nome}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="td-img-placeholder" style="display:none">⚽</div>`
                  : `<div class="td-img-placeholder">⚽</div>`}
              </div>
            </td>
            <td><span class="td-nome" title="${p.nome}">${p.nome}</span></td>
            <td><span class="td-cat">${p.categoria_nome || '—'}</span></td>
            <td><span class="td-preco">${formatBRL(p.preco)}</span></td>
            <td>${p.estoque}</td>
            <td>
              <span class="td-badge ${p.destaque ? '' : 'td-badge--off'}">
                ${p.destaque ? '🔥 Sim' : 'Não'}
              </span>
            </td>
            <td>
              <div class="td-actions">
                <button class="btn btn--outline btn--sm" onclick="openEditModal(${p.id})">✏️ Editar</button>
                <button class="btn btn--danger btn--sm"  onclick="confirmDelete(${p.id})">🗑️</button>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;

  if (pag) {
    if (totalPages > 1) {
      pag.style.display = 'flex';
      document.getElementById('paginaInfo').textContent =
        `Página ${currentPage} de ${totalPages} (${filteredProdutos.length} produtos)`;
      document.getElementById('btnAnterior').disabled = currentPage === 1;
      document.getElementById('btnProximo').disabled  = currentPage === totalPages;
    } else {
      pag.style.display = 'none';
    }
  }
}

async function loadCategoriasAdmin() {
  try {
    categoriasAdmin = await api.get('/categorias');
    const sel = document.getElementById('pCategoria');
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione...</option>';
    categoriasAdmin.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.nome;
      sel.appendChild(opt);
    });
  } catch(e) {}
}

function openNewModal() {
  editingImages = [];
  document.getElementById('produtoId').value = '';
  document.getElementById('pNome').value = '';
  document.getElementById('pPreco').value = '149.90';
  document.getElementById('pCategoria').value = '';
  document.getElementById('pEstoque').value = '';
  document.getElementById('pDescricao').value = '';
  document.getElementById('pDestaque').checked = false;
  document.getElementById('imagePreview').innerHTML = '';
  document.getElementById('modalFormTitle').textContent = 'Novo Produto';
  document.getElementById('modalOverlay').style.display = 'flex';
}

async function openEditModal(id) {
  try {
    const p = await api.get(`/produtos/${id}`);
    editingImages = [...(p.imagens || [])];
    document.getElementById('produtoId').value   = p.id;
    document.getElementById('pNome').value       = p.nome;
    document.getElementById('pPreco').value      = p.preco;
    document.getElementById('pCategoria').value  = p.categoria_id || '';
    document.getElementById('pEstoque').value    = p.estoque;
    document.getElementById('pDescricao').value  = p.descricao || '';
    document.getElementById('pDestaque').checked = !!p.destaque;
    document.getElementById('modalFormTitle').textContent = 'Editar Produto';
    renderImagePreview();
    document.getElementById('modalOverlay').style.display = 'flex';
  } catch(e) {
    showToast('Erro ao carregar produto.', 'error');
  }
}

function closeFormModal() {
  document.getElementById('modalOverlay').style.display = 'none';
  editingImages = [];
}

function renderImagePreview() {
  const preview = document.getElementById('imagePreview');
  if (!preview) return;
  if (editingImages.length === 0) {
    preview.innerHTML = '';
    return;
  }
  preview.innerHTML = editingImages.map((img, i) => {
    const isUrl = img.startsWith('http') && !img.startsWith('data:');
    return `
    <div class="preview-img" onclick="removePreviewImg(${i})" title="${isUrl ? img : 'Upload'}">
      <img src="${img}" alt="Foto ${i+1}" onerror="this.parentElement.querySelector('.preview-img__err').style.display='flex'" />
      <div class="preview-img__err" style="display:none;position:absolute;inset:0;background:var(--bg-card2);align-items:center;justify-content:center;font-size:.65rem;color:var(--text-muted);text-align:center;padding:.2rem">Erro ao carregar</div>
      <div class="preview-img__remove">🗑️</div>
      ${isUrl ? '<div class="preview-img__badge">URL</div>' : '<div class="preview-img__badge preview-img__badge--up">UP</div>'}
    </div>
  `}).join('');
}

function removePreviewImg(index) {
  editingImages.splice(index, 1);
  renderImagePreview();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnAddUrl')?.addEventListener('click', addImageUrl);
  document.getElementById('pImagemUrl')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addImageUrl(); }
  });

  document.getElementById('pImagens')?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files).slice(0, 4 - editingImages.length);
    for (const file of files) {
      const b64 = await fileToBase64(file);
      editingImages.push(b64);
    }
    renderImagePreview();
    e.target.value = '';
  });
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const raw = new Image();
      raw.onerror = reject;
      raw.onload = () => {
        const MAX = 800;
        let w = raw.width, h = raw.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(raw, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      raw.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function addImageUrl() {
  const input = document.getElementById('pImagemUrl');
  const url = input?.value.trim();
  if (!url) return;
  if (!url.startsWith('http')) { showToast('URL inválida. Deve começar com http.', 'error'); return; }
  if (editingImages.length >= 4) { showToast('Máximo 4 imagens por produto.', 'error'); return; }
  editingImages.push(url);
  input.value = '';
  renderImagePreview();
}

async function saveProduto(e) {
  e.preventDefault();
  const urlInput = document.getElementById('pImagemUrl');
  const pendingUrl = urlInput?.value.trim();
  if (pendingUrl && pendingUrl.startsWith('http') && editingImages.length < 4) {
    editingImages.push(pendingUrl);
    urlInput.value = '';
    renderImagePreview();
  }
  const id = document.getElementById('produtoId').value;
  const data = {
    nome:        document.getElementById('pNome').value.trim(),
    preco:       parseFloat(document.getElementById('pPreco').value),
    categoria_id:document.getElementById('pCategoria').value || null,
    estoque:     parseInt(document.getElementById('pEstoque').value) || 0,
    descricao:   document.getElementById('pDescricao').value.trim(),
    destaque:    document.getElementById('pDestaque').checked,
    imagens:     editingImages,
  };
  if (!data.nome || isNaN(data.preco)) {
    showToast('Nome e preço são obrigatórios.', 'error'); return;
  }
  try {
    if (id) {
      await api.put(`/produtos/${id}`, data);
      showToast('Produto atualizado com sucesso! ✅');
    } else {
      await api.post('/produtos', data);
      showToast('Produto criado com sucesso! 🎉');
    }
    closeFormModal();
    loadProdutosAdmin();
  } catch(e) {
    showToast(e.message, 'error');
  }
}

function confirmDelete(id) {
  deleteTargetId = id;
  document.getElementById('deleteOverlay').style.display = 'flex';
}

async function doDelete() {
  if (!deleteTargetId) return;
  try {
    await api.delete(`/produtos/${deleteTargetId}`);
    showToast('Produto excluído.', 'success');
    document.getElementById('deleteOverlay').style.display = 'none';
    deleteTargetId = null;
    loadProdutosAdmin();
  } catch(e) {
    showToast(e.message, 'error');
  }
}

async function loadPedidos() {
  const wrap = document.getElementById('tabelaPedidosWrap');
  try {
    const pedidos = await api.get('/pedidos');
    if (pedidos.length === 0) {
      wrap.innerHTML = '<div class="loading-state">Nenhum pedido registrado ainda.</div>'; return;
    }
    const totalGeral = pedidos.reduce((s, p) => s + p.total, 0);
    wrap.innerHTML = `
      <div class="admin-stats">
        <div class="admin-stat">
          <div class="admin-stat__label">Total de Pedidos</div>
          <div class="admin-stat__val">${pedidos.length}</div>
        </div>
        <div class="admin-stat">
          <div class="admin-stat__label">Receita Total</div>
          <div class="admin-stat__val admin-stat__val--green">${formatBRL(totalGeral)}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Itens</th><th>Total</th><th>Status</th><th>Data</th></tr></thead>
        <tbody>
          ${pedidos.map(p => `
            <tr>
              <td>#${p.id}</td>
              <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${p.itens.map(i => `${i.nome} (x${i.qty})`).join(', ')}
              </td>
              <td><span class="td-preco">${formatBRL(p.total)}</span></td>
              <td><span class="td-badge">${p.status}</span></td>
              <td style="color:var(--text-muted);font-size:.82rem">${new Date(p.created_at).toLocaleString('pt-BR')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch(e) {
    wrap.innerHTML = '<div class="loading-state" style="color:var(--danger)">Erro ao carregar pedidos.</div>';
  }
}

async function loadUsuarios() {
  const wrap = document.getElementById('tabelaUsuariosWrap');
  try {
    const users = await api.get('/admin/usuarios');
    wrap.innerHTML = `
      <div class="admin-stats">
        <div class="admin-stat">
          <div class="admin-stat__label">Total Usuários</div>
          <div class="admin-stat__val">${users.length}</div>
        </div>
        <div class="admin-stat">
          <div class="admin-stat__label">Admins</div>
          <div class="admin-stat__val admin-stat__val--green">${users.filter(u => u.perfil === 'admin').length}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Cadastro</th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td style="font-weight:600">${u.nome}</td>
              <td style="color:var(--text-muted)">${u.email}</td>
              <td><span class="td-badge ${u.perfil === 'admin' ? '' : 'td-badge--off'}">${u.perfil}</span></td>
              <td style="color:var(--text-muted);font-size:.82rem">${new Date(u.created_at).toLocaleString('pt-BR')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch(e) {
    wrap.innerHTML = '<div class="loading-state" style="color:var(--danger)">Erro ao carregar usuários.</div>';
  }
}

function filterAdminProdutos(term) {
  const q = normalizeText(term);
  filteredProdutos = q
    ? allProdutosAdmin.filter(p => normalizeText(p.nome).includes(q) || normalizeText(p.categoria_nome || '').includes(q))
    : [...allProdutosAdmin];
  currentPage = 1;
  renderTabelaProdutos();
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAdminAuth()) return;

  await loadCategoriasAdmin();
  await loadProdutosAdmin();

  document.querySelectorAll('.sidebar__link[data-tab]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      setTab(link.dataset.tab);
    });
  });

  document.getElementById('btnNovoProduto')?.addEventListener('click', openNewModal);
  document.getElementById('formProduto')?.addEventListener('submit', saveProduto);
  document.getElementById('btnCloseForm')?.addEventListener('click', closeFormModal);
  document.getElementById('btnCancelarForm')?.addEventListener('click', closeFormModal);

  document.getElementById('btnConfirmDelete')?.addEventListener('click', doDelete);
  document.getElementById('btnCancelDelete')?.addEventListener('click', () => {
    document.getElementById('deleteOverlay').style.display = 'none';
    deleteTargetId = null;
  });

  document.getElementById('btnAnterior')?.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderTabelaProdutos(); }
  });
  document.getElementById('btnProximo')?.addEventListener('click', () => {
    if (currentPage < Math.ceil(filteredProdutos.length / ITEMS_PER_PAGE)) {
      currentPage++; renderTabelaProdutos();
    }
  });

  let st;
  document.getElementById('adminBusca')?.addEventListener('input', (e) => {
    clearTimeout(st);
    st = setTimeout(() => filterAdminProdutos(e.target.value), 300);
  });

  document.getElementById('btnLogout')?.addEventListener('click', () => {
    if (confirm('Deseja sair do painel?')) {
      localStorage.removeItem('fc_token');
      localStorage.removeItem('fc_user');
      window.location.href = '../index.html';
    }
  });
});
