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

let authMode = 'login';

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'No se pudo completar la solicitud.');
  return payload;
}

function renderUser(user) {
  guestActions.classList.toggle('hidden', Boolean(user));
  userActions.classList.toggle('hidden', !user);
  accountIdentity.textContent = user ? user.username : '';
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
    renderUser(payload.user);
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

apiRequest('/api/auth/me')
  .then(({ user }) => renderUser(user))
  .catch(() => renderUser(null));

const authError = new URL(window.location.href).searchParams.get('auth_error');
if (authError) {
  openAuth('login');
  authStatus.textContent = authError;
  window.history.replaceState({}, '', window.location.pathname + window.location.hash);
}