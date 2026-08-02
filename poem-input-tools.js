function needsSeparator(left, insertedText) {
  return Boolean(left && !/[\s\n]$/.test(left) && !/^[\s\n.,;:!?¡¿]/.test(insertedText));
}

export function insertPoemText(currentText, selectionStart, selectionEnd, incomingText) {
  const text = String(currentText ?? '');
  const start = Math.max(0, Math.min(Number(selectionStart) || 0, text.length));
  const end = Math.max(start, Math.min(Number(selectionEnd) || start, text.length));
  const incoming = String(incomingText ?? '').trim();

  if (!incoming) {
    return { text, cursor: start };
  }

  const left = text.slice(0, start);
  const right = text.slice(end);
  const separator = needsSeparator(left, incoming) ? ' ' : '';
  const inserted = `${separator}${incoming}`;

  return {
    text: `${left}${inserted}${right}`,
    cursor: left.length + inserted.length
  };
}

export function insertPoemLineBreak(currentText, selectionStart, selectionEnd) {
  const text = String(currentText ?? '');
  const start = Math.max(0, Math.min(Number(selectionStart) || 0, text.length));
  const end = Math.max(start, Math.min(Number(selectionEnd) || start, text.length));
  const left = text.slice(0, start).replace(/[ \t]+$/, '');
  const right = text.slice(end).replace(/^[ \t]+/, '');
  const lineBreak = left.endsWith('\n') || right.startsWith('\n') ? '' : '\n';

  return {
    text: `${left}${lineBreak}${right}`,
    cursor: left.length + lineBreak.length
  };
}

export function getSpeechRecognitionErrorMessage(errorCode) {
  const messages = {
    'audio-capture': 'No se encontró un micrófono disponible.',
    'not-allowed': 'El navegador no tiene permiso para usar el micrófono.',
    'service-not-allowed': 'El navegador bloqueó el servicio de dictado.',
    network: 'El servicio de dictado no está disponible. Prueba la página en Chrome o Edge.',
    'language-not-supported': 'El reconocimiento de voz en español no está disponible.',
    'no-speech': 'No se detectó voz. Acércate al micrófono e inténtalo de nuevo.'
  };

  return messages[String(errorCode ?? '')] ?? 'No se pudo usar el reconocimiento de voz.';
}
