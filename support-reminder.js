const supportReminder = globalThis.document?.getElementById('supportReminder');
const dismissSupportReminder = globalThis.document?.getElementById('dismissSupportReminder');
const supporterCountMessage = globalThis.document?.getElementById('supporterCountMessage');

const DISMISSED_UNTIL_KEY = 'escandador.supportReminderDismissedUntil.v1';
const DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export function formatSupporterMessage(count, supporter = null) {
  if (supporter) {
    return supporter.message || 'Gracias por sostener Escandidor. Tu apoyo hace posible que el proyecto siga creciendo.';
  }

  if (count === 0) {
    return 'Todavía no hay donaciones. Puedes ser la primera persona en apoyar el proyecto.';
  }

  const supporters = count === 1 ? 'cuervo' : 'cuervos';
  return `Este proyecto vuela gracias a ${count} ${supporters} y a la ilusión de su desarrollador.`;
}

async function loadSupporterCount() {
  if (!supporterCountMessage) return;

  try {
    const response = await fetch('/api/supporters');
    if (!response.ok) return;

    const payload = await response.json();
    if (!Number.isInteger(payload.count) || payload.count < 0) return;

    supporterCountMessage.textContent = formatSupporterMessage(payload.count, payload.supporter);
    supporterCountMessage.hidden = false;
  } catch {
    // The support reminder remains useful without the live count.
  }
}

if (supportReminder && dismissSupportReminder) {
  const dismissedUntil = Number(localStorage.getItem(DISMISSED_UNTIL_KEY) || 0);

  if (dismissedUntil > Date.now()) {
    supportReminder.hidden = true;
  }

  dismissSupportReminder.addEventListener('click', () => {
    try {
      localStorage.setItem(DISMISSED_UNTIL_KEY, String(Date.now() + DISMISS_DURATION_MS));
    } catch {
      // The reminder can still be hidden for the current visit.
    }
    supportReminder.hidden = true;
  });

  loadSupporterCount();
}