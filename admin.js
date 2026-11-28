import { escapeHtml, renderEditorialMarkdown } from './editorial-markdown.js';

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
const pagesPanel = document.getElementById('pagesPanel');
const usersTab = document.getElementById('usersTab');
const supportersTab = document.getElementById('supportersTab');
const poemsTab = document.getElementById('poemsTab');
const pagesTab = document.getElementById('pagesTab');

// Pages CMS nodes
const pagesListNode = document.getElementById('pagesList');
const pageStatusBadge = document.getElementById('pageStatusBadge');
const pageUrlDisplay = document.getElementById('pageUrlDisplay');
const pagePublicLink = document.getElementById('pagePublicLink');
const pageMetaDetails = document.getElementById('pageMetaDetails');
const pageSlugInput = document.getElementById('pageSlugInput');
const pageHeadingInput = document.getElementById('pageHeadingInput');
const pageTitleInput = document.getElementById('pageTitleInput');
const pageEyebrowInput = document.getElementById('pageEyebrowInput');
const pageDescriptionInput = document.getElementById('pageDescriptionInput');
const pageNavLabelInput = document.getElementById('pageNavLabelInput');
const pageSortOrderInput = document.getElementById('pageSortOrderInput');
const pageShowInNavInput = document.getElementById('pageShowInNavInput');
const pageDraftInput = document.getElementById('pageDraftInput');
const pagePreviewCanvas = document.getElementById('pagePreviewCanvas');
const previewDraftBtn = document.getElementById('previewDraftBtn');
const previewPublishedBtn = document.getElementById('previewPublishedBtn');
const saveDraftBtn = document.getElementById('saveDraftBtn');
const publishPageBtn = document.getElementById('publishPageBtn');
const discardDraftBtn = document.getElementById('discardDraftBtn');
const unpublishPageBtn = document.getElementById('unpublishPageBtn');
const deletePageBtn = document.getElementById('deletePageBtn');

let currentView = 'users';
let searchTimer;
let adminUsers = [];
let editorialPages = [];
let selectedSlug = '';
let creatingNewPage = false;
let previewMode = 'draft';

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

// ---------------------------------------------------------------------
// Páginas editoriales en Markdown (borrador + publicado + vista previa)
// ---------------------------------------------------------------------

function pageStatusInfo(page) {
  if (!page || creatingNewPage) return { label: 'Nueva (sin guardar)', cls: '' };
  if (page.published && page.hasUnpublishedChanges) return { label: 'Borrador con cambios', cls: 'is-pending' };
  if (page.published) return { label: 'Publicada', cls: 'is-published' };
  return { label: 'Solo borrador', cls: '' };
}

function currentPageRecord() {
  return creatingNewPage ? null : editorialPages.find((p) => p.slug === selectedSlug) || null;
}

function renderPagesList() {
  pagesListNode.innerHTML = editorialPages.map((page) => {
    const badge = pageStatusInfo(page);
    const active = !creatingNewPage && page.slug === selectedSlug;
    return `<button type="button" class="page-pill ${active ? 'is-active' : ''}" data-select-page="${escapeHtml(page.slug)}" role="tab" aria-selected="${active}">
      <span><strong>${escapeHtml(page.navLabel || page.heading)}</strong> <span class="page-pill-slug">/${escapeHtml(page.slug)}</span></span>
      <span class="page-badge ${badge.cls}">${escapeHtml(badge.label)}</span>
    </button>`;
  }).join('') || '<span class="muted">Todavía no hay páginas creadas.</span>';
}

function renderPagePreview() {
  const record = currentPageRecord();
  const showingPublished = previewMode === 'published';
  previewDraftBtn.classList.toggle('is-active', !showingPublished);
  previewPublishedBtn.classList.toggle('is-active', showingPublished);

  if (showingPublished) {
    if (!record || !record.published) {
      pagePreviewCanvas.innerHTML = '<p class="pages-preview-empty">Esta página todavía no está publicada. Guardá y hacé clic en «Publicar» para ponerla en línea.</p>';
      return;
    }
    const eyebrowHtml = record.eyebrow ? `<p class="label">${escapeHtml(record.eyebrow)}</p>` : '';
    pagePreviewCanvas.innerHTML = `<article>${eyebrowHtml}<h1>${escapeHtml(record.heading)}</h1>${renderEditorialMarkdown(record.publishedMd)}</article>`;
    return;
  }

  const eyebrow = pageEyebrowInput.value.trim();
  const heading = pageHeadingInput.value.trim() || 'Sin encabezado';
  const body = renderEditorialMarkdown(pageDraftInput.value);
  pagePreviewCanvas.innerHTML = `<article>${eyebrow ? `<p class="label">${escapeHtml(eyebrow)}</p>` : ''}<h1>${escapeHtml(heading)}</h1>${body || '<p class="pages-preview-empty">Escribí Markdown a la izquierda para ver cómo queda la página…</p>'}</article>`;
}

function populatePageEditor(page) {
  const isNew = !page;
  creatingNewPage = isNew;
  pageSlugInput.readOnly = !isNew;
  pageMetaDetails.open = isNew;

  pageSlugInput.value = isNew ? '' : page.slug;
  pageHeadingInput.value = isNew ? '' : page.heading;
  pageTitleInput.value = isNew ? '' : page.title;
  pageEyebrowInput.value = isNew ? '' : page.eyebrow;
  pageDescriptionInput.value = isNew ? '' : page.description;
  pageNavLabelInput.value = isNew ? '' : page.navLabel;
  pageSortOrderInput.value = isNew ? String((editorialPages.length + 1) * 10) : String(page.sortOrder);
  pageShowInNavInput.checked = isNew ? false : Boolean(page.showInNav);
  pageDraftInput.value = isNew ? '## Nueva sección\n\nEscribí acá el contenido en Markdown y agregá enlaces como [Mesa de Poesía](/taller/).\n' : page.draftMd;

  syncEditorChrome();
  renderPagesList();
  renderPagePreview();
}

function syncEditorChrome() {
  const record = currentPageRecord();
  const liveSlug = (creatingNewPage ? pageSlugInput.value : record?.slug || '').trim().toLowerCase().replace(/^\/+|\/+$/g, '');
  pageUrlDisplay.textContent = `/${liveSlug || 'nueva-pagina'}`;

  const localDraftDiffers = record && record.published && pageDraftInput.value !== record.publishedMd;
  const badge = creatingNewPage
    ? { label: 'Nueva (sin guardar)', cls: '' }
    : record?.published && (record.hasUnpublishedChanges || localDraftDiffers)
      ? { label: 'Borrador con cambios', cls: 'is-pending' }
      : pageStatusInfo(record);

  pageStatusBadge.textContent = badge.label;
  pageStatusBadge.className = `page-badge ${badge.cls}`.trim();

  const isPublished = Boolean(record?.published);
  pagePublicLink.classList.toggle('hidden', !isPublished);
  if (isPublished) pagePublicLink.href = `/${record.slug}`;

  discardDraftBtn.classList.toggle('hidden', !isPublished || (!record.hasUnpublishedChanges && !localDraftDiffers));
  unpublishPageBtn.classList.toggle('hidden', !isPublished);
  deletePageBtn.classList.toggle('hidden', creatingNewPage || !record);
  publishPageBtn.textContent = isPublished ? 'Publicar cambios' : 'Publicar página';
}

function readPageFormPayload(action) {
  return {
    action,
    slug: pageSlugInput.value.trim(),
    heading: pageHeadingInput.value.trim(),
    title: pageTitleInput.value.trim() || `${pageHeadingInput.value.trim()} | Mesa de Poesía`,
    eyebrow: pageEyebrowInput.value.trim(),
    description: pageDescriptionInput.value.trim(),
    navLabel: pageNavLabelInput.value.trim() || pageHeadingInput.value.trim(),
    sortOrder: Number(pageSortOrderInput.value) || 100,
    showInNav: pageShowInNavInput.checked,
    draftMd: pageDraftInput.value,
  };
}

async function loadPages() {
  const query = searchInput.value.trim();
  const { pages } = await api(`/api/admin/pages${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  editorialPages = pages || [];
  if (!creatingNewPage) {
    if (!selectedSlug || !editorialPages.some((p) => p.slug === selectedSlug)) {
      selectedSlug = editorialPages[0]?.slug || '';
    }
    populatePageEditor(editorialPages.find((p) => p.slug === selectedSlug) || null);
  } else {
    renderPagesList();
  }
}

async function saveOrPublishPage(publish) {
  try {
    if (creatingNewPage) {
      const payload = readPageFormPayload(publish ? 'publish' : 'save-draft');
      payload.publish = publish;
      const { page } = await api('/api/admin/pages', { method: 'POST', body: JSON.stringify(payload) });
      creatingNewPage = false;
      selectedSlug = page.slug;
      await loadPages();
      setStatus(publish ? `Página "/${page.slug}" creada y publicada.` : `Borrador "/${page.slug}" guardado.`);
      return;
    }
    const record = currentPageRecord();
    if (!record) return;
    const payload = readPageFormPayload(publish ? 'publish' : 'save-draft');
    const { page } = await api(`/api/admin/pages/${encodeURIComponent(record.slug)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    selectedSlug = page.slug;
    await loadPages();
    setStatus(publish ? `Cambios publicados en "/${page.slug}".` : `Borrador de "/${page.slug}" guardado (lo público no cambió).`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function refresh() {
  setStatus('Actualizando…');
  try {
    const loadCurrentView = currentView === 'users'
      ? loadUsers
      : currentView === 'supporters'
        ? loadSupporters
        : currentView === 'poems'
          ? loadPoems
          : loadPages;
    await Promise.all([loadStats(), loadCurrentView()]);
    setStatus('Datos actualizados.');
  } catch (error) {
    setStatus(error.message, true);
  }
}

function selectView(view) {
  currentView = view;
  usersPanel.classList.toggle('hidden', view !== 'users');
  supportersPanel.classList.toggle('hidden', view !== 'supporters');
  poemsPanel.classList.toggle('hidden', view !== 'poems');
  pagesPanel.classList.toggle('hidden', view !== 'pages');

  for (const [tab, key] of [[usersTab, 'users'], [supportersTab, 'supporters'], [poemsTab, 'poems'], [pagesTab, 'pages']]) {
    tab.classList.toggle('is-active', view === key);
    tab.setAttribute('aria-selected', String(view === key));
  }

  searchInput.placeholder = view === 'users'
    ? 'Buscar usuarios…'
    : view === 'supporters'
      ? 'Buscar supporters…'
      : view === 'poems'
        ? 'Buscar poemas o propietarios…'
        : 'Filtrar páginas por URL, título o texto…';
  refresh();
}

usersTab.addEventListener('click', () => selectView('users'));
supportersTab.addEventListener('click', () => selectView('supporters'));
poemsTab.addEventListener('click', () => selectView('poems'));
pagesTab.addEventListener('click', () => selectView('pages'));
document.getElementById('refreshAdmin').addEventListener('click', refresh);
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(refresh, 250);
});

pagesListNode.addEventListener('click', (event) => {
  const button = event.target.closest('[data-select-page]');
  if (!button) return;
  creatingNewPage = false;
  selectedSlug = button.dataset.selectPage;
  previewMode = 'draft';
  populatePageEditor(editorialPages.find((p) => p.slug === selectedSlug) || null);
});

document.getElementById('newPageBtn').addEventListener('click', () => {
  previewMode = 'draft';
  populatePageEditor(null);
  pageSlugInput.focus();
});

document.getElementById('resetPagesBtn').addEventListener('click', async () => {
  if (!confirm('¿Restaurar el contenido inicial de /recursos, /formas-poeticas y /concursos-de-poesia?')) return;
  try {
    await api('/api/admin/pages/reset', { method: 'POST', body: '{}' });
    creatingNewPage = false;
    await loadPages();
    setStatus('Páginas iniciales restauradas.');
  } catch (error) {
    setStatus(error.message, true);
  }
});

previewDraftBtn.addEventListener('click', () => {
  previewMode = 'draft';
  renderPagePreview();
});
previewPublishedBtn.addEventListener('click', () => {
  previewMode = 'published';
  renderPagePreview();
});

for (const input of [pageSlugInput, pageHeadingInput, pageEyebrowInput, pageDraftInput]) {
  input.addEventListener('input', () => {
    syncEditorChrome();
    if (previewMode === 'draft') renderPagePreview();
  });
}

saveDraftBtn.addEventListener('click', () => saveOrPublishPage(false));
publishPageBtn.addEventListener('click', () => saveOrPublishPage(true));

discardDraftBtn.addEventListener('click', async () => {
  const record = currentPageRecord();
  if (!record || !confirm(`¿Descartar el borrador de "/${record.slug}" y volver a la versión publicada?`)) return;
  try {
    await api(`/api/admin/pages/${encodeURIComponent(record.slug)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'discard-draft' }),
    });
    await loadPages();
    setStatus(`Borrador descartado: "/${record.slug}" volvió a su versión publicada.`);
  } catch (error) {
    setStatus(error.message, true);
  }
});

unpublishPageBtn.addEventListener('click', async () => {
  const record = currentPageRecord();
  if (!record || !confirm(`¿Despublicar "/${record.slug}"? Dejará de ser visible al público pero conservarás tu borrador.`)) return;
  try {
    await api(`/api/admin/pages/${encodeURIComponent(record.slug)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'unpublish' }),
    });
    await loadPages();
    setStatus(`"/${record.slug}" quedó como borrador oculto.`);
  } catch (error) {
    setStatus(error.message, true);
  }
});

deletePageBtn.addEventListener('click', async () => {
  const record = currentPageRecord();
  if (!record || !confirm(`¿Eliminar definitivamente la página "/${record.slug}"?`)) return;
  try {
    await api(`/api/admin/pages/${encodeURIComponent(record.slug)}`, { method: 'DELETE' });
    selectedSlug = '';
    await loadPages();
    setStatus(`Página "/${record.slug}" eliminada.`);
  } catch (error) {
    setStatus(error.message, true);
  }
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
