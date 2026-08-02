function needsSeparator(left, insertedText) {
  return Boolean(left && !/[\s\n]$/.test(left) && !/^[\s\n.,;:!?¡¿]/.test(insertedText));
}

function getPoemLines(text) {
  const normalized = String(text ?? '').replace(/\r\n?/g, '\n').trimEnd();
  return normalized ? normalized.split('\n') : [];
}

function buildLineIndexMap(previousText, nextText) {
  const previousLines = getPoemLines(previousText);
  const nextLines = getPoemLines(nextText);
  const indexMap = new Map();
  let prefixLength = 0;

  while (
    prefixLength < previousLines.length &&
    prefixLength < nextLines.length &&
    previousLines[prefixLength] === nextLines[prefixLength]
  ) {
    indexMap.set(prefixLength, prefixLength);
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < previousLines.length - prefixLength &&
    suffixLength < nextLines.length - prefixLength &&
    previousLines[previousLines.length - 1 - suffixLength] === nextLines[nextLines.length - 1 - suffixLength]
  ) {
    indexMap.set(
      previousLines.length - 1 - suffixLength,
      nextLines.length - 1 - suffixLength
    );
    suffixLength += 1;
  }

  const previousMiddleLength = previousLines.length - prefixLength - suffixLength;
  const nextMiddleLength = nextLines.length - prefixLength - suffixLength;
  const editedLineCount = Math.min(previousMiddleLength, nextMiddleLength);
  for (let offset = 0; offset < editedLineCount; offset += 1) {
    indexMap.set(prefixLength + offset, prefixLength + offset);
  }

  return indexMap;
}

function remapIndexedRecord(record, indexMap) {
  const remapped = {};
  for (const [line, value] of Object.entries(record ?? {})) {
    const previousIndex = Number(line);
    const nextIndex = indexMap.get(previousIndex);
    if (Number.isInteger(nextIndex)) {
      remapped[nextIndex] = value;
    }
  }
  return remapped;
}

export function remapPoemLineSettings(previousText, nextText, settings = {}) {
  const indexMap = buildLineIndexMap(previousText, nextText);
  const sinalefaOverrides = {};

  for (const [key, value] of Object.entries(settings.sinalefaOverrides ?? {})) {
    const match = /^(\d+):(\d+)$/.exec(key);
    const nextIndex = match ? indexMap.get(Number(match[1])) : undefined;
    if (Number.isInteger(nextIndex)) {
      sinalefaOverrides[`${nextIndex}:${match[2]}`] = value;
    }
  }

  return {
    sinalefaOverrides,
    lineOverrides: remapIndexedRecord(settings.lineOverrides, indexMap),
    openAdvancedByLine: remapIndexedRecord(settings.openAdvancedByLine, indexMap)
  };
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

export function cutPoemLine(currentText, cursorPosition) {
  const text = String(currentText ?? '');
  const cursor = Math.max(0, Math.min(Number(cursorPosition) || 0, text.length));
  const lineStart = text.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1;
  const lineEnd = text.indexOf('\n', cursor);

  if (lineEnd >= 0) {
    return {
      text: `${text.slice(0, lineStart)}${text.slice(lineEnd + 1)}`,
      cursor: lineStart,
      cutText: text.slice(lineStart, lineEnd + 1)
    };
  }

  const removalStart = lineStart > 0 ? lineStart - 1 : 0;
  return {
    text: `${text.slice(0, removalStart)}${text.slice(text.length)}`,
    cursor: removalStart,
    cutText: text.slice(lineStart)
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
