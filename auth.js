import { createCloudSync } from './cloud-sync.js';

const guestActions = document.getElementById('accountGuestActions');
const userActions = document.getElementById('accountUserActions');
const accountIdentity = document.getElementById('accountIdentity');
const authDialog = document.getElementById('authDialog');
const authForm = document.getElementById('authForm');
const authTitle = document.getElementById('authDialogTitle');
const usernameField = document.getElementById('authUsernameField');
const usernameInput = document.getElementById('authUsername');
const identifierInput = document.getElementById('authIdentifier');
const passwordInput = document.getElementById('authPassword');
const authStatus = document.getElementById('authStatus');
const authSubmit = document.getElementById('authSubmit');
const toggleAuthMode = document.getElementById('toggleAuthMode');
const cloudSaveStatus = document.getElementById('cloudSaveStatus');
const retryCloudSync = document.getElementById('retryCloudSync');
const adminLink = document.getElementById('adminLink');
const loadDataFromServer = document.getElementById('loadDataFromServer');
const sessionConflictDialog = document.getElementById('sessionConflictDialog');
const sessionConflictMessage = document.getElementById('sessionConflictMessage');
const sessionConflictStatus = document.getElementById('sessionConflictStatus');
const closeOtherSessions = document.getElementById('closeOtherSessions');
const localImportDialog = document.getElementById('localImportDialog');
const localImportMessage = document.getElementById('localImportMessage');
const importLocalPoems = document.getElementById('importLocalPoems');
const keepLocalPoemsSeparate = document.getElementById('keepLocalPoemsSeparate');
const discardLocalPoems = document.getElementById('discardLocalPoems');

let authMode = 'login';
let currentUser = null;

const cloudSync = createCloudSync({
  onStatus(status, message) {
    if (!cloudSaveStatus) return;
    cloudSaveStatus.textContent = message;
    cloudSaveStatus.classList.toggle('is-syncing', status === 'syncing');
    cloudSaveStatus.classList.toggle('is-error', status === 'error');
    retryCloudSync.classList.toggle('hidden', status !== 'error' || cloudSync.pendingCount() === 0);
  },
  onTrash(trash) {
    window.dispatchEvent(new CustomEvent('escandidor:trash-synced', {
      detail: { trash },
    }));
  },
  onLibrary(memory) {
    window.dispatchEvent(new CustomEvent('escandidor:library-changed', {
      detail: { memory },
    }));
  },
});

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'No se pudo completar la solicitud.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

function renderUser(user) {
  currentUser = user || null;
  guestActions.classList.toggle('hidden', Boolean(user));
  userActions.classList.toggle('hidden', !user);
  accountIdentity.textContent = user ? user.username : '';
  adminLink?.classList.toggle('hidden', user?.role !== 'admin');
  if (loadDataFromServer) loadDataFromServer.disabled = !user;
  cloudSync.setUser(user);
}

function showSessionConflict(otherSessions) {
  const count = Number(otherSessions) || 0;
  if (!count || !currentUser) return;
  sessionConflictMessage.textContent = count === 1
    ? 'Esta cuenta está abierta en otro navegador. Cierra esa sesión para continuar aquí.'
    : `Esta cuenta está abierta en otros ${count} navegadores. Cierra esas sesiones para continuar aquí.`;
  sessionConflictStatus.textContent = '';
  if (!sessionConflictDialog.open) sessionConflictDialog.showModal();
}

function offerLocalImport() {
  const localCount = cloudSync.getAnonymousPoemCount();
  if (!currentUser || !localCount || localImportDialog.open) return;
  localImportMessage.textContent = localCount === 1
    ? 'Hay un poema local en este navegador. Puedes importarlo sin borrar la copia local.'
    : `Hay ${localCount} poemas locales en este navegador. Puedes importarlos sin borrar las copias locales.`;
  localImportDialog.showModal();
}

function handleAuthState(payload) {
  const wasAnonymous = !currentUser;
  renderUser(payload.user);
  if (!payload.user) return;
  if (Number(payload.otherSessions) > 0) {
    showSessionConflict(payload.otherSessions);
  } else if (wasAnonymous) {
    offerLocalImport();
  }
}

function setMode(mode) {
  authMode = mode;
  const registering = mode === 'register';
  authTitle.textContent = registering ? 'Crear cuenta' : 'Iniciar sesión';
  authSubmit.textContent = registering ? 'Crear cuenta' : 'Iniciar sesión';
  toggleAuthMode.textContent = registering
    ? '¿Ya tienes cuenta? Iniciar sesión'
    : '¿Primera vez? Crear cuenta';
  usernameField.classList.toggle('hidden', !registering);
  usernameInput.required = registering;
  identifierInput.previousElementSibling.textContent = registering ? 'Correo electrónico' : 'Correo o usuario';
  identifierInput.autocomplete = registering ? 'email' : 'username';
  passwordInput.autocomplete = registering ? 'new-password' : 'current-password';
  authStatus.textContent = '';
}

function openAuth(mode) {
  setMode(mode);
  authForm.reset();
  authDialog.showModal();
  (mode === 'register' ? usernameInput : identifierInput).focus();
}

document.getElementById('openLogin').addEventListener('click', () => openAuth('login'));
document.getElementById('openRegister').addEventListener('click', () => openAuth('register'));
document.getElementById('closeAuthDialog').addEventListener('click', () => authDialog.close());
toggleAuthMode.addEventListener('click', () => setMode(authMode === 'login' ? 'register' : 'login'));
document.getElementById('discordLogin').addEventListener('click', () => {
  window.location.assign('/api/auth/discord');
});

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  authStatus.textContent = '';
  authSubmit.disabled = true;
  try {
    const body = authMode === 'register'
      ? { username: usernameInput.value, email: identifierInput.value, password: passwordInput.value }
      : { email: identifierInput.value, password: passwordInput.value };
    const payload = await apiRequest(`/api/auth/${authMode}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    handleAuthState(payload);
    authDialog.close();
  } catch (error) {
    authStatus.textContent = error.message;
  } finally {
    authSubmit.disabled = false;
  }
});

document.getElementById('logoutAccount').addEventListener('click', async () => {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST', body: '{}' });
    renderUser(null);
  } catch (error) {
    window.alert(error.message);
  }
});

window.addEventListener('escandidor:poem-saved', (event) => {
  cloudSync.syncSavedVersion(event.detail);
});

window.addEventListener('escandidor:poem-deleted', (event) => {
  cloudSync.deleteSavedVersions(event.detail);
});

window.addEventListener('escandidor:trash-emptied', () => {
  cloudSync.emptyTrash();
});

loadDataFromServer?.addEventListener('click', async () => {
  loadDataFromServer.disabled = true;
  await cloudSync.loadFromServer();
  loadDataFromServer.disabled = !currentUser;
});

retryCloudSync.addEventListener('click', () => cloudSync.retryPending());

importLocalPoems.addEventListener('click', async () => {
  importLocalPoems.disabled = true;
  const imported = cloudSync.importAnonymousPoems();
  if (!imported) {
    localImportDialog.close();
    importLocalPoems.disabled = false;
    return;
  }
  cloudSaveStatus.textContent = `Importando ${imported} poema${imported === 1 ? '' : 's'} local${imported === 1 ? '' : 'es'}…`;
  localImportDialog.close();
  await cloudSync.loadFromServer();
  importLocalPoems.disabled = false;
});

keepLocalPoemsSeparate.addEventListener('click', () => localImportDialog.close());

discardLocalPoems.addEventListener('click', () => {
  const confirmed = window.confirm(
    '¿Descartar definitivamente los poemas locales de este navegador? Los poemas que ya están en tu cuenta no se borrarán.',
  );
  if (!confirmed) return;
  const discarded = cloudSync.discardAnonymousPoems();
  localImportDialog.close();
  cloudSaveStatus.textContent = `${discarded} poema${discarded === 1 ? '' : 's'} local${discarded === 1 ? '' : 'es'} descartado${discarded === 1 ? '' : 's'}`;
});

sessionConflictDialog.addEventListener('cancel', (event) => event.preventDefault());

closeOtherSessions.addEventListener('click', async () => {
  closeOtherSessions.disabled = true;
  sessionConflictStatus.textContent = '';
  try {
    await apiRequest('/api/auth/sessions/others', { method: 'DELETE' });
    sessionConflictDialog.close();
    offerLocalImport();
  } catch (error) {
    sessionConflictStatus.textContent = error.message;
  } finally {
    closeOtherSessions.disabled = false;
  }
});

async function checkCurrentSession() {
  if (!currentUser || document.hidden) return;
  try {
    const payload = await apiRequest('/api/auth/me');
    if (!payload.user) {
      renderUser(null);
      if (sessionConflictDialog.open) sessionConflictDialog.close();
      openAuth('login');
      authStatus.textContent = 'Esta sesión se cerró desde otro navegador. Inicia sesión de nuevo.';
      return;
    }
    handleAuthState(payload);
  } catch {}
}

apiRequest('/api/auth/me')
  .then(handleAuthState)
  .catch(() => renderUser(null));

window.setInterval(checkCurrentSession, 10_000);

const authError = new URL(window.location.href).searchParams.get('auth_error');
if (authError) {
  openAuth('login');
  authStatus.textContent = authError;
  window.history.replaceState({}, '', window.location.pathname + window.location.hash);
}