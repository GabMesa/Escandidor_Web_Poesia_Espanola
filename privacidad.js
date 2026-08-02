const dataDeletion = document.getElementById('dataDeletion');
const confirmationInput = document.getElementById('deleteDataConfirmation');
const deleteButton = document.getElementById('deleteData');
const status = document.getElementById('deleteDataStatus');

fetch('/api/auth/me', { credentials: 'same-origin' })
  .then((response) => response.ok ? response.json() : null)
  .then((payload) => {
    dataDeletion.hidden = !payload?.user;
  })
  .catch(() => {
    dataDeletion.hidden = true;
  });

confirmationInput?.addEventListener('input', () => {
  deleteButton.disabled = confirmationInput.value.trim() !== 'BORRAR';
});

deleteButton?.addEventListener('click', async () => {
  if (confirmationInput.value.trim() !== 'BORRAR') return;

  const confirmed = window.confirm(
    '¿Borrar definitivamente tu cuenta, poemas sincronizados y datos guardados en este navegador?',
  );
  if (!confirmed) return;

  deleteButton.disabled = true;
  confirmationInput.disabled = true;
  status.textContent = 'Borrando tus datos…';

  try {
    const response = await fetch('/api/auth/account', {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'No se pudieron borrar los datos.');
    }

    localStorage.clear();
    sessionStorage.clear();
    status.textContent = 'Tu cuenta y tus datos se han borrado.';
    confirmationInput.value = '';
    window.setTimeout(() => window.location.assign('index.html'), 1200);
  } catch (error) {
    status.textContent = error.message;
    confirmationInput.disabled = false;
    deleteButton.disabled = confirmationInput.value.trim() !== 'BORRAR';
  }
});