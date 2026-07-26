const statusNode = document.getElementById('adminStatus');
const contentNode = document.getElementById('adminContent');
const identityNode = document.getElementById('adminIdentity');
const searchInput = document.getElementById('adminSearch');
const usersBody = document.getElementById('usersTableBody');
const poemsBody = document.getElementById('poemsTableBody');
const usersPanel = document.getElementById('usersPanel');
const poemsPanel = document.getElementById('poemsPanel');
const usersTab = document.getElementById('usersTab');
const poemsTab = document.getElementById('poemsTab');

let currentView = 'users';
let searchTimer;

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'No se pudo completar la operación.');
  return payload;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

function setStatus(message, error = false) {
  statusNode.textContent = message;
  statusNode.classList.toggle('is-error', error);
}

function emptyRow(columns, message) {
  return `<tr><td class="admin-empty" colspan="${columns}">${escapeHtml(message)}</td></tr>`;
}

async function loadStats() {
  const { stats } = await api('/api/admin/stats');
  document.getElementById('userCount').textContent = stats.userCount;
  document.getElementById('poemCount').textContent = stats.poemCount;
  document.getElementById('adminCount').textContent = stats.adminCount;
}

async function loadUsers() {
  const query = searchInput.value.trim();
  const { users } = await api(`/api/admin/users${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  usersBody.innerHTML = users.length ? users.map((user) => `
    <tr data-user-id="${user.id}">
      <td><strong>${escapeHtml(user.username)}</strong></td>
      <td>${escapeHtml(user.email)}</td>
      <td>${user.poemCount}</td>
      <td><select data-field="role" aria-label="Rol de ${escapeHtml(user.username)}">
        <option value="user" ${user.role === 'user' ? 'selected' : ''}>Usuario</option>
        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrador</option>
      </select></td>
      <td><select data-field="status" aria-label="Estado de ${escapeHtml(user.username)}">
        <option value="active" ${user.status === 'active' ? 'selected' : ''}>Activo</option>
        <option value="disabled" ${user.status === 'disabled' ? 'selected' : ''}>Deshabilitado</option>
      </select></td>
      <td><div class="admin-row-actions">
        <button type="button" data-action="save-user">Guardar</button>
        <button type="button" class="admin-delete" data-action="delete-user">Eliminar</button>
      </div></td>
    </tr>`).join('') : emptyRow(6, 'No hay usuarios que coincidan.');
}

async function loadPoems() {
  const query = searchInput.value.trim();
  const { poems } = await api(`/api/admin/poems${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  poemsBody.innerHTML = poems.length ? poems.map((poem) => `
    <tr data-poem-id="${poem.id}">
      <td><strong>${escapeHtml(poem.title)}</strong></td>
      <td>${escapeHtml(poem.versionName)}</td>
      <td>${escapeHtml(poem.owner.username)}<br><small>${escapeHtml(poem.owner.email)}</small></td>
      <td>${escapeHtml(new Date(poem.updatedAt).toLocaleString('es'))}</td>
      <td><div class="admin-row-actions"><button type="button" class="admin-delete" data-action="delete-poem">Eliminar</button></div></td>
    </tr>`).join('') : emptyRow(5, 'No hay poemas que coincidan.');
}

async function refresh() {
  setStatus('Actualizando…');
  try {
    await Promise.all([loadStats(), currentView === 'users' ? loadUsers() : loadPoems()]);
    setStatus('Datos actualizados.');
  } catch (error) {
    setStatus(error.message, true);
  }
}

function selectView(view) {
  currentView = view;
  const showingUsers = view === 'users';
  usersPanel.classList.toggle('hidden', !showingUsers);
  poemsPanel.classList.toggle('hidden', showingUsers);
  usersTab.classList.toggle('is-active', showingUsers);
  poemsTab.classList.toggle('is-active', !showingUsers);
  usersTab.setAttribute('aria-selected', String(showingUsers));
  poemsTab.setAttribute('aria-selected', String(!showingUsers));
  searchInput.placeholder = showingUsers ? 'Buscar usuarios…' : 'Buscar poemas o propietarios…';
  refresh();
}

usersTab.addEventListener('click', () => selectView('users'));
poemsTab.addEventListener('click', () => selectView('poems'));
document.getElementById('refreshAdmin').addEventListener('click', refresh);
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(refresh, 250);
});

usersBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  const row = button?.closest('tr[data-user-id]');
  if (!button || !row) return;
  const userId = row.dataset.userId;
  try {
    if (button.dataset.action === 'save-user') {
      await api(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          role: row.querySelector('[data-field="role"]').value,
          status: row.querySelector('[data-field="status"]').value,
        }),
      });
    } else if (button.dataset.action === 'delete-user') {
      if (!confirm('¿Eliminar este usuario y todos sus poemas?')) return;
      await api(`/api/admin/users/${userId}`, { method: 'DELETE' });
    }
    await refresh();
  } catch (error) {
    setStatus(error.message, true);
  }
});

poemsBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action="delete-poem"]');
  const row = button?.closest('tr[data-poem-id]');
  if (!button || !row || !confirm('¿Eliminar este poema y todas sus versiones?')) return;
  try {
    await api(`/api/admin/poems/${row.dataset.poemId}`, { method: 'DELETE' });
    await refresh();
  } catch (error) {
    setStatus(error.message, true);
  }
});

api('/api/auth/me').then(({ user }) => {
  if (!user) throw new Error('Debes iniciar sesión para entrar en administración.');
  if (user.role !== 'admin') throw new Error('Tu cuenta no tiene permisos de administrador.');
  identityNode.textContent = user.username;
  contentNode.classList.remove('hidden');
  return refresh();
}).catch((error) => setStatus(error.message, true));