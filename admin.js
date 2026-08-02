const statusNode = document.getElementById('adminStatus');
const contentNode = document.getElementById('adminContent');
const identityNode = document.getElementById('adminIdentity');
const searchInput = document.getElementById('adminSearch');
const usersBody = document.getElementById('usersTableBody');
const poemsBody = document.getElementById('poemsTableBody');
const supportersBody = document.getElementById('supportersTableBody');
const usersPanel = document.getElementById('usersPanel');
const supportersPanel = document.getElementById('supportersPanel');
const poemsPanel = document.getElementById('poemsPanel');
const usersTab = document.getElementById('usersTab');
const supportersTab = document.getElementById('supportersTab');
const poemsTab = document.getElementById('poemsTab');

let currentView = 'users';
let searchTimer;
let adminUsers = [];

function formatMoney(amountMinor, currency) {
  return new Intl.NumberFormat('es', { style: 'currency', currency }).format(amountMinor / 100);
}

function formatRevenue(revenue, field) {
  return revenue.length
    ? revenue.map((item) => formatMoney(item[field], item.currency)).join(' · ')
    : '0 €';
}

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
  document.getElementById('payingUserCount').textContent = stats.payingUserCount;
  document.getElementById('earnedTotal').textContent = formatRevenue(stats.revenue, 'earnedMinor');
  document.getElementById('nextMonthTotal').textContent = formatRevenue(stats.revenue, 'nextMonthMinor');
}

async function loadUsers() {
  const query = searchInput.value.trim();
  const { users } = await api(`/api/admin/users${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  adminUsers = users;
  usersBody.innerHTML = users.length ? users.map((user) => `
    <tr data-user-id="${user.id}">
      <td><strong>${escapeHtml(user.username)}</strong></td>
      <td>${escapeHtml(user.email)}</td>
      <td>${user.discordConnected ? 'Conectado' : 'No'}</td>
      <td>${user.poemCount}</td>
      <td><select data-field="role" aria-label="Rol de ${escapeHtml(user.username)}">
        <option value="user" ${user.role === 'user' ? 'selected' : ''}>Usuario</option>
        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrador</option>
      </select></td>
      <td><select data-field="status" aria-label="Estado de ${escapeHtml(user.username)}">
        <option value="active" ${user.status === 'active' ? 'selected' : ''}>Activo</option>
        <option value="disabled" ${user.status === 'disabled' ? 'selected' : ''}>Deshabilitado</option>
      </select></td>
      <td><label class="admin-check"><input data-field="paying" type="checkbox" ${user.paying ? 'checked' : ''}> Pagador</label></td>
      <td><input data-field="personalized-message" class="admin-message-input" maxlength="180" value="${escapeHtml(user.personalizedMessage)}" placeholder="Gracias por tu apoyo"></td>
      <td><div class="admin-row-actions">
        <button type="button" data-action="save-user">Guardar</button>
        <button type="button" class="admin-delete" data-action="delete-user">Eliminar</button>
      </div></td>
    </tr>`).join('') : emptyRow(9, 'No hay usuarios que coincidan.');
}

async function loadSupporters() {
  const query = searchInput.value.trim();
  const [{ supporters }, { users }] = await Promise.all([
    api(`/api/admin/supporters${query ? `?q=${encodeURIComponent(query)}` : ''}`),
    api('/api/admin/users'),
  ]);
  adminUsers = users;
  const userOptions = (selectedId) => `<option value="">Sin vincular</option>${adminUsers.map((user) =>
    `<option value="${user.id}" ${user.id === selectedId ? 'selected' : ''}>${escapeHtml(user.username)}${user.discordConnected ? ' · Discord' : ''}</option>`
  ).join('')}`;
  supportersBody.innerHTML = supporters.length ? supporters.map((supporter) => `
    <tr data-supporter-id="${supporter.id}">
      <td><strong>${escapeHtml(supporter.provider)}</strong>${supporter.displayName ? `<br><small>${escapeHtml(supporter.displayName)}</small>` : ''}</td>
      <td><select data-field="user-id" aria-label="Usuario vinculado">${userOptions(supporter.user?.id)}</select></td>
      <td><select data-field="support-type"><option value="one_time" ${supporter.supportType === 'one_time' ? 'selected' : ''}>Puntual</option><option value="membership" ${supporter.supportType === 'membership' ? 'selected' : ''}>Membresía</option></select></td>
      <td><select data-field="supporter-status"><option value="supporter" ${supporter.status === 'supporter' ? 'selected' : ''}>Supporter</option><option value="active" ${supporter.status === 'active' ? 'selected' : ''}>Activo</option><option value="inactive" ${supporter.status === 'inactive' ? 'selected' : ''}>Inactivo</option><option value="cancelled" ${supporter.status === 'cancelled' ? 'selected' : ''}>Cancelado</option></select></td>
      <td>${supporter.revenue.length ? escapeHtml(formatRevenue(supporter.revenue, 'earnedMinor')) : '—'}</td>
      <td>${supporter.lastPaidAt ? escapeHtml(new Date(supporter.lastPaidAt).toLocaleDateString('es')) : '—'}</td>
      <td><input data-field="supporter-message" class="admin-message-input" maxlength="180" value="${escapeHtml(supporter.personalizedMessage)}" placeholder="Gracias por sostener Escandidor"></td>
      <td><button type="button" data-action="save-supporter">Guardar</button></td>
    </tr>`).join('') : emptyRow(8, 'No hay supporters que coincidan.');
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
    const loadCurrentView = currentView === 'users' ? loadUsers : currentView === 'supporters' ? loadSupporters : loadPoems;
    await Promise.all([loadStats(), loadCurrentView()]);
    setStatus('Datos actualizados.');
  } catch (error) {
    setStatus(error.message, true);
  }
}

function selectView(view) {
  currentView = view;
  const showingUsers = view === 'users';
  usersPanel.classList.toggle('hidden', !showingUsers);
  supportersPanel.classList.toggle('hidden', view !== 'supporters');
  poemsPanel.classList.toggle('hidden', view !== 'poems');
  usersTab.classList.toggle('is-active', showingUsers);
  usersTab.setAttribute('aria-selected', String(showingUsers));
  supportersTab.classList.toggle('is-active', view === 'supporters');
  supportersTab.setAttribute('aria-selected', String(view === 'supporters'));
  poemsTab.classList.toggle('is-active', view === 'poems');
  poemsTab.setAttribute('aria-selected', String(view === 'poems'));
  searchInput.placeholder = showingUsers ? 'Buscar usuarios…' : view === 'supporters' ? 'Buscar supporters…' : 'Buscar poemas o propietarios…';
  refresh();
}

usersTab.addEventListener('click', () => selectView('users'));
supportersTab.addEventListener('click', () => selectView('supporters'));
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
          paying: row.querySelector('[data-field="paying"]').checked,
          personalizedMessage: row.querySelector('[data-field="personalized-message"]').value,
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

supportersBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action="save-supporter"]');
  const row = button?.closest('tr[data-supporter-id]');
  if (!button || !row) return;
  try {
    await api(`/api/admin/supporters/${row.dataset.supporterId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        userId: row.querySelector('[data-field="user-id"]').value || null,
        supportType: row.querySelector('[data-field="support-type"]').value,
        status: row.querySelector('[data-field="supporter-status"]').value,
        personalizedMessage: row.querySelector('[data-field="supporter-message"]').value,
      }),
    });
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