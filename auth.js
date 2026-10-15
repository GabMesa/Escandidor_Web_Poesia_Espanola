import { createCloudSync } from './cloud-sync.js';
import { applicationState } from './application-state.js';

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

const cloudSync = createCloudSync({
  state: applicationState.sync,
  shouldAutoCompress: () => applicationState.editor.autoCompressVersions === true
    && (new URLSearchParams(location.search).get('taller') !== '1' || applicationState.runtime.compressionPreferenceReady === true),
  onStatus(status, message) {
    applicationState.sync.status = status;
    applicationState.sync.message = message;
    window.dispatchEvent(new CustomEvent('escandidor:sync-status', { detail: { status, message } }));
    if (!cloudSaveStatus) return;
    cloudSaveStatus.textContent = message;
    cloudSaveStatus.classList.toggle('is-syncing', status === 'syncing');
    cloudSaveStatus.classList.toggle('is-error', status === 'error');
    retryCloudSync.classList.toggle('hidden', status !== 'error' || cloudSync.pendingCount() === 0);
  },
  onTrashPolicy(policy) {
    window.dispatchEvent(new CustomEvent('escandidor:trash-policy', { detail: { policy } }));
  },
  onTrash(trash) {
    window.dispatchEvent(new CustomEvent('escandidor:trash-synced', {
      detail: { trash },
    }));
  },
  onLibrary(memory, options = {}) {
    window.dispatchEvent(new CustomEvent('escandidor:library-changed', {
      detail: { memory, ...options },
    }));
  },
});

let activeSync;
async function synchronizePoems() {
  if (!applicationState.auth.user) throw Error('Iniciá sesión para sincronizar.');
  if (activeSync) return activeSync;
  activeSync = (async () => {
    await cloudSync.loadFromServer();
    await cloudSync.whenIdle();
    if (applicationState.sync.error || cloudSync.pendingCount()) throw applicationState.sync.error || Error('Quedan guardados pendientes de subir.');
  })().finally(() => { activeSync = null; });
  return activeSync;
}
applicationState.runtime.syncPoemsNow = synchronizePoems;
applicationState.runtime.syncImportedPoems = async (details,onProgress) => {
  let uploaded=0;
  await cloudSync.syncImportedVersions(details,progress=>{uploaded=progress.completed;onProgress(progress);});
  return {uploaded,pending:details.length-uploaded,error:uploaded<details.length?applicationState.sync.error?.message||'Sincronización pendiente.':''};
};
const refreshInBackground = () => {
  if (applicationState.auth.user && applicationState.runtime.authInitialized && !document.hidden) synchronizePoems().catch(() => {});
};
window.addEventListener('online', refreshInBackground);
window.addEventListener('focus', refreshInBackground);
document.addEventListener('visibilitychange', refreshInBackground);
window.setInterval(refreshInBackground, 30_000);

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
  const previousId = applicationState.auth.user?.id;
  if (user && user.id !== previousId) window.dispatchEvent(new CustomEvent('escandidor:trash-policy-loading', { detail: { userId: user.id } }));
  cloudSync.setUser(user);
  applicationState.auth.user = user || null;
  guestActions.classList.toggle('hidden', Boolean(user));
  userActions.classList.toggle('hidden', !user);
  accountIdentity.textContent = user ? user.username : '';
  adminLink?.classList.toggle('hidden', user?.role !== 'admin');
  if (loadDataFromServer) loadDataFromServer.disabled = !user;
  if (user && user.id !== previousId) cloudSync.loadTrashPolicy();
}

function showSessionConflict(otherSessions) {
  const count = Number(otherSessions) || 0;
  if (!count || !applicationState.auth.user) return;
  sessionConflictMessage.textContent = count === 1
    ? 'Esta cuenta está abierta en otro navegador. Cierra esa sesión para continuar aquí.'
    : `Esta cuenta está abierta en otros ${count} navegadores. Cierra esas sesiones para continuar aquí.`;
  sessionConflictStatus.textContent = '';
  if (!sessionConflictDialog.open) sessionConflictDialog.showModal();
}

function offerLocalImport() {
  const localCount = cloudSync.getAnonymousPoemCount();
  if (!applicationState.auth.user || !localCount || localImportDialog.open) return;
  localImportMessage.textContent = localCount === 1
    ? 'Hay un poema local en este navegador. Puedes importarlo sin borrar la copia local.'
    : `Hay ${localCount} poemas locales en este navegador. Puedes importarlos sin borrar las copias locales.`;
  localImportDialog.showModal();
}

async function handleAuthState(payload) {
  const wasAnonymous = !applicationState.auth.user;
  const previousUserId = applicationState.auth.user?.id;
  renderUser(payload.user);
  if(new URLSearchParams(location.search).get('real')==='1'){
    if(!applicationState.runtime.authInitialized || previousUserId!==payload.user?.id){
      if(payload.user) await cloudSync.loadFromServer();
      applicationState.runtime.authInitialized=true;
      window.dispatchEvent(new CustomEvent('escandidor:auth-ready'));
    }
    return;
  }
  applicationState.runtime.authInitialized=true;window.dispatchEvent(new CustomEvent('escandidor:auth-ready'));
  if (!payload.user) return;

  if (Number(payload.otherSessions) > 0) {
    showSessionConflict(payload.otherSessions);
  } else if (wasAnonymous) {
    const localCount = cloudSync.getAnonymousPoemCount();
    if (localCount > 0) {
      offerLocalImport();
    } else {
      cloudSync.loadFromServer();
    }
  }
}

function setMode(mode) {
  applicationState.auth.mode = mode;
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
toggleAuthMode.addEventListener('click', () => setMode(applicationState.auth.mode === 'login' ? 'register' : 'login'));
document.getElementById('discordLogin').addEventListener('click', () => {
  window.location.assign('/api/auth/discord');
});

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  authStatus.textContent = '';
  authSubmit.disabled = true;
  try {
    const body = applicationState.auth.mode === 'register'
      ? { username: usernameInput.value, email: identifierInput.value, password: passwordInput.value }
      : { email: identifierInput.value, password: passwordInput.value };
    const payload = await apiRequest(`/api/auth/${applicationState.auth.mode}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    await handleAuthState(payload);
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

window.addEventListener('escandidor:versions-compressed', (event) => {
  try {
    cloudSync.compressVersions(event.detail);
  } catch (error) {
    cloudSaveStatus.textContent = error.message;
    cloudSaveStatus.classList.add('is-error');
  }
});

window.addEventListener('escandidor:poem-deleted', (event) => {
  cloudSync.deleteSavedVersions(event.detail);
});

window.addEventListener('escandidor:trash-auto-cleanup', event => cloudSync.setTrashAutoCleanup(event.detail.autoCleanup));

window.addEventListener('escandidor:trash-emptied', () => {
  cloudSync.emptyTrash();
});

window.addEventListener('escandidor:trash-restored', async (event) => {
  await cloudSync.restoreTrashEntry(event.detail?.trashId);
  await cloudSync.loadFromServer();
});

loadDataFromServer?.addEventListener('click', async () => {
  loadDataFromServer.disabled = true;
  try { await synchronizePoems(); } catch (error) { cloudSaveStatus.textContent = error.message; }
  finally { loadDataFromServer.disabled = !applicationState.auth.user; }
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

keepLocalPoemsSeparate.addEventListener('click', async () => {
  localImportDialog.close();
  await cloudSync.loadFromServer();
});

discardLocalPoems.addEventListener('click', async () => {
  const confirmed = window.confirm(
    '¿Descartar definitivamente los poemas locales de este navegador? Los poemas que ya están en tu cuenta no se borrarán.',
  );
  if (!confirmed) return;
  const discarded = cloudSync.discardAnonymousPoems();
  localImportDialog.close();
  cloudSaveStatus.textContent = `${discarded} poema${discarded === 1 ? '' : 's'} local${discarded === 1 ? '' : 'es'} descartado${discarded === 1 ? '' : 's'}`;
  await cloudSync.loadFromServer();
});

sessionConflictDialog.addEventListener('cancel', (event) => event.preventDefault());

closeOtherSessions.addEventListener('click', async () => {
  closeOtherSessions.disabled = true;
  sessionConflictStatus.textContent = '';
  try {
    await apiRequest('/api/auth/sessions/others', { method: 'DELETE' });
    sessionConflictDialog.close();
    
    const localCount = cloudSync.getAnonymousPoemCount();
    if (localCount > 0) {
      offerLocalImport();
    } else {
      await cloudSync.loadFromServer();
    }
  } catch (error) {
    sessionConflictStatus.textContent = error.message;
  } finally {
    closeOtherSessions.disabled = false;
  }
});

async function checkCurrentSession() {
  if (!applicationState.auth.user || document.hidden) return;
  try {
    const payload = await apiRequest('/api/auth/me');
    if (!payload.user) {
      renderUser(null);
      if (sessionConflictDialog.open) sessionConflictDialog.close();
      openAuth('login');
      authStatus.textContent = 'Esta sesión se cerró desde otro navegador. Inicia sesión de nuevo.';
      return;
    }
    await handleAuthState(payload);
  } catch {}
}

apiRequest('/api/auth/me')
  .then(handleAuthState)
  .catch((error) => {
    cloudSaveStatus.textContent = error.message || 'No se pudo cargar la biblioteca local.';
    cloudSaveStatus.classList.add('is-error');
  });

window.setInterval(checkCurrentSession, 10_000);

const authError = new URL(window.location.href).searchParams.get('auth_error');
if (authError) {
  openAuth('login');
  authStatus.textContent = authError;
  window.history.replaceState({}, '', window.location.pathname + window.location.hash);
}
