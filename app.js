import {
  analyzePoem,
  normalizeInput,
  analyzeWord,
  adjustPoeticCount,
  isUnstressedMonosyllable,
  normalizeValidationWord,
  normalizeRhymeChunk,
  extractRhymeData,
  extractVowelsForSinalefa
} from './analyzer.js';
import { applicationState, replaceLibraryState } from './application-state.js';
import {
  POETIC_FORM_PRESETS,
  getExpectedSyllableCounts,
  getRhymeSchemeArtRequirement,
  matchesRhymeSchemeArt,
  matchesSyllablePattern,
  parseSyllablePattern
} from './poetic-forms.js';
import {
  cutPoemLine,
  getSpeechRecognitionErrorMessage,
  insertPoemLineBreak,
  insertPoemText,
  remapPoemLineSettings
} from './poem-input-tools.js';

const poemInput = document.getElementById('poemInput');
const analysisOutput = document.getElementById('analysisOutput');
const stressPatternFields = document.getElementById('stressPatternFields');
const poeticForm = document.getElementById('poeticForm');
const syllablePattern = document.getElementById('syllablePattern');
const poeticFormHint = document.getElementById('poeticFormHint');
const hemistichSplit = document.getElementById('hemistichSplit');
const rhymeMode = document.getElementById('rhymeMode');
const rhymeScheme = document.getElementById('rhymeScheme');
const repeatRhymeScheme = document.getElementById('repeatRhymeScheme');
const distinguishSZInRhyme = document.getElementById('distinguishSZInRhyme');
const sinalefaEnabled = document.getElementById('sinalefaEnabled');
const rioplatenseY = document.getElementById('rioplatenseY');
const stanzaSummaryBadge = document.getElementById('stanzaSummaryBadge');
const rhymeSchemeBadge = document.getElementById('rhymeSchemeBadge');
const poemTitle = document.getElementById('poemTitle');
const savePoem = document.getElementById('savePoem');
const currentPoemColorBtn = document.getElementById('currentPoemColorBtn');
const newPoemTop = document.getElementById('newPoemTop');
const newPoemManager = document.getElementById('newPoemManager');
const defaultPoemColorBtn = document.getElementById('defaultPoemColorBtn');
const savedPoemName = document.getElementById('savedPoemName');
const savedPoemVersion = document.getElementById('savedPoemVersion');
const editPoemNameInput = document.getElementById('editPoemNameInput');
const editPoemVersionInput = document.getElementById('editPoemVersionInput');
const editSelectors = document.getElementById('editSelectors');
const saveSelectorEdits = document.getElementById('saveSelectorEdits');
const cancelSelectorEdits = document.getElementById('cancelSelectorEdits');
const openVersionManager = document.getElementById('openVersionManager');
const deletePoemVersion = document.getElementById('deletePoemVersion');
const deleteSelectedVersions = document.getElementById('deleteSelectedVersions');
const savedVersionsList = document.getElementById('savedVersionsList');
const managerShell = document.getElementById('managerShell');
const versionManagerModal = document.getElementById('versionManagerModal');
const closeVersionManager = document.getElementById('closeVersionManager');
const versionManagerStatus = document.getElementById('versionManagerStatus');
const versionSearchInput = document.getElementById('versionSearchInput');
const colorPickerModal = document.getElementById('colorPickerModal');
const colorPickerSwatches = document.getElementById('colorPickerSwatches');
const colorPickerCustom = document.getElementById('colorPickerCustom');
const colorPickerPreview = document.getElementById('colorPickerPreview');
const colorPickerAccept = document.getElementById('colorPickerAccept');
const selectAllVersions = document.getElementById('selectAllVersions');
const downloadSelectedMd = document.getElementById('downloadSelectedMd');
const downloadSelectedPdf = document.getElementById('downloadSelectedPdf');
const deletePoemEntry = document.getElementById('deletePoemEntry');
const poemTrashList = document.getElementById('poemTrashList');
const emptyPoemTrash = document.getElementById('emptyPoemTrash');
const importPoemsMd = document.getElementById('importPoemsMd');
const exportPoemsMd = document.getElementById('exportPoemsMd');
const downloadPoemPdf = document.getElementById('downloadPoemPdf');
const importPoemsFile = document.getElementById('importPoemsFile');
const speechToText = document.getElementById('speechToText');
const imageToText = document.getElementById('imageToText');
const poemImageFile = document.getElementById('poemImageFile');
const captureStatus = document.getElementById('captureStatus');
const analysisModeToggle = document.getElementById('analysisModeToggle');
const analysisTextOutput = document.getElementById('analysisTextOutput');
const copyAnalysisText = document.getElementById('copyAnalysisText');
const fontScaleValue = document.getElementById('fontScaleValue');
const fontSizeDown = document.getElementById('fontSizeDown');
const fontSizeUp = document.getElementById('fontSizeUp');
const defaultPoemFont = document.getElementById('defaultPoemFont');
const poemFontSelectors = [...document.querySelectorAll('.poem-font-selector:not(#defaultPoemFont)')];
const panelViewMode = document.getElementById('panelViewMode');
const wordLookupBar = document.getElementById('wordLookupBar');
const selectedLookupWord = document.getElementById('selectedLookupWord');
const lookupRaeBtn = document.getElementById('lookupRaeBtn');
const lookupRimasBtn = document.getElementById('lookupRimasBtn');
const lookupResults = document.getElementById('lookupResults');
const lookupExcludeCurrentBtn = document.getElementById('lookupExcludeCurrentBtn');
const lookupExcludedBar = document.getElementById('lookupExcludedBar');
const workspace = document.querySelector('.workspace');
const inputPanel = document.querySelector('.input-panel');
const outputPanel = document.querySelector('.output-panel');

const SAMPLE_POEM = `Silba la ciudad durmiente
desde este séptimo piso.
Miro al cielo y no diviso
ni una estrella, como siempre.
Siento el ruido, cómo duermen
más de un millón de almas;
Sueñan pendientes de alarmas
que indican un nuevo día.
Sueñan, quizás, que la vida
es más estrellas que alarmas. `;

const DEFAULT_SEXTINA_SCHEME = 'ABCDEF FAEBDC CFDABE ECBFAD DEACFB BDFECA AB CD EF';

function normalizeRhymeMode(value) {
  if (value === 'consonante') return 'consonante';
  if (value === 'palabra-final' || value === 'sextina') return 'palabra-final';
  return 'asonante';
}

const LOCAL_POEM_MEMORY_KEY = 'escandador.poemMemory.v1';
const LOCAL_UI_PREFERENCES_KEY = 'escandador.uiPreferences.v1';
const LOCAL_POEM_COLORS_KEY = 'escandador.poemColors.v1';
const LOCAL_RHYME_COLORS_KEY = 'escandador.rhymeColors.v1';
const LOCAL_DEFAULT_POEM_COLOR_KEY = 'escandador.defaultPoemColor.v1';
const LOCAL_DEFAULT_POEM_FONT_KEY = 'escandador.defaultPoemFont.v1';
const LOCAL_LAST_WORKED_POEM_KEY = 'escandador.lastWorkedPoem.v1';
const POEM_COLOR_COUNT = 6;
const COLOR_PICKER_PALETTE = [
  '#e05a4d', '#e8823a', '#e7b83b', '#a7c145',
  '#4fae5a', '#3fb1a0', '#3f96c8', '#3f66c8',
  '#6a5ae0', '#9b52d8', '#c94fb0', '#d8477a',
  '#8a5a44', '#6b7280', '#2f8f8a', '#1f2933'
];
const AUTO_SAVE_DELAY_MS = 1200;
const TRASH_LIMIT = 10;
const LOOKUP_AUTO_FETCH_DELAY_MS = 420;
const LOOKUP_WIKTIONARY_BASE_URL = 'https://es.wiktionary.org/wiki/';
const LOOKUP_WIKTIONARY_API_BASE_URL = 'https://es.wiktionary.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&origin=*&titles=';
const OPEN_SYNONYMS_SOURCE_URL = 'https://cdn.jsdelivr.net/gh/edublancas/sinonimos@master/sinonimos.json';
const WORDFREQ_SOURCE_URL = 'https://raw.githubusercontent.com/rspeer/wordfreq/master/wordfreq/data/large_es.msgpack.gz';
const TESSERACT_CDN_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/+esm';
const VOSK_SCRIPT_URL = './vendor/vosk/vosk.js';
const VOSK_SPANISH_MODEL_PART_URLS = [
  './vendor/vosk/model/vosk-model-small-es-0.42.tar.gz.part-01',
  './vendor/vosk/model/vosk-model-small-es-0.42.tar.gz.part-02'
];

const state = applicationState.editor;

const LOOKUP_RHYME_PAGE_SIZE = 24;
const LOOKUP_WORD_TYPE_CACHE_KEY = 'escandador.lookupWordTypeCache.v1';
const WORDFREQ_WORDS_CACHE_KEY = 'escandador.wordfreqWords.v1';
const WORDFREQ_QUERY_CACHE_KEY = 'escandador.wordfreqQueries.v1';
const LOOKUP_WORD_TYPE_BATCH_CONCURRENCY = 4;
const LOOKUP_WORD_TYPE_SCAN_BATCH_SIZE = 24;

let lastRuntime = [];
let autoSaveTimer = null;
let toastTimer = null;
let selectedVersionIds = new Set();
let lookupAutoFetchTimer = null;
let speechRecognition = null;
let isSpeechRecognitionActive = false;
let isSpeechRecognitionStarting = false;
let shouldContinueSpeechRecognition = false;
let speechRecognitionReceivedText = false;
let speechRecognitionHadError = false;
let voskScriptPromise = null;
let voskModelPromise = null;
let previousPoemText = '';
let voskSession = null;
let tesseractModulePromise = null;
function loadLookupWordTypeCache() {
  try {
    const raw = localStorage.getItem(LOOKUP_WORD_TYPE_CACHE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveLookupWordTypeCache() {
  try {
    localStorage.setItem(LOOKUP_WORD_TYPE_CACHE_KEY, JSON.stringify(lookupWordTypeCache));
  } catch {
    // Ignore storage failures; classification can still run without persistence.
  }
}

let lookupWordTypeCache = loadLookupWordTypeCache();
state.lookupVisibleWordTypes = lookupWordTypeCache;
let openSynonymsIndex = null;
let openSynonymsIndexPromise = null;
let openFrequencyIndex = null;
let openFrequencyIndexPromise = null;
let openRhymeLexicon = null;
let openRhymeLexiconPromise = null;
let wordfreqWordsPromise = null;
let openWordResourcesPromise = null;
let wordCorpusLoadingMessage = '';
let wordfreqWorker = null;
let wordfreqWorkerRequestId = 0;
const wordfreqWorkerRequests = new Map();
const wordfreqQueryPromises = new Map();

function loadWordfreqQueryCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WORDFREQ_QUERY_CACHE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const wordfreqQueryCache = loadWordfreqQueryCache();

function saveWordfreqQueryCache() {
  try {
    localStorage.setItem(WORDFREQ_QUERY_CACHE_KEY, JSON.stringify(wordfreqQueryCache));
  } catch {
    // Queries still work when storage is unavailable.
  }
}

function getWordfreqWorker() {
  if (!wordfreqWorker) {
    wordfreqWorker = new Worker('./wordfreq-worker.js', { type: 'module' });
    wordfreqWorker.addEventListener('message', ({ data }) => {
      const pending = wordfreqWorkerRequests.get(data.requestId);
      if (!pending) return;
      if (data.type === 'progress') {
        setWordCorpusLoadingMessage(data.message);
        return;
      }
      wordfreqWorkerRequests.delete(data.requestId);
      setWordCorpusLoadingMessage('');
      if (data.type === 'error') pending.reject(new Error(data.message));
      else pending.resolve({ candidates: data.candidates ?? [], rank: data.rank ?? 0 });
    });
  }
  return wordfreqWorker;
}

function queryWordfreq(targetWord) {
  const comparable = normalizeLookupComparable(targetWord);
  if (!comparable) return Promise.resolve({ candidates: [], rank: 0 });
  if (wordfreqQueryCache[comparable]) return Promise.resolve(wordfreqQueryCache[comparable]);
  if (wordfreqQueryPromises.has(comparable)) return wordfreqQueryPromises.get(comparable);

  const targetData = extractWordRhymeData(targetWord);
  const requestId = ++wordfreqWorkerRequestId;
  const request = new Promise((resolve, reject) => {
    wordfreqWorkerRequests.set(requestId, { resolve, reject });
    getWordfreqWorker().postMessage({
      requestId,
      word: targetWord,
      consonantKey: targetData.consonantKey,
      assonantKey: targetData.assonantKey
    });
  }).then((result) => {
    wordfreqQueryCache[comparable] = result;
    saveWordfreqQueryCache();
    return result;
  }).finally(() => wordfreqQueryPromises.delete(comparable));

  wordfreqQueryPromises.set(comparable, request);
  return request;
}

function loadPoemColors() {
  try {
    const raw = localStorage.getItem(LOCAL_POEM_COLORS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function savePoemColor(poemTitle, colorIndex) {
  try {
    const colors = loadPoemColors();
    colors[poemTitle] = colorIndex;
    localStorage.setItem(LOCAL_POEM_COLORS_KEY, JSON.stringify(colors));
  } catch { /* ignore */ }
}

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function setPoemCustomColor(poemTitle, colorHex) {
  const normalizedTitle = normalizePoemTitle(poemTitle);
  const normalizedColor = String(colorHex ?? '').trim();
  if (!normalizedTitle || !isHexColor(normalizedColor)) {
    return;
  }

  try {
    const colors = loadPoemColors();
    colors[normalizedTitle] = normalizedColor;
    localStorage.setItem(LOCAL_POEM_COLORS_KEY, JSON.stringify(colors));
  } catch { /* ignore */ }
}

function removePoemCustomColor(poemTitle) {
  const normalizedTitle = normalizePoemTitle(poemTitle);
  if (!normalizedTitle) {
    return;
  }

  try {
    const colors = loadPoemColors();
    if (!Object.prototype.hasOwnProperty.call(colors, normalizedTitle)) {
      return;
    }
    delete colors[normalizedTitle];
    localStorage.setItem(LOCAL_POEM_COLORS_KEY, JSON.stringify(colors));
  } catch { /* ignore */ }
}

function loadDefaultPoemColor() {
  try {
    const raw = localStorage.getItem(LOCAL_DEFAULT_POEM_COLOR_KEY);
    return isHexColor(raw) ? String(raw).trim() : '';
  } catch {
    return '';
  }
}

function saveDefaultPoemColor(colorHex) {
  const normalized = String(colorHex ?? '').trim();
  if (!isHexColor(normalized)) {
    return;
  }
  try {
    localStorage.setItem(LOCAL_DEFAULT_POEM_COLOR_KEY, normalized);
  } catch { /* ignore */ }
}

function clearDefaultPoemColor() {
  try {
    localStorage.removeItem(LOCAL_DEFAULT_POEM_COLOR_KEY);
  } catch { /* ignore */ }
}

function updateDefaultColorButton() {
  if (!defaultPoemColorBtn) {
    return;
  }
  const swatch = defaultPoemColorBtn.querySelector('.default-color-swatch');
  const color = loadDefaultPoemColor();
  if (swatch) {
    swatch.style.background = isHexColor(color) ? color : 'transparent';
  }
}

function updateCurrentPoemColorButton(activeTitle = '') {
  if (!currentPoemColorBtn) {
    return;
  }

  const title = normalizePoemTitle(activeTitle || poemTitle?.value || savedPoemName?.value || state.currentAnalysisTitle || '');
  const savedColor = loadPoemColors()[title];
  const colorHex = isHexColor(savedColor) ? String(savedColor).trim() : getPoemColorHex(0);

  currentPoemColorBtn.style.background = colorHex;
  currentPoemColorBtn.style.borderColor = toRgba(colorHex, 0.45);
  currentPoemColorBtn.dataset.title = title;
}

function applyPoemScreenTheme(poemTitle) {
  const normalizedTitle = normalizePoemTitle(poemTitle);
  const stored = normalizedTitle ? loadPoemColors()[normalizedTitle] : '';
  const colorHex = isHexColor(stored) ? String(stored).trim() : '';

  if (colorHex) {
    document.documentElement.style.setProperty('--poem-color', colorHex);
    document.body.classList.add('has-poem-theme');
  } else {
    document.documentElement.style.removeProperty('--poem-color');
    document.body.classList.remove('has-poem-theme');
  }

  updateCurrentPoemColorButton(normalizedTitle);
}

function applyPoemColorTheme(node, colorValue, fallbackIndex = 0) {
  if (!(node instanceof HTMLElement)) {
    return { isCustom: false, colorHex: getPoemColorHex(fallbackIndex) };
  }

  const customColor = isHexColor(colorValue) ? String(colorValue).trim() : '';
  if (customColor) {
    node.classList.remove(...[...node.classList].filter((className) => className.startsWith('poem-color-') && className !== 'poem-color-custom'));
    node.classList.add('poem-color-custom');
    node.style.setProperty('--poem-accent', customColor);
    node.style.setProperty('--poem-accent-soft', toRgba(customColor, 0.12));
    node.style.setProperty('--poem-accent-soft-2', toRgba(customColor, 0.35));
    node.style.setProperty('--poem-accent-soft-3', toRgba(customColor, 0.18));
    return { isCustom: true, colorHex: customColor };
  }

  const defaultHex = getPoemColorHex(fallbackIndex);
  node.classList.remove('poem-color-custom');
  for (let index = 0; index < POEM_COLOR_COUNT; index += 1) {
    node.classList.remove(`poem-color-${index}`);
  }
  node.classList.add(`poem-color-${fallbackIndex % POEM_COLOR_COUNT}`);
  node.style.removeProperty('--poem-accent');
  node.style.removeProperty('--poem-accent-soft');
  node.style.removeProperty('--poem-accent-soft-2');
  node.style.removeProperty('--poem-accent-soft-3');
  return { isCustom: false, colorHex: defaultHex };
}

function loadRhymeColors() {
  try {
    const raw = localStorage.getItem(LOCAL_RHYME_COLORS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const normalized = {};
    for (const [poemTitle, poemStore] of Object.entries(parsed)) {
      if (!poemStore || typeof poemStore !== 'object' || Array.isArray(poemStore)) {
        continue;
      }

      const colors = {};
      const rawColors = poemStore.colors && typeof poemStore.colors === 'object' ? poemStore.colors : {};
      for (const [label, colorHex] of Object.entries(rawColors)) {
        if (isHexColor(colorHex)) {
          colors[label] = colorHex.trim();
        }
      }

      normalized[poemTitle] = {
        nextIndex: Number.isFinite(poemStore.nextIndex) ? poemStore.nextIndex : 0,
        colors
      };
    }

    return normalized;
  } catch {
    return {};
  }
}

function saveRhymeColors(store) {
  try {
    localStorage.setItem(LOCAL_RHYME_COLORS_KEY, JSON.stringify(store));
  } catch { /* ignore */ }
}

function clampColorChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hslToHex(h, s, l) {
  const saturation = s / 100;
  const lightness = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const f = (n) => {
    const color = lightness - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return clampColorChannel(color * 255);
  };
  return `#${[f(0), f(8), f(4)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex) {
  const normalized = String(hex ?? '').trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  };
}

function toRgba(hex, alpha) {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return `rgba(49, 92, 102, ${alpha})`;
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function getReadableTextColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return '#ffffff';
  }

  const luminance = ((rgb.r * 299) + (rgb.g * 587) + (rgb.b * 114)) / 1000;
  return luminance > 148 ? '#1f1a15' : '#ffffff';
}

function generateDistinctRhymeColor(index) {
  const hue = (index * 137.508) % 360;
  const saturation = 66;
  const lightness = 45 + ((index % 3) * 6) - 3;
  return hslToHex(hue, saturation, lightness);
}

function getPoemColorHex(colorValue) {
  if (typeof colorValue === 'string' && /^#[0-9a-fA-F]{6}$/.test(colorValue)) {
    return colorValue;
  }

  if (Number.isInteger(colorValue)) {
    const palette = [
      '#4b7f8f', '#8a5a44', '#498a55', '#af7f2b', '#a05364', '#2f8f8a'
    ];
    return palette[colorValue % palette.length];
  }

  return '#4b7f8f';
}

function ensureRhymeColorStoreForPoem(poemTitle, labels) {
  const normalizedTitle = normalizePoemTitle(poemTitle);
  if (!normalizedTitle || !Array.isArray(labels) || !labels.length) {
    return;
  }

  const store = loadRhymeColors();
  if (!store[normalizedTitle] || typeof store[normalizedTitle] !== 'object') {
    store[normalizedTitle] = { nextIndex: 0, colors: {} };
  }

  const poemStore = store[normalizedTitle];
  if (!poemStore.colors || typeof poemStore.colors !== 'object') {
    poemStore.colors = {};
  }

  for (const label of labels) {
    const key = String(label ?? '').trim();
    if (!key || poemStore.colors[key]) {
      continue;
    }

    poemStore.colors[key] = generateDistinctRhymeColor(poemStore.nextIndex ?? 0);
    poemStore.nextIndex = (poemStore.nextIndex ?? 0) + 1;
  }

  saveRhymeColors(store);
}

function getRhymeColor(poemTitle, label) {
  const normalizedTitle = normalizePoemTitle(poemTitle);
  const key = String(label ?? '').trim();
  if (!normalizedTitle || !key) {
    return getPoemColorHex();
  }

  const store = loadRhymeColors();
  const poemStore = store[normalizedTitle];
  return getPoemColorHex(poemStore?.colors?.[key]);
}

function setRhymeColor(poemTitle, label, colorHex) {
  const normalizedTitle = normalizePoemTitle(poemTitle);
  const key = String(label ?? '').trim();
  const normalizedColor = String(colorHex ?? '').trim();
  if (!normalizedTitle || !key || !/^#[0-9a-fA-F]{6}$/.test(normalizedColor)) {
    return;
  }

  const store = loadRhymeColors();
  if (!store[normalizedTitle] || typeof store[normalizedTitle] !== 'object') {
    store[normalizedTitle] = { nextIndex: 0, colors: {} };
  }

  const poemStore = store[normalizedTitle];
  poemStore.colors = poemStore.colors && typeof poemStore.colors === 'object' ? poemStore.colors : {};
  poemStore.colors[key] = normalizedColor;
  saveRhymeColors(store);
}

function removeRhymeColor(poemTitle, label) {
  const normalizedTitle = normalizePoemTitle(poemTitle);
  const key = String(label ?? '').trim();
  if (!normalizedTitle || !key) {
    return;
  }

  const store = loadRhymeColors();
  const poemStore = store[normalizedTitle];
  if (!poemStore?.colors || typeof poemStore.colors !== 'object') {
    return;
  }

  if (!Object.prototype.hasOwnProperty.call(poemStore.colors, key)) {
    return;
  }

  delete poemStore.colors[key];
  saveRhymeColors(store);
}

function renamePoemColorKey(sourceTitle, targetTitle) {
  const fromTitle = normalizePoemTitle(sourceTitle);
  const toTitle = normalizePoemTitle(targetTitle);
  if (!fromTitle || !toTitle || fromTitle === toTitle) {
    return;
  }

  try {
    const colors = loadPoemColors();
    const hasSource = Object.prototype.hasOwnProperty.call(colors, fromTitle);
    const hasTarget = Object.prototype.hasOwnProperty.call(colors, toTitle);
    if (!hasSource) {
      return;
    }

    if (!hasTarget) {
      colors[toTitle] = colors[fromTitle];
    }

    delete colors[fromTitle];
    localStorage.setItem(LOCAL_POEM_COLORS_KEY, JSON.stringify(colors));
  } catch {
    // Ignore storage errors to avoid blocking rename flows.
  }
}

function renameRhymeColorStoreKey(sourceTitle, targetTitle) {
  const fromTitle = normalizePoemTitle(sourceTitle);
  const toTitle = normalizePoemTitle(targetTitle);
  if (!fromTitle || !toTitle || fromTitle === toTitle) {
    return;
  }

  const store = loadRhymeColors();
  const fromStore = store[fromTitle];
  if (!fromStore || typeof fromStore !== 'object') {
    return;
  }

  const targetStore = store[toTitle] && typeof store[toTitle] === 'object'
    ? store[toTitle]
    : { nextIndex: 0, colors: {} };

  const targetColors = targetStore.colors && typeof targetStore.colors === 'object' ? targetStore.colors : {};
  const fromColors = fromStore.colors && typeof fromStore.colors === 'object' ? fromStore.colors : {};

  for (const [label, colorHex] of Object.entries(fromColors)) {
    if (!Object.prototype.hasOwnProperty.call(targetColors, label) && isHexColor(colorHex)) {
      targetColors[label] = colorHex;
    }
  }

  targetStore.colors = targetColors;
  targetStore.nextIndex = Math.max(Number(targetStore.nextIndex) || 0, Number(fromStore.nextIndex) || 0);
  store[toTitle] = targetStore;
  delete store[fromTitle];
  saveRhymeColors(store);
}

function openRhymeColorSelector(button) {
  if (!(button instanceof HTMLElement)) {
    return;
  }

  const rhymeLabel = String(button.dataset.rhymeLabel ?? '').trim();
  const rhymePoem = String(button.dataset.rhymePoem ?? state.currentAnalysisTitle ?? '').trim();
  const currentHex = String(button.dataset.color ?? '').trim();
  if (!rhymeLabel || !rhymePoem) {
    return;
  }

  openColorPicker({
    title: `Color de la rima ${rhymeLabel}`,
    current: isHexColor(currentHex) ? currentHex : getRhymeColor(rhymePoem, rhymeLabel),
    showDefaultAction: true,
    onAccept: (colorHex) => {
      setRhymeColor(rhymePoem, rhymeLabel, colorHex);
      updateAnalysis();
      showToast(`Color de la rima ${rhymeLabel} actualizado.`, 'success');
    },
    onDefault: () => {
      removeRhymeColor(rhymePoem, rhymeLabel);
      updateAnalysis();
      showToast(`Rima ${rhymeLabel} restablecida al color por defecto.`, 'success');
    }
  });
}

window.openRhymeColorSelector = openRhymeColorSelector;

let colorPickerState = {
  selected: '',
  onAccept: null,
  onDefault: null,
  showDefaultAction: false,
  keyHandler: null
};

function renderColorPickerSwatches(selectedHex) {
  if (!colorPickerSwatches) {
    return;
  }

  colorPickerSwatches.innerHTML = '';
  const normalizedSelected = String(selectedHex ?? '').trim().toLowerCase();

  for (const color of COLOR_PICKER_PALETTE) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'color-picker-swatch';
    swatch.style.background = color;
    swatch.dataset.color = color;
    swatch.title = color;
    swatch.setAttribute('role', 'option');
    swatch.setAttribute('aria-label', color);
    if (color.toLowerCase() === normalizedSelected) {
      swatch.classList.add('is-selected');
      swatch.setAttribute('aria-selected', 'true');
    }
    colorPickerSwatches.appendChild(swatch);
  }

  if (colorPickerState.showDefaultAction) {
    const defaultSwatch = document.createElement('button');
    defaultSwatch.type = 'button';
    defaultSwatch.className = 'color-picker-swatch color-picker-swatch-default';
    defaultSwatch.dataset.action = 'default';
    defaultSwatch.title = 'Por defecto';
    defaultSwatch.setAttribute('role', 'option');
    defaultSwatch.setAttribute('aria-label', 'Por defecto');
    defaultSwatch.textContent = 'Por defecto';
    colorPickerSwatches.appendChild(defaultSwatch);
  }
}

function setColorPickerSelection(colorHex) {
  const normalized = isHexColor(colorHex) ? colorHex.trim() : colorPickerState.selected;
  colorPickerState.selected = normalized;

  if (colorPickerCustom) {
    colorPickerCustom.value = normalized;
  }

  if (colorPickerPreview) {
    colorPickerPreview.style.background = normalized;
    colorPickerPreview.textContent = normalized.toUpperCase();
    colorPickerPreview.style.color = getReadableTextColor(normalized);
  }

  if (colorPickerSwatches) {
    const lower = normalized.toLowerCase();
    colorPickerSwatches.querySelectorAll('.color-picker-swatch').forEach((swatch) => {
      const isMatch = String(swatch.dataset.color ?? '').toLowerCase() === lower;
      swatch.classList.toggle('is-selected', isMatch);
      swatch.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });
  }
}

function closeColorPicker() {
  if (!colorPickerModal) {
    return;
  }

  colorPickerModal.classList.remove('is-open');
  colorPickerModal.setAttribute('aria-hidden', 'true');
  colorPickerState.onAccept = null;
  colorPickerState.onDefault = null;
  colorPickerState.showDefaultAction = false;

  if (colorPickerState.keyHandler) {
    document.removeEventListener('keydown', colorPickerState.keyHandler);
    colorPickerState.keyHandler = null;
  }
}

function openColorPicker({ title, current, onAccept, onDefault, showDefaultAction = false }) {
  if (!colorPickerModal) {
    return;
  }

  const startColor = isHexColor(current) ? current.trim() : '#4b7f8f';
  const titleEl = document.getElementById('colorPickerTitle');
  if (titleEl && title) {
    titleEl.textContent = title;
  }

  colorPickerState.onAccept = typeof onAccept === 'function' ? onAccept : null;
  colorPickerState.onDefault = typeof onDefault === 'function' ? onDefault : null;
  colorPickerState.showDefaultAction = Boolean(showDefaultAction);
  renderColorPickerSwatches(startColor);
  setColorPickerSelection(startColor);

  colorPickerModal.classList.add('is-open');
  colorPickerModal.setAttribute('aria-hidden', 'false');

  colorPickerState.keyHandler = (event) => {
    if (event.key === 'Escape') {
      closeColorPicker();
    } else if (event.key === 'Enter') {
      confirmColorPicker();
    }
  };
  document.addEventListener('keydown', colorPickerState.keyHandler);
}

function applyDefaultColorPicker() {
  const applyDefault = colorPickerState.onDefault;
  closeColorPicker();
  if (applyDefault) {
    applyDefault();
  }
}

function confirmColorPicker() {
  const accept = colorPickerState.onAccept;
  const color = colorPickerState.selected;
  closeColorPicker();
  if (accept && isHexColor(color)) {
    accept(color);
  }
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function extractLookupWord(rawText) {
  const text = String(rawText ?? '').trim();
  if (!text) {
    return '';
  }

  const match = text.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:['’-][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*/u);
  if (!match) {
    return '';
  }

  return match[0].toLowerCase();
}

function refreshLookupBar() {
  const hasWord = Boolean(state.selectedLookupWord);
  const configuredRhymeMode = normalizeRhymeMode(rhymeMode?.value);

  if (wordLookupBar) {
    wordLookupBar.classList.toggle('is-active', hasWord);
  }

  if (selectedLookupWord) {
    selectedLookupWord.value = hasWord ? state.selectedLookupWord : '';
  }

  if (lookupRaeBtn) {
    lookupRaeBtn.disabled = !hasWord;
  }

  if (lookupRimasBtn) {
    lookupRimasBtn.disabled = !hasWord;
    lookupRimasBtn.textContent = 'On change';
    lookupRimasBtn.title = `Rimas en actualización automática (${configuredRhymeMode})`;
  }

  if (lookupRaeBtn) {
    lookupRaeBtn.textContent = 'On change';
    lookupRaeBtn.title = 'Definición en actualización automática (Wikcionario)';
  }

  if (lookupExcludeCurrentBtn) {
    lookupExcludeCurrentBtn.hidden = !isAsonanteRhymeMode();
  }

  renderLookupExcludedBar();
  renderLookupResults();
}

function queueLookupAutoFetch() {
  if (lookupAutoFetchTimer) {
    clearTimeout(lookupAutoFetchTimer);
    lookupAutoFetchTimer = null;
  }

  if (!state.selectedLookupWord) {
    return;
  }

  lookupAutoFetchTimer = setTimeout(() => {
    lookupAutoFetchTimer = null;
    openWiktionaryDefinition();
    openOpenDataRhymesFromConfig();
  }, LOOKUP_AUTO_FETCH_DELAY_MS);
}

function setSelectedLookupWord(rawWord) {
  const nextWord = extractLookupWord(rawWord);
  if (state.selectedLookupWord === nextWord) {
    return;
  }

  state.selectedLookupWord = nextWord;
  state.lookupDefinition = '';
  state.lookupFrequency = '';
  state.lookupSynonyms = [];
  state.lookupRhymeCandidates = [];
  state.lookupRhymes = [];
  state.lookupError = '';
  state.lookupLoadingDefinition = false;
  state.lookupLoadingRhymes = false;
  state.lookupDefinitionRequestId += 1;
  state.lookupRhymeRequestId += 1;
  refreshLookupBar();

  if (nextWord) {
    queueLookupAutoFetch();
  }
}

function getTextSelectionWithinElement(element) {
  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount === 0) {
    return '';
  }

  const selectedText = String(selection.toString() ?? '').trim();
  if (!selectedText) {
    return '';
  }

  const anchorNode = selection.anchorNode;
  if (!anchorNode || !(element instanceof Element)) {
    return '';
  }

  const container = anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode;
  if (!(container instanceof Node) || !element.contains(container)) {
    return '';
  }

  return selectedText;
}

function syncLookupWordFromPoemInput() {
  if (!(poemInput instanceof HTMLTextAreaElement)) {
    return;
  }

  const start = poemInput.selectionStart;
  const end = poemInput.selectionEnd;

  if (!Number.isInteger(start) || !Number.isInteger(end) || start === end) {
    return;
  }

  const selectedText = poemInput.value.slice(start, end);
  setSelectedLookupWord(selectedText);
}

function syncLookupWordFromAnalysisSelection() {
  const selectedText = getTextSelectionWithinElement(analysisOutput);
  if (!selectedText) {
    return;
  }

  setSelectedLookupWord(selectedText);
}

function openLookupUrl(url, errorMessage = 'No se pudo abrir el enlace.') {
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    showToast(errorMessage, 'warning');
  }
}

function normalizeLookupComparable(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zñü]/g, '');
}

function cleanMarkdownText(value) {
  return String(value ?? '')
    .replace(/!\[[^\]]*\]\([^\)]+\)/g, ' ')
    .replace(/\[editar\]/gi, ' ')
    .replace(/\[\[?\d+\]?\]\([^\)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/[_*`>#]+/g, ' ')
    .replace(/[¦|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractWordRhymeData(word) {
  const analysis = analyzeWord(String(word ?? '').trim());
  if (!analysis || !Array.isArray(analysis.syllables) || !analysis.syllables.length) {
    return {
      consonantKey: '-',
      assonantKey: '-',
      finalWordKey: normalizeValidationWord(word)
    };
  }

  return extractRhymeData(
    { analyses: [analysis] },
    { distinguishSZInRhyme: state.distinguishSZInRhyme }
  );
}

async function fetchLookupSourceText(targetUrl) {
  const errors = [];

  const decodeSourceBuffer = async (response) => {
    const buffer = await response.arrayBuffer();
    const utf8Text = new TextDecoder('utf-8').decode(buffer);
    const windowsText = new TextDecoder('windows-1252').decode(buffer);
    const utf8ReplacementCount = (utf8Text.match(/\uFFFD/g) || []).length;
    const windowsReplacementCount = (windowsText.match(/\uFFFD/g) || []).length;
    if (windowsReplacementCount < utf8ReplacementCount) {
      return windowsText;
    }
    return utf8Text;
  };

  try {
    const directResponse = await fetch(targetUrl, {
      headers: {
        Accept: 'text/plain, text/markdown;q=0.9, */*;q=0.8'
      }
    });

    if (directResponse.ok) {
      const directText = await decodeSourceBuffer(directResponse);
      if (directText && directText.length > 120) {
        return directText;
      }
      errors.push(`${targetUrl} -> respuesta vacía`);
    } else {
      errors.push(`${targetUrl} -> ${directResponse.status}`);
    }
  } catch (error) {
    errors.push(`${targetUrl} -> ${String(error?.message ?? error)}`);
  }

  throw new Error(`No se pudo descargar la fuente directamente. ${errors[0] ?? ''}`.trim());
}

function splitOpenCorpusTerms(value) {
  return String(value ?? '')
    .replace(/[\u2013\u2014]/g, ',')
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonWithLoosePayload(rawSource) {
  const raw = String(rawSource ?? '').replace(/^\uFEFF/, '').trim();
  if (!raw) {
    throw new Error('La respuesta de datos abiertos está vacía.');
  }

  const directCandidate = raw;
  const fencedCandidate = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  const bracketStart = raw.indexOf('[');
  const bracketEnd = raw.lastIndexOf(']');
  const bracketCandidate = bracketStart >= 0 && bracketEnd > bracketStart
    ? raw.slice(bracketStart, bracketEnd + 1).trim()
    : '';
  const braceStart = raw.indexOf('{');
  const braceEnd = raw.lastIndexOf('}');
  const braceCandidate = braceStart >= 0 && braceEnd > braceStart
    ? raw.slice(braceStart, braceEnd + 1).trim()
    : '';

  const candidates = [directCandidate, fencedCandidate, bracketCandidate, braceCandidate].filter(Boolean);
  const seen = new Set();

  for (const candidate of candidates) {
    if (seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);

    try {
      return JSON.parse(candidate);
    } catch {
      // Intentionally keep trying with looser payload candidates.
    }
  }

  throw new Error('No se pudo interpretar el JSON del corpus abierto.');
}

function addComparableWordToRhymeLexicon(store, rawWord) {
  const comparable = normalizeLookupComparable(rawWord);
  if (!comparable || comparable.length < 2) {
    return;
  }

  const normalizedWord = String(rawWord ?? '').trim().toLowerCase();
  for (let size = 2; size <= Math.min(5, comparable.length); size += 1) {
    const suffix = comparable.slice(-size);
    if (!store.has(suffix)) {
      store.set(suffix, new Set());
    }
    store.get(suffix).add(normalizedWord);
  }
}

function buildOpenSynonymsResources(sourceText) {
  const parsed = parseJsonWithLoosePayload(sourceText);
  const synonymGroupMap = new Map();

  if (!Array.isArray(parsed)) {
    return { synonymGroupMap };
  }

  for (const entry of parsed) {
    if (!Array.isArray(entry) || !entry.length) {
      continue;
    }

    const headTerms = splitOpenCorpusTerms(entry[0]);
    const synonymTerms = entry.slice(1).flatMap(splitOpenCorpusTerms);
    const allTerms = [...headTerms, ...synonymTerms]
      .map((term) => ({
        raw: String(term).trim().toLowerCase(),
        comparable: normalizeLookupComparable(term)
      }))
      .filter((term) => term.comparable);

    const normalizedTerms = [];
    const seenComparables = new Set();
    for (const term of allTerms) {
      if (seenComparables.has(term.comparable)) {
        continue;
      }
      seenComparables.add(term.comparable);
      normalizedTerms.push(term);
    }

    if (!normalizedTerms.length) {
      continue;
    }

    const group = normalizedTerms.map((term) => term.raw);
    const groupKey = normalizedTerms.map((term) => term.comparable).sort().join('|');
    if (!groupKey) {
      continue;
    }

    for (const currentTerm of normalizedTerms) {
      const currentComparable = currentTerm.comparable;
      if (!currentComparable) {
        continue;
      }

      if (!synonymGroupMap.has(currentComparable)) {
        synonymGroupMap.set(currentComparable, []);
      }

      const current = synonymGroupMap.get(currentComparable);
      const alreadyStored = current.some((storedGroup) => Array.isArray(storedGroup) && storedGroup._groupKey === groupKey);
      if (alreadyStored) {
        continue;
      }

      const renderedGroup = [...group];
      renderedGroup._groupKey = groupKey;
      current.push(renderedGroup);
    }
  }

  return { synonymGroupMap };
}

function buildOpenFrequencyResources(words) {
  const index = new Map();
  const orderedWords = [];
  const rhymeLexicon = new Map();
  let rank = 0;

  for (const rawWord of words) {
    const word = String(rawWord ?? '').trim().toLowerCase();
    const comparable = normalizeLookupComparable(word);
    if (!comparable || index.has(comparable)) {
      continue;
    }

    rank += 1;
    index.set(comparable, rank);
    orderedWords.push(word);

    for (let size = 2; size <= Math.min(5, comparable.length); size += 1) {
      const suffix = comparable.slice(-size);
      if (!rhymeLexicon.has(suffix)) {
        rhymeLexicon.set(suffix, []);
      }
      rhymeLexicon.get(suffix).push(word);
    }
  }

  return { index, orderedWords, rhymeLexicon };
}

function yieldToBrowser() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function setWordCorpusLoadingMessage(message) {
  wordCorpusLoadingMessage = message;
  if (state.lookupLoadingDefinition || state.lookupLoadingRhymes) {
    renderLookupResults();
  }
}

function loadCachedWordfreqBuckets() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WORDFREQ_WORDS_CACHE_KEY) ?? 'null');
    return parsed?.version === 1 && Array.isArray(parsed.buckets) ? parsed.buckets : null;
  } catch {
    return null;
  }
}

function saveCachedWordfreqBuckets(buckets) {
  try {
    localStorage.setItem(WORDFREQ_WORDS_CACHE_KEY, JSON.stringify({ version: 1, buckets }));
  } catch {
    // The corpus still works when the browser storage quota is unavailable.
  }
}

function buildOpenRhymeWordlistResources(words) {
  const rhymeLexicon = new Map();
  const assonantLexicon = new Map();
  const seenComparables = new Set();

  for (const rawWord of words) {
    const word = String(rawWord ?? '').trim().toLowerCase();
    const comparable = normalizeLookupComparable(word);
    if (!comparable || comparable.length < 2 || seenComparables.has(comparable)) {
      continue;
    }

    seenComparables.add(comparable);
    for (let size = 2; size <= Math.min(5, comparable.length); size += 1) {
      const suffix = comparable.slice(-size);
      if (!rhymeLexicon.has(suffix)) {
        rhymeLexicon.set(suffix, []);
      }
      rhymeLexicon.get(suffix).push(word);
    }

    const assonantKey = extractWordRhymeData(word).assonantKey;
    if (assonantKey && assonantKey !== '-') {
      if (!assonantLexicon.has(assonantKey)) {
        assonantLexicon.set(assonantKey, []);
      }
      assonantLexicon.get(assonantKey).push(word);
    }
  }

  return { rhymeLexicon, assonantLexicon };
}

async function loadWordfreqWords() {
  if (!wordfreqWordsPromise) {
    wordfreqWordsPromise = (async () => {
      const cachedBuckets = loadCachedWordfreqBuckets();
      if (cachedBuckets) {
        setWordCorpusLoadingMessage('Procesando palabras guardadas...');
        return cachedBuckets;
      }

      setWordCorpusLoadingMessage('Descargando palabras...');
      const response = await fetch(WORDFREQ_SOURCE_URL);
      if (!response.ok) {
        throw new Error(`No se pudo descargar wordfreq: HTTP ${response.status}`);
      }

      const compressed = new Uint8Array(await response.arrayBuffer());
      const data = decodeMessagePack(decompressSync(compressed));
      const header = data?.[0];
      if (!Array.isArray(data) || header?.format !== 'cB' || header?.version !== 1) {
        throw new Error('Formato de wordfreq inesperado.');
      }

      const buckets = data.slice(1).filter(Array.isArray);
      saveCachedWordfreqBuckets(buckets);
      setWordCorpusLoadingMessage('Organizando palabras por grupos...');
      return buckets;
    })().catch((error) => {
      wordfreqWordsPromise = null;
      throw error;
    });
  }

  return wordfreqWordsPromise;
}

async function loadOpenWordResources() {
  if (!openWordResourcesPromise) {
    openWordResourcesPromise = (async () => {
      const buckets = await loadWordfreqWords();
      const index = new Map();
      const orderedWords = [];
      const rhymeLexicon = new Map();
      const assonantLexicon = new Map();
      let rank = 0;

      for (const bucket of buckets) {
        for (const rawWord of bucket) {
          const word = String(rawWord ?? '').trim().toLowerCase();
          const comparable = normalizeLookupComparable(word);
          if (!comparable || index.has(comparable)) {
            continue;
          }

          rank += 1;
          index.set(comparable, rank);
          orderedWords.push(word);
          for (let size = 2; size <= Math.min(5, comparable.length); size += 1) {
            const suffix = comparable.slice(-size);
            if (!rhymeLexicon.has(suffix)) {
              rhymeLexicon.set(suffix, []);
            }
            rhymeLexicon.get(suffix).push(word);
          }

          const assonantKey = extractWordRhymeData(word).assonantKey;
          if (assonantKey && assonantKey !== '-') {
            if (!assonantLexicon.has(assonantKey)) {
              assonantLexicon.set(assonantKey, []);
            }
            assonantLexicon.get(assonantKey).push(word);
          }
        }
        await yieldToBrowser();
      }

      wordCorpusLoadingMessage = '';
      return { index, orderedWords, rhymeLexicon, assonantLexicon };
    })().catch((error) => {
      openWordResourcesPromise = null;
      wordCorpusLoadingMessage = '';
      throw error;
    });
  }

  return openWordResourcesPromise;
}

async function loadOpenSynonymsResources() {
  if (openSynonymsIndex) {
    return { synonymGroupMap: openSynonymsIndex };
  }

  if (!openSynonymsIndexPromise) {
    openSynonymsIndexPromise = (async () => {
      const sourceText = await fetchLookupSourceText(OPEN_SYNONYMS_SOURCE_URL);
      const resources = buildOpenSynonymsResources(sourceText);
      openSynonymsIndex = resources.synonymGroupMap;
      return resources;
    })().finally(() => {
      openSynonymsIndexPromise = null;
    });
  }

  return openSynonymsIndexPromise;
}

async function getSynonymGroupsFromOpenSource(targetWord, maxGroups = 8) {
  const { synonymGroupMap } = await loadOpenSynonymsResources();
  const comparable = normalizeLookupComparable(targetWord);
  if (!comparable || !synonymGroupMap.has(comparable)) {
    return [];
  }

  return synonymGroupMap.get(comparable).slice(0, maxGroups).map((group) => [...group]);
}

async function loadOpenFrequencyIndex() {
  if (openFrequencyIndex) {
    return openFrequencyIndex;
  }

  if (!openFrequencyIndexPromise) {
    openFrequencyIndexPromise = (async () => {
      const resources = await loadOpenWordResources();
      openFrequencyIndex = resources.index;
      return openFrequencyIndex;
    })().finally(() => {
      openFrequencyIndexPromise = null;
    });
  }

  return openFrequencyIndexPromise;
}

async function getFrequencyLabelFromOpenList(targetWord) {
  const comparable = normalizeLookupComparable(targetWord);
  if (!comparable) {
    return '';
  }

  const { rank } = await queryWordfreq(targetWord);
  if (!Number.isFinite(rank) || rank <= 0) {
    return '';
  }

  return `Puesto aproximado #${rank} en wordfreq (español)`;
}

async function loadOpenRhymeLexicon() {
  if (openRhymeLexicon) {
    return openRhymeLexicon;
  }

  if (!openRhymeLexiconPromise) {
    openRhymeLexiconPromise = (async () => {
      const resources = await loadOpenWordResources();
      openRhymeLexicon = {
        rhymeLexicon: resources.rhymeLexicon,
        assonantLexicon: resources.assonantLexicon
      };
      return openRhymeLexicon;
    })().finally(() => {
      openRhymeLexiconPromise = null;
    });
  }

  return openRhymeLexiconPromise;
}

async function getRhymeCandidatesFromWordlist(targetWord) {
  const comparable = normalizeLookupComparable(targetWord);
  if (!comparable) {
    return [];
  }
  const { candidates } = await queryWordfreq(targetWord);
  return candidates;
}

function extractSpanishWiktionarySection(sourceText) {
  const lines = String(sourceText ?? '').split(/\r?\n/);
  const headingRegex = /^\s*(##|==)\s+/;
  const spanishRegex = /espa(?:ñ|n)ol/i;

  const start = lines.findIndex((line) => headingRegex.test(line) && spanishRegex.test(line));
  if (start < 0) {
    return '';
  }

  const collected = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (headingRegex.test(line) && !spanishRegex.test(line)) {
      break;
    }
    collected.push(line);
  }

  return collected.join('\n');
}

function parseWiktionaryDefinitionFromSource(sourceText) {
  const section = extractSpanishWiktionarySection(sourceText) || String(sourceText ?? '');
  const nounStart = section.search(/sustantivo\s+femenino|sustantivo/i);
  const nounSection = nounStart >= 0 ? section.slice(nounStart) : section;
  const cleanedLines = nounSection
    .split(/\r?\n/)
    .map((line) => cleanMarkdownText(line))
    .filter(Boolean);

  const senseStart = cleanedLines.findIndex((line) => /^1\b/.test(line) || line === '1');
  if (senseStart >= 0) {
    const pieces = [];
    for (let index = senseStart; index < cleanedLines.length; index += 1) {
      const line = cleanedLines[index];
      if (index > senseStart && /^\d+\b/.test(line)) {
        break;
      }
      if (line === '1') {
        continue;
      }
      pieces.push(line.replace(/^1\s*/, ''));
    }

    const candidate = cleanMarkdownText(pieces.join(' ')).slice(0, 420).trim();
    if (candidate) {
      return candidate;
    }
  }

  const bulletMatches = [...section.matchAll(/^\s*#\s+(.+)$/gm)];
  const numberedMarkdownMatches = [...section.matchAll(/^\s*-\s*\*\*\d+[^*]*\*\*\s*(.+)$/gm)];
  const sourceMatches = bulletMatches.length ? bulletMatches : numberedMarkdownMatches;

  if (sourceMatches.length) {
    return sourceMatches
      .slice(0, 3)
      .map((item) => cleanMarkdownText(item[1]))
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  const linkedInlineSense = nounSection.match(/\b1\s*\[([^\]]+)\]\([^\)]+\)\s*([\s\S]*?)(?=\b2\s+|####|###|$)/i);
  if (linkedInlineSense) {
    const merged = `${linkedInlineSense[1]} ${linkedInlineSense[2]}`;
    const cleaned = cleanMarkdownText(merged).slice(0, 420).trim();
    if (cleaned) {
      return cleaned;
    }
  }

  const numericSense = nounSection.match(/\b1\b([\s\S]*?)(?=\b2\s+|####|###|$)/i);
  if (numericSense?.[1]) {
    const cleaned = cleanMarkdownText(numericSense[1]).slice(0, 420).trim();
    if (cleaned) {
      return cleaned;
    }
  }

  const plainInlineSense = nounSection.match(/\b1\s+([\s\S]*?)(?=\b2\s+|####|###|$)/i);
  if (plainInlineSense?.[1]) {
    const cleaned = cleanMarkdownText(plainInlineSense[1]).slice(0, 420).trim();
    if (cleaned) {
      return cleaned;
    }
  }

  const cleanedSection = cleanMarkdownText(section);
  const inlineSense = cleanedSection.match(/\b1\s+(.+?)(?=\b2\s+|\bLocuciones\b|\bVéase también\b|\bTraducciones\b|\bEtimología\b|$)/i);
  if (inlineSense?.[1]) {
    return inlineSense[1].trim();
  }

  const fallback = cleanedSection
    .replace(/^(Title|URL Source|Markdown Content):\s*/gi, '')
    .slice(0, 420);
  return fallback;
}

async function fetchWiktionaryExtractText(targetWord) {
  const apiUrl = `${LOOKUP_WIKTIONARY_API_BASE_URL}${encodeURIComponent(targetWord)}&format=json`;
  const sourceText = await fetchLookupSourceText(apiUrl);
  const parsed = parseJsonWithLoosePayload(sourceText);
  const pages = parsed?.query?.pages;
  if (!pages || typeof pages !== 'object') {
    return '';
  }

  const firstPage = Object.values(pages)[0];
  return String(firstPage?.extract ?? '');
}

function parseWiktionaryFrequencyFromSource(sourceText) {
  const section = extractSpanishWiktionarySection(sourceText) || String(sourceText ?? '');
  const explicit = section.match(/frecuenc[^\n]{0,100}/i);
  if (explicit?.[0]) {
    return cleanMarkdownText(explicit[0]).slice(0, 140);
  }

  const usageLabel = section.match(/uso\s+com[uú]n|muy\s+usad[ao]|poco\s+usad[ao]/i);
  if (usageLabel?.[0]) {
    return cleanMarkdownText(usageLabel[0]).slice(0, 140);
  }

  return '';
}

function filterRhymesByMode(targetWord, candidates, mode, syllableFilter = 'all', excludedComparables = null, excludedConsonantKeys = null) {
  const targetData = extractWordRhymeData(targetWord);
  const filtered = [];
  const seen = new Set();
  const syllableTarget = syllableFilter === 'all' ? -1 : Number(syllableFilter);

  for (const candidate of candidates) {
    const candidateComparable = normalizeLookupComparable(candidate);
    if (excludedComparables && excludedComparables.has(candidateComparable)) {
      continue;
    }

    const candidateData = extractWordRhymeData(candidate);

    if (
      excludedConsonantKeys
      && candidateData.consonantKey !== '-'
      && excludedConsonantKeys.has(candidateData.consonantKey)
    ) {
      continue;
    }

    const candidateAnalysis = analyzeWord(candidate);
    const syllableCount = Array.isArray(candidateAnalysis?.syllables) ? candidateAnalysis.syllables.length : 0;
    const passesSyllableFilter = syllableTarget <= 0
      ? true
      : syllableTarget >= 8
        ? syllableCount >= 8
        : syllableCount === syllableTarget;

    if (!passesSyllableFilter) {
      continue;
    }

    const isConsonantMatch = candidateData.consonantKey === targetData.consonantKey;
    const isAssonantOnlyMatch = candidateData.assonantKey === targetData.assonantKey
      && candidateData.consonantKey !== targetData.consonantKey;

    const isMatch = mode === 'consonante'
      ? isConsonantMatch
      : mode === 'palabra-final'
        ? candidateData.finalWordKey === targetData.finalWordKey
        : isAssonantOnlyMatch;

    if (isMatch) {
      const comparable = normalizeLookupComparable(candidate);
      if (seen.has(comparable)) {
        continue;
      }
      seen.add(comparable);
      filtered.push(candidate);
    }
  }

  return filtered;
}

function recomputeLookupRhymes() {
  if (!state.selectedLookupWord) {
    state.lookupRhymes = [];
    return;
  }

  const mode = normalizeRhymeMode(rhymeMode?.value);

  state.lookupMode = mode;
  const excludedComparables = new Set(
    state.lookupExcludedWords.map((word) => normalizeLookupComparable(word)).filter(Boolean)
  );
  const excludedConsonantKeys = new Set(
    state.lookupExcludedWords
      .map((word) => extractWordRhymeData(word).consonantKey)
      .filter((key) => key && key !== '-')
  );
  state.lookupRhymes = filterRhymesByMode(
    state.selectedLookupWord,
    state.lookupRhymeCandidates,
    mode,
    state.lookupSyllableFilter,
    excludedComparables,
    excludedConsonantKeys
  );
}

function getLookupRhymePageState() {
  const filteredRhymes = filterRhymesByWordType(state.lookupRhymes, state.lookupWordTypeFilter);
  const total = Array.isArray(filteredRhymes) ? filteredRhymes.length : 0;
  const pageSize = Math.max(6, Number(state.lookupRhymePageSize) || LOOKUP_RHYME_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, Number(state.lookupRhymePage) || 1), totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    total,
    pageSize,
    totalPages,
    currentPage,
    items: total > 0 ? filteredRhymes.slice(start, start + pageSize) : []
  };
}

function setLookupRhymePage(pageNumber) {
  const { totalPages } = getLookupRhymePageState();
  const normalized = Math.min(Math.max(1, Number(pageNumber) || 1), totalPages);
  if (normalized === state.lookupRhymePage) {
    return;
  }

  state.lookupRhymePage = normalized;
  renderLookupResults();
}

function getLookupWordTypeForWord(word) {
  const comparable = normalizeLookupComparable(word);
  if (!comparable) {
    return '';
  }

  return String(lookupWordTypeCache?.[comparable] ?? state.lookupVisibleWordTypes?.[comparable] ?? '');
}

function filterRhymesByWordType(words, wordTypeFilter) {
  const normalizedFilter = String(wordTypeFilter ?? 'all');
  if (normalizedFilter === 'all') {
    return [...words];
  }

  return words.filter((word) => getLookupWordTypeForWord(word) === normalizedFilter);
}

async function refreshLookupVisibleWordTypes() {
  if (state.lookupWordTypeFilter === 'all' || !state.selectedLookupWord) {
    return;
  }

  try {
    await startLookupWordTypeScan();
  } finally {
    renderLookupResults();
  }
}

function getLookupTypeScanPages() {
  const pageSize = LOOKUP_WORD_TYPE_SCAN_BATCH_SIZE;
  const total = Array.isArray(state.lookupRhymeCandidates) ? state.lookupRhymeCandidates.length : 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { pageSize, total, totalPages };
}

function getLookupWordsForPage(pageNumber) {
  const { pageSize } = getLookupTypeScanPages();
  const safePage = Math.max(1, Number(pageNumber) || 1);
  const start = (safePage - 1) * pageSize;
  return Array.isArray(state.lookupRhymeCandidates)
    ? state.lookupRhymeCandidates.slice(start, start + pageSize)
    : [];
}

function applyLookupWordTypeCache(entries) {
  let changed = false;
  for (const [key, value] of entries) {
    if (!key) {
      continue;
    }

    const cachedValue = value || '-';

    if (lookupWordTypeCache[key] !== cachedValue) {
      lookupWordTypeCache[key] = cachedValue;
      changed = true;
    }
  }

  if (changed) {
    state.lookupVisibleWordTypes = lookupWordTypeCache;
    saveLookupWordTypeCache();
  }
  return changed;
}

async function classifyLookupWordsByType(words, requestId) {
  const uniqueWords = [...new Set((Array.isArray(words) ? words : [])
    .map((word) => String(word ?? '').trim())
    .filter(Boolean))];

  const pendingWords = uniqueWords.filter((word) => {
    const comparable = normalizeLookupComparable(word);
    return comparable && lookupWordTypeCache[comparable] === undefined;
  });

  if (!pendingWords.length) {
    return;
  }

  for (let index = 0; index < pendingWords.length; index += LOOKUP_WORD_TYPE_BATCH_CONCURRENCY) {
    if (requestId !== state.lookupWordTypeRequestId) {
      return;
    }

    const chunk = pendingWords.slice(index, index + LOOKUP_WORD_TYPE_BATCH_CONCURRENCY);
    const results = await Promise.allSettled(chunk.map(async (word) => {
      const extract = await fetchWiktionaryExtractText(word);
      const wordType = parseWiktionaryWordTypeFromSource(extract) || '';
      return [normalizeLookupComparable(word), wordType];
    }));

    if (requestId !== state.lookupWordTypeRequestId) {
      return;
    }

    applyLookupWordTypeCache(results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value)
      .filter(([key]) => key));

    renderLookupResults();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function startLookupWordTypeScan() {
  if (state.lookupWordTypeFilter === 'all' || !state.selectedLookupWord) {
    state.lookupLoadingWordTypes = false;
    state.lookupWordTypeScanComplete = true;
    renderLookupResults();
    return;
  }

  const requestId = state.lookupWordTypeRequestId + 1;
  state.lookupWordTypeRequestId = requestId;
  state.lookupLoadingWordTypes = true;
  state.lookupWordTypeScanComplete = false;
  renderLookupResults();

  try {
    const { totalPages } = getLookupTypeScanPages();
    for (let page = 1; page <= totalPages; page += 1) {
      if (requestId !== state.lookupWordTypeRequestId) {
        return;
      }

      await classifyLookupWordsByType(getLookupWordsForPage(page), requestId);
      if (requestId !== state.lookupWordTypeRequestId) {
        return;
      }
    }
  } finally {
    if (requestId === state.lookupWordTypeRequestId) {
      state.lookupLoadingWordTypes = false;
      state.lookupWordTypeScanComplete = true;
      renderLookupResults();
    }
  }
}

function isAsonanteRhymeMode() {
  return normalizeRhymeMode(rhymeMode?.value) === 'asonante';
}

function renderLookupExcludedBar() {
  if (!lookupExcludedBar) {
    return;
  }

  if (!isAsonanteRhymeMode() || !state.lookupExcludedWords.length) {
    lookupExcludedBar.innerHTML = '';
    return;
  }

  const chips = state.lookupExcludedWords
    .map((word) => `
      <span class="lookup-excluded-chip">
        ${escapeHtml(word)}
        <button type="button" class="lookup-excluded-chip-remove" data-action="remove-lookup-excluded-word" data-word="${escapeHtml(word)}" title="Quitar '${escapeHtml(word)}' de la lista de evitadas" aria-label="Quitar '${escapeHtml(word)}' de la lista de evitadas">×</button>
      </span>
    `)
    .join('');

  lookupExcludedBar.innerHTML = `
    <span class="quick-control-label">No repetir</span>
    ${chips}
    <button type="button" id="lookupExcludeClearBtn" data-action="clear-lookup-excluded-words" title="Vaciar la lista de palabras evitadas">Vaciar</button>
  `;
}

function addLookupExcludedWord(rawWord) {
  const trimmed = String(rawWord ?? '').trim();
  const comparable = normalizeLookupComparable(trimmed);
  if (!comparable) {
    return;
  }

  const alreadyExcluded = state.lookupExcludedWords.some(
    (word) => normalizeLookupComparable(word) === comparable
  );
  if (alreadyExcluded) {
    return;
  }

  state.lookupExcludedWords = [...state.lookupExcludedWords, trimmed];
  recomputeLookupRhymes();
  renderLookupExcludedBar();
  renderLookupResults();
}

function removeLookupExcludedWord(rawWord) {
  const comparable = normalizeLookupComparable(rawWord);
  if (!comparable) {
    return;
  }

  state.lookupExcludedWords = state.lookupExcludedWords.filter(
    (word) => normalizeLookupComparable(word) !== comparable
  );
  recomputeLookupRhymes();
  renderLookupExcludedBar();
  renderLookupResults();
}

function clearLookupExcludedWords() {
  if (!state.lookupExcludedWords.length) {
    return;
  }

  state.lookupExcludedWords = [];
  recomputeLookupRhymes();
  renderLookupExcludedBar();
  renderLookupResults();
}

function buildLookupSyllableFilterOptions(selectedValue = 'all') {
  const values = ['all', '1', '2', '3', '4', '5', '6', '7', '8'];
  return values
    .map((value) => {
      const label = value === 'all' ? 'Todas' : value === '8' ? '8+' : value;
      const selected = String(selectedValue) === value ? ' selected' : '';
      return `<option value="${value}"${selected}>${label}</option>`;
    })
    .join('');
}

function buildLookupPageSizeOptions(selectedValue = 24) {
  const values = [12, 24, 36, 48, 72, 96];
  return values
    .map((value) => {
      const selected = Number(selectedValue) === value ? ' selected' : '';
      return `<option value="${value}"${selected}>${value}</option>`;
    })
    .join('');
}

function buildLookupWordTypeOptions(selectedValue = 'all') {
  const values = [
    ['all', 'Todos'],
    ['sustantivo', 'Sustantivo'],
    ['verbo', 'Verbo'],
    ['adjetivo', 'Adjetivo'],
    ['adverbio', 'Adverbio'],
    ['pronombre', 'Pronombre'],
    ['determinante', 'Determinante'],
    ['numeral', 'Numeral'],
    ['preposición', 'Preposición'],
    ['conjunción', 'Conjunción'],
    ['interjección', 'Interjección'],
    ['locución', 'Locución']
  ];

  return values
    .map(([value, label]) => {
      const selected = String(selectedValue) === value ? ' selected' : '';
      return `<option value="${value}"${selected}>${label}</option>`;
    })
    .join('');
}

function normalizeWiktionaryWordType(value) {
  const text = cleanMarkdownText(String(value ?? '')).toLowerCase();
  if (!text) {
    return '';
  }

  if (text.startsWith('sustantivo')) return 'sustantivo';
  if (text.startsWith('verbo')) return 'verbo';
  if (text.startsWith('adjetivo')) return 'adjetivo';
  if (text.startsWith('adverbio')) return 'adverbio';
  if (text.startsWith('pronombre')) return 'pronombre';
  if (text.startsWith('determinante')) return 'determinante';
  if (text.startsWith('numeral')) return 'numeral';
  if (text.startsWith('preposición')) return 'preposición';
  if (text.startsWith('conjunción')) return 'conjunción';
  if (text.startsWith('interjección')) return 'interjección';
  if (text.startsWith('artículo')) return 'determinante';
  if (text.startsWith('locución')) return 'locución';
  return '';
}

function normalizeLookupWordTypeValue(value) {
  const normalized = normalizeWiktionaryWordType(value);
  if (normalized) {
    return normalized;
  }

  const text = cleanMarkdownText(String(value ?? '')).toLowerCase();
  if (text.includes('forma verbal')) return 'verbo';
  return '';
}

function parseWiktionaryWordTypeFromSource(sourceText) {
  const section = extractSpanishWiktionarySection(sourceText) || String(sourceText ?? '');
  const lines = section
    .split(/\r?\n/)
    .map((line) => String(line ?? '').trim())
    .filter(Boolean);

  for (const rawLine of lines) {
    const headingMatch = rawLine.match(/^=+\s*([^=]+?)\s*=+$/);
    const candidate = cleanMarkdownText(headingMatch ? headingMatch[1] : rawLine);
    const wordType = normalizeLookupWordTypeValue(candidate);
    if (wordType) {
      return wordType;
    }

    if (/^forma verbal\b/i.test(candidate)) {
      return 'verbo';
    }
  }

  return '';
}

function renderLookupResults() {
  if (!lookupResults) {
    return;
  }

  if (!state.selectedLookupWord) {
    lookupResults.innerHTML = '<p class="lookup-definition lookup-empty-hint">Haz doble clic en una palabra del poema analizado o selecciónala para ver su definición, sinónimos y rimas.</p>';
    return;
  }

  const definitionText = state.lookupDefinition
    ? state.lookupDefinition.trim()
    : 'No se encontró definición en Wikcionario para esta palabra.';
  const frequencyText = state.lookupFrequency
    ? state.lookupFrequency.trim()
    : 'No hay etiqueta de frecuencia disponible en la entrada de Wikcionario.';
  const synonymsHtml = Array.isArray(state.lookupSynonyms) && state.lookupSynonyms.length
    ? state.lookupSynonyms
      .map((group, index) => {
        const words = Array.isArray(group)
          ? group.map((word) => escapeHtml(String(word))).filter(Boolean)
          : [];
        if (!words.length) {
          return '';
        }
        return `
          <div class="lookup-synonym-group-card">
            <div class="lookup-synonym-group-title">Grupo ${index + 1}</div>
            <div class="lookup-synonym-chips">
              ${words.map((word) => `<span class="lookup-synonym-chip">${word}</span>`).join('')}
            </div>
          </div>
        `;
      })
      .filter(Boolean)
      .join('')
    : '<p class="lookup-definition">No se encontraron sinónimos en el corpus abierto configurado para esta palabra.</p>';
  const selectedWordEncoded = encodeURIComponent(state.selectedLookupWord);
  const corroborationLinks = state.selectedLookupWord
    ? `<p class="lookup-definition" style="margin-top: 0.35rem;">
        <a href="https://dle.rae.es/${selectedWordEncoded}" target="_blank" rel="noopener noreferrer">Abrir en RAE</a>
        ·
        <a href="https://iedra.es/rimas/${selectedWordEncoded}" target="_blank" rel="noopener noreferrer">Abrir en IEDRA</a>
      </p>`
    : '';

  const mode = normalizeRhymeMode(rhymeMode?.value);
  const filteredRhymes = filterRhymesByWordType(state.lookupRhymes, state.lookupWordTypeFilter);
  const syllableFilterOptions = buildLookupSyllableFilterOptions(state.lookupSyllableFilter);
  const wordTypeFilterOptions = buildLookupWordTypeOptions(state.lookupWordTypeFilter);
  const rhymeCountLabel = state.lookupWordTypeFilter !== 'all' && !state.lookupWordTypeScanComplete
    ? '?'
    : String(filteredRhymes.length);

  const filteredList = state.lookupLoadingRhymes
    ? '<li class="lookup-rhyme-loading"><span class="lookup-spinner" aria-hidden="true"></span>Cargando rimas...</li>'
    : filteredRhymes.length > 0 ? filteredRhymes
    .map((item) => `
      <li>
        <span>${escapeHtml(item)}</span>
        ${isAsonanteRhymeMode() ? `<button type="button" class="lookup-rhyme-use-btn" data-action="add-lookup-excluded-word" data-word="${escapeHtml(item)}" title="Marcar '${escapeHtml(item)}' como ya usada para que no se repita" aria-label="Marcar '${escapeHtml(item)}' como ya usada">x</button>` : ''}
      </li>
    `)
    .join('') : '<li>No se encontraron rimas con los filtros actuales y el corpus abierto cargado.</li>';

  const rhymeControls = `
    <div class="lookup-rhyme-controls">
      <label class="lookup-rhyme-control">
        <span>Tipo</span>
        <select id="lookupWordTypeFilter">
          ${wordTypeFilterOptions}
        </select>
      </label>
      <label class="lookup-rhyme-control">
        <span>Sílabas</span>
        <select id="lookupSyllableFilter">
          ${syllableFilterOptions}
        </select>
      </label>
    </div>
  `;
  const typeLoadingNotice = state.lookupLoadingWordTypes
    ? '<p class="lookup-loader" style="margin-top: 0.35rem;"><span class="lookup-spinner" aria-hidden="true"></span>Clasificando por páginas y guardando caché desde Wikcionario...</p>'
    : '';

  const loaderVisible = state.lookupLoadingDefinition;
  const loaderMessage = wordCorpusLoadingMessage || 'Cargando información desde las fuentes...';
  const loaderBlock = loaderVisible ? `<p class="lookup-loader"><span class="lookup-spinner" aria-hidden="true"></span>${escapeHtml(loaderMessage)}</p>` : '';
  const errorLine = state.lookupError ? `<p class="lookup-definition">${escapeHtml(state.lookupError)}</p>` : '';

  lookupResults.innerHTML = `
    ${loaderBlock}
    ${errorLine}
    
    <div class="lookup-section">
      <strong>Definición (Wikcionario)</strong>
    </div>
    <p class="lookup-definition">${escapeHtml(definitionText)}</p>
    <p class="lookup-definition" style="margin-top: 0.35rem;"><strong>Frecuencia:</strong> ${escapeHtml(frequencyText)}</p>
    ${corroborationLinks}

    <details class="lookup-collapsible-section" open>
      <summary class="lookup-section" style="cursor: pointer; list-style: max-content;">
        <strong>Sinónimos</strong>
      </summary>
      <div class="lookup-synonym-groups">${synonymsHtml}</div>
    </details>

    <details class="lookup-collapsible-section" open>
      <summary class="lookup-section" style="cursor: pointer; list-style: max-content; margin-top: 1rem;">
        <strong>Rimas filtradas (${mode})</strong>
        <span class="guide-hover lookup-rhyme-mode-help" tabindex="0">
          <span class="guide-trigger" aria-label="Información sobre el tipo de rima">i</span>
          <span class="guide-popover" role="tooltip">Puedes cambiar el tipo de rima del poema en <strong>Configuración</strong>.</span>
        </span>
      </summary>
      ${rhymeControls}
      ${typeLoadingNotice}
      <p class="lookup-rhyme-count">${rhymeCountLabel} rimas</p>
      <ul class="lookup-rhyme-list" style="margin-top: 0.5rem;">
        ${filteredList}
      </ul>
    </details>

    <div class="lookup-credit" style="font-size: 0.75rem; color: var(--text-muted, #6b7280); margin-top: 1.5rem; padding-top: 0.5rem; border-top: 1px dashed rgba(127,127,127,0.2);">
      Definiciones desde <a href="https://es.wiktionary.org/" target="_blank" rel="noopener noreferrer">Wikcionario</a> (<a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA</a> / <a href="https://www.gnu.org/licenses/fdl-1.3.html" target="_blank" rel="noopener noreferrer">GFDL</a>). Frecuencia y rimas desde <a href="https://github.com/rspeer/wordfreq" target="_blank" rel="noopener noreferrer">rspeer/wordfreq</a> (<a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>). Sinónimos desde <a href="https://github.com/edublancas/sinonimos" target="_blank" rel="noopener noreferrer">edublancas/sinonimos</a> (MIT). <a href="THIRD-PARTY-LICENSES.md">Licencias completas</a>. Corroboración rápida en <a href="https://dle.rae.es/" target="_blank" rel="noopener noreferrer">RAE</a> y <a href="https://iedra.es/rimas/" target="_blank" rel="noopener noreferrer">IEDRA</a>.
    </div>
  `;
}

async function openWiktionaryDefinition() {
  if (!state.selectedLookupWord) {
    return;
  }

  const requestId = state.lookupDefinitionRequestId + 1;
  state.lookupDefinitionRequestId = requestId;
  state.lookupError = '';
  state.lookupLoadingDefinition = true;
  renderLookupResults();

  try {
    let sourceText = '';

    try {
      sourceText = await fetchWiktionaryExtractText(state.selectedLookupWord);
    } catch (error) {
      if (requestId !== state.lookupDefinitionRequestId) {
        return;
      }

      state.lookupDefinition = 'No se pudo consultar Wikcionario para esta palabra.';
      state.lookupError = `Error al consultar Wikcionario: ${String(error?.message ?? error)}`;
    }

    if (requestId !== state.lookupDefinitionRequestId) {
      return;
    }

    if (sourceText) {
      state.lookupDefinition = parseWiktionaryDefinitionFromSource(sourceText);
      if (!state.lookupDefinition) {
        state.lookupDefinition = 'No se pudo extraer la definición principal desde la fuente.';
      }
    }

    const [synonymsResult, frequencyResult] = await Promise.allSettled([
      getSynonymGroupsFromOpenSource(state.selectedLookupWord),
      getFrequencyLabelFromOpenList(state.selectedLookupWord)
    ]);
    if (requestId !== state.lookupDefinitionRequestId) {
      return;
    }

    if (synonymsResult.status === 'fulfilled') {
      state.lookupSynonyms = synonymsResult.value;
    }

    if (frequencyResult.status === 'fulfilled' && frequencyResult.value) {
      state.lookupFrequency = frequencyResult.value;
    } else if (sourceText) {
      state.lookupFrequency = parseWiktionaryFrequencyFromSource(sourceText);
    }
  } catch (error) {
    if (requestId !== state.lookupDefinitionRequestId) {
      return;
    }
    state.lookupError = `Error al consultar Wikcionario/datos abiertos: ${String(error?.message ?? error)}`;
  } finally {
    if (requestId === state.lookupDefinitionRequestId) {
      state.lookupLoadingDefinition = false;
      renderLookupResults();
    }
  }
}

async function openOpenDataRhymesFromConfig() {
  if (!state.selectedLookupWord) {
    return;
  }

  const configuredRhymeMode = normalizeRhymeMode(rhymeMode?.value);
  const requestId = state.lookupRhymeRequestId + 1;
  state.lookupRhymeRequestId = requestId;
  state.lookupError = '';
  state.lookupLoadingRhymes = true;
  state.lookupWordTypeRequestId += 1;
  state.lookupLoadingWordTypes = false;
  state.lookupMode = configuredRhymeMode;
  state.lookupRhymePage = 1;
  state.lookupVisibleWordTypes = lookupWordTypeCache;
  state.lookupWordTypeScanComplete = state.lookupWordTypeFilter === 'all';
  renderLookupResults();

  try {
    const candidates = await getRhymeCandidatesFromWordlist(state.selectedLookupWord);
    if (requestId !== state.lookupRhymeRequestId) {
      return;
    }

    state.lookupRhymeCandidates = candidates;
    recomputeLookupRhymes();

    if (!state.lookupRhymes.length) {
      state.lookupError = `No se encontraron rimas ${configuredRhymeMode} con el corpus abierto cargado.`;
    } else if (state.lookupWordTypeFilter !== 'all') {
      startLookupWordTypeScan();
    }
  } catch (error) {
    if (requestId !== state.lookupRhymeRequestId) {
      return;
    }
    state.lookupError = `Error al consultar corpus abierto de rimas: ${String(error?.message ?? error)}`;
  } finally {
    if (requestId === state.lookupRhymeRequestId) {
      state.lookupLoadingRhymes = false;
      renderLookupResults();
    }
  }
}

const MD_LOGO_ICON = '<span class="download-badge" aria-hidden="true">MD</span>';
const PDF_LOGO_ICON = '<span class="download-badge" aria-hidden="true">PDF</span>';

function ensureToastElement() {
  let toast = document.getElementById('appToast');
  if (toast) {
    return toast;
  }

  toast = document.createElement('div');
  toast.id = 'appToast';
  toast.className = 'app-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);
  return toast;
}

function showToast(message, type = 'info') {
  const toast = ensureToastElement();
  toast.textContent = String(message ?? '').trim();
  toast.classList.remove('is-info', 'is-success', 'is-warning', 'is-error');
  toast.classList.add(`is-${type}`);
  toast.classList.add('is-visible');

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2200);
}

function clampFontScale(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 100;
  }

  return Math.min(500, Math.max(10, Math.round(numeric / 5) * 5));
}

function loadUiPreferences() {
  try {
    const raw = localStorage.getItem(LOCAL_UI_PREFERENCES_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
}

function saveUiPreferences() {
  try {
    localStorage.setItem(
      LOCAL_UI_PREFERENCES_KEY,
      JSON.stringify({
        fontScale: state.fontScale,
        panelViewMode: state.panelViewMode
      })
    );
  } catch {
    // Ignore storage errors to avoid blocking analysis.
  }
}

function applyFontScale() {
  const scale = clampFontScale(state.fontScale);
  state.fontScale = scale;
  document.documentElement.style.setProperty('--user-font-scale', String(scale / 100));

  if (fontScaleValue) {
    fontScaleValue.textContent = `${scale}%`;
  }
}

const POEM_FONTS = {
  'open-dyslexic': '"OpenDyslexic", "Atkinson Hyperlegible", system-ui, sans-serif',
  atkinson: '"Atkinson Hyperlegible", system-ui, sans-serif',
  alegreya: '"Alegreya", Georgia, serif',
  lora: '"Lora", Georgia, serif',
  cormorant: '"Cormorant Garamond", Garamond, Georgia, serif',
  'eb-garamond': '"EB Garamond", Garamond, Georgia, serif',
  playfair: '"Playfair Display", Georgia, serif',
  'libre-baskerville': '"Libre Baskerville", Georgia, serif',
  merriweather: '"Merriweather", Georgia, serif',
  montserrat: '"Montserrat", system-ui, sans-serif',
  nunito: '"Nunito", system-ui, sans-serif',
  'source-sans': '"Source Sans 3", system-ui, sans-serif',
  lexend: '"Lexend", system-ui, sans-serif',
  josefin: '"Josefin Sans", system-ui, sans-serif',
  cinzel: '"Cinzel", Georgia, serif',
  'bebas-neue': '"Bebas Neue", Impact, sans-serif',
  caveat: '"Caveat", cursive',
  pacifico: '"Pacifico", cursive',
  'permanent-marker': '"Permanent Marker", cursive',
  bungee: '"Bungee", display, sans-serif',
  unifraktur: '"UnifrakturCook", fantasy'
};

function normalizePoemFont(value) {
  const font = String(value ?? '');
  return Object.hasOwn(POEM_FONTS, font) ? font : 'atkinson';
}

function loadDefaultPoemFont() {
  try {
    return normalizePoemFont(localStorage.getItem(LOCAL_DEFAULT_POEM_FONT_KEY));
  } catch {
    return 'atkinson';
  }
}

function saveDefaultPoemFont(value) {
  const font = normalizePoemFont(value);
  try {
    localStorage.setItem(LOCAL_DEFAULT_POEM_FONT_KEY, font);
  } catch { /* ignore */ }
  return font;
}

function updateDefaultPoemFontControl() {
  if (defaultPoemFont) {
    defaultPoemFont.value = loadDefaultPoemFont();
  }
}

function applyPoemFont(value = state.poemFont) {
  state.poemFont = normalizePoemFont(value);
  document.documentElement.style.setProperty('--poem-font-family', POEM_FONTS[state.poemFont]);
  for (const selector of poemFontSelectors) {
    selector.value = state.poemFont;
  }
}

function applyPanelViewMode() {
  const validModes = new Set(['both', 'writing', 'analysis']);
  if (!validModes.has(state.panelViewMode)) {
    state.panelViewMode = 'both';
  }

  const writingOnly = state.panelViewMode === 'writing';
  const analysisOnly = state.panelViewMode === 'analysis';

  if (workspace) {
    workspace.classList.toggle('view-writing-only', writingOnly);
    workspace.classList.toggle('view-analysis-only', analysisOnly);
  }

  if (inputPanel) {
    inputPanel.classList.toggle('hidden', analysisOnly);
  }

  if (outputPanel) {
    outputPanel.classList.toggle('hidden', writingOnly);
  }

  if (panelViewMode) {
    panelViewMode.value = state.panelViewMode;
  }
}

function adjustFontScale(step) {
  state.fontScale = clampFontScale(state.fontScale + step);
  applyFontScale();
  saveUiPreferences();
}

function initializeUiPreferences() {
  const preferences = loadUiPreferences();
  state.fontScale = clampFontScale(preferences.fontScale ?? state.fontScale);

  const preferredPanelMode = String(preferences.panelViewMode ?? '').trim();
  if (preferredPanelMode === 'writing' || preferredPanelMode === 'analysis' || preferredPanelMode === 'both') {
    state.panelViewMode = preferredPanelMode;
  }

  applyFontScale();
  applyPanelViewMode();
}

function normalizePoemTitle(value) {
  const title = String(value ?? '').trim();
  return title || 'Sin título';
}

function createLocalPoemKey() {
  if (typeof crypto?.randomUUID === 'function') {
    return `local:${crypto.randomUUID()}`;
  }
  return `local:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function serverPoemKeyFromVersions(versions) {
  for (const version of versions ?? []) {
    const match = /^cloud-(\d+)-/.exec(String(version?.id ?? ''));
    if (match) return `server:${match[1]}`;
  }
  return '';
}

function getStoredPoemTitle(poemKey, versions) {
  const storedTitle = versions?.find((version) => String(version?.poemTitle ?? '').trim())?.poemTitle;
  return normalizePoemTitle(storedTitle || poemKey);
}

function setStoredPoemTitle(versions, title) {
  const normalizedTitle = normalizePoemTitle(title);
  for (const version of versions ?? []) version.poemTitle = normalizedTitle;
  return normalizedTitle;
}

function getPoemEntries(store) {
  return Object.entries(store?.poems ?? {}).map(([poemKey, versions]) => ({
    poemKey,
    title: getStoredPoemTitle(poemKey, versions),
    versions: Array.isArray(versions) ? versions : [],
  }));
}

function sanitizeFileNamePart(value) {
  return String(value ?? '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim() || 'poema';
}

function setPoemTitleDisplay(value) {
  if (!poemTitle) {
    return;
  }
  poemTitle.value = normalizePoemTitle(value);
}

function loadPoemMemoryStore() {
  const emptyStore = { schemaVersion: 2, poems: {}, trash: {} };

  try {
    const raw = localStorage.getItem(LOCAL_POEM_MEMORY_KEY);
    if (!raw) {
      return replaceLibraryState(emptyStore);
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return replaceLibraryState(emptyStore);
    }

    let poems = parsed.poems && typeof parsed.poems === 'object' ? parsed.poems : {};
    const trash = parsed.trash && typeof parsed.trash === 'object' ? parsed.trash : {};
    let changed = false;

    if (parsed.schemaVersion !== 2) {
      const migratedPoems = {};
      for (const [legacyTitle, entries] of Object.entries(poems)) {
        if (!Array.isArray(entries) || !entries.length) continue;
        let poemKey = serverPoemKeyFromVersions(entries) || createLocalPoemKey();
        while (migratedPoems[poemKey]) poemKey = createLocalPoemKey();
        setStoredPoemTitle(entries, legacyTitle);
        migratedPoems[poemKey] = entries;
      }
      poems = migratedPoems;
      changed = true;
    }

    for (const [title, entries] of Object.entries(trash)) {
      if (!Array.isArray(entries) || !entries.length) {
        delete trash[title];
        changed = true;
        continue;
      }

      const validEntries = entries.filter((entry) => Number.isFinite(new Date(entry?.deletedAt ?? 0).getTime()));

      if (validEntries.length !== entries.length) {
        changed = true;
      }

      if (!validEntries.length) {
        delete trash[title];
      } else {
        trash[title] = validEntries;
      }
    }

    const newestTrashEntries = Object.entries(trash)
      .flatMap(([title, entries]) => entries.map((entry) => ({ title, entry })))
      .sort((left, right) => new Date(right.entry.deletedAt) - new Date(left.entry.deletedAt))
      .slice(0, TRASH_LIMIT);
    const trimmedTrash = {};
    for (const { title, entry } of newestTrashEntries) {
      (trimmedTrash[title] ||= []).push(entry);
    }
    if (newestTrashEntries.length !== Object.values(trash).reduce((total, entries) => total + entries.length, 0)) {
      changed = true;
      for (const title of Object.keys(trash)) delete trash[title];
      Object.assign(trash, trimmedTrash);
    }

    if (changed) {
      try {
        localStorage.setItem(LOCAL_POEM_MEMORY_KEY, JSON.stringify({ schemaVersion: 2, poems, trash }));
      } catch {
        // Ignore storage write errors on cleanup.
      }
    }

    return replaceLibraryState({ schemaVersion: 2, poems, trash });
  } catch {
    return replaceLibraryState(emptyStore);
  }
}

function savePoemMemoryStore(store) {
  try {
    localStorage.setItem(LOCAL_POEM_MEMORY_KEY, JSON.stringify({ ...store, schemaVersion: 2 }));
    return true;
  } catch {
    return false;
  }
}

function loadLastWorkedPoemReference() {
  try {
    const raw = localStorage.getItem(LOCAL_LAST_WORKED_POEM_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const title = normalizePoemTitle(parsed.title ?? '');
    const versionId = String(parsed.versionId ?? '').trim();
    if (!title || !versionId) {
      return null;
    }

    return { title, versionId };
  } catch {
    return null;
  }
}

function saveLastWorkedPoemReference(title, versionId) {
  const normalizedTitle = normalizePoemTitle(title);
  const normalizedVersionId = String(versionId ?? '').trim();
  if (!normalizedTitle || !normalizedVersionId) {
    return;
  }

  try {
    localStorage.setItem(
      LOCAL_LAST_WORKED_POEM_KEY,
      JSON.stringify({
        title: normalizedTitle,
        versionId: normalizedVersionId,
        savedAt: new Date().toISOString()
      })
    );
  } catch {
    // Ignore storage errors so poem loading is never blocked.
  }
}

function findLatestSavedVersion(store) {
  let latest = null;

  for (const [title, versions] of Object.entries(store?.poems ?? {})) {
    if (!Array.isArray(versions) || !versions.length) {
      continue;
    }

    for (const entry of versions) {
      const versionId = String(entry?.id ?? '').trim();
      if (!versionId) {
        continue;
      }

      const savedAtMs = new Date(entry?.savedAt ?? 0).getTime();
      if (!Number.isFinite(savedAtMs)) {
        continue;
      }

      if (!latest || savedAtMs > latest.savedAtMs) {
        latest = {
          title: normalizePoemTitle(title),
          versionId,
          savedAtMs
        };
      }
    }
  }

  return latest;
}

function restoreLastWorkedPoemOnStartup() {
  const storedRef = loadLastWorkedPoemReference();
  if (storedRef && loadVersionById(storedRef.title, storedRef.versionId)) {
    return true;
  }

  const store = loadPoemMemoryStore();
  const latest = findLatestSavedVersion(store);
  if (!latest) {
    return false;
  }

  const loaded = loadVersionById(latest.title, latest.versionId);
  if (loaded) {
    saveLastWorkedPoemReference(latest.title, latest.versionId);
  }
  return loaded;
}

function movePoemToTrash(store, title, versionsToTrash = null) {
  const normalizedTitle = normalizePoemTitle(title);
  const versions = Array.isArray(versionsToTrash)
    ? versionsToTrash
    : (Array.isArray(store.poems?.[normalizedTitle]) ? store.poems[normalizedTitle] : []);

  if (!versions.length) {
    return false;
  }

  if (!store.trash || typeof store.trash !== 'object') {
    store.trash = {};
  }

  if (!Array.isArray(store.trash[normalizedTitle])) {
    store.trash[normalizedTitle] = [];
  }

  store.trash[normalizedTitle].push({
    deletedAt: new Date().toISOString(),
    versions: versions.map((entry) => ({ ...entry }))
  });

  const entries = Object.entries(store.trash)
    .flatMap(([trashTitle, groups]) => groups.map((group) => ({ trashTitle, group })))
    .sort((left, right) => new Date(right.group.deletedAt) - new Date(left.group.deletedAt))
    .slice(0, TRASH_LIMIT);
  store.trash = {};
  for (const { trashTitle, group } of entries) {
    (store.trash[trashTitle] ||= []).push(group);
  }

  return true;
}

function renderPoemTrash() {
  if (!poemTrashList) return;
  const entries = Object.entries(loadPoemMemoryStore().trash)
    .flatMap(([title, groups]) => groups.map((group, groupIndex) => ({ title, groupIndex, ...group })))
    .sort((left, right) => new Date(right.deletedAt) - new Date(left.deletedAt));
  poemTrashList.innerHTML = entries.length
    ? entries.map((entry) => `<div class="trash-item"><span>${escapeHtml(entry.title)} (${entry.versions.length})</span><time>${escapeHtml(formatVersionTimestamp(entry.deletedAt))}</time><button type="button" class="secondary compact-action" data-action="restore-trash" data-title="${escapeHtml(entry.title)}" data-group-index="${entry.groupIndex}"${entry.id ? ` data-trash-id="${entry.id}"` : ''}>Restaurar</button></div>`).join('')
    : '<div class="saved-version-meta">La papelera está vacía.</div>';
  if (emptyPoemTrash) emptyPoemTrash.disabled = entries.length === 0;
}

function restorePoemTrashEntry(title, groupIndex, trashId) {
  if (applicationState.auth.user && trashId) {
    window.dispatchEvent(new CustomEvent('escandidor:trash-restored', {
      detail: { trashId: Number(trashId) }
    }));
    return;
  }

  const store = loadPoemMemoryStore();
  const groups = Array.isArray(store.trash?.[title]) ? store.trash[title] : [];
  const group = groups[groupIndex];
  if (!group?.versions?.length) return;
  const poemKey = getPoemEntries(store).find((entry) => entry.title === title)?.poemKey
    || `local:${crypto.randomUUID()}`;
  const restored = group.versions.map((version) => ({ ...version, poemTitle: title }));
  store.poems[poemKey] = [...(store.poems[poemKey] || []), ...restored];
  groups.splice(groupIndex, 1);
  if (!groups.length) delete store.trash[title];
  if (!savePoemMemoryStore(store)) return;
  refreshSavedPoemNameOptions(poemKey);
  renderSavedVersionList(poemKey);
  showToast('Versión restaurada.', 'success');
}

function dispatchPoemDeleted(poemKey, title, versionIds, wholePoem = false) {
  window.dispatchEvent(new CustomEvent('escandidor:poem-deleted', {
    detail: { poemKey, title, versionIds, wholePoem }
  }));
}

window.addEventListener('escandidor:trash-synced', (event) => {
  const store = loadPoemMemoryStore();
  store.trash = {};
  for (const entry of event.detail?.trash ?? []) {
    const title = normalizePoemTitle(entry.title ?? 'poema');
    (store.trash[title] ||= []).push({
      id: entry.id,
      poemId: entry.poemId,
      deletedAt: entry.deletedAt,
      versions: Array.isArray(entry.versions) ? entry.versions : []
    });
  }
  savePoemMemoryStore(store);
  renderPoemTrash();
});

window.addEventListener('escandidor:library-changed', () => {
  const loadedPoemKey = String(state.loadedVersionTitle ?? '').trim();
  const loadedVersionId = String(state.loadedVersionId ?? '').trim();
  replaceLibraryState(loadPoemMemoryStore());
  selectedVersionIds = new Set();
  state.loadedVersionId = '';
  state.loadedVersionTitle = '';
  const restoredLoadedVersion = loadedPoemKey && loadedVersionId
    ? loadVersionById(loadedPoemKey, loadedVersionId)
    : false;
  if (restoredLoadedVersion) {
    renderPoemTrash();
    return;
  }
  refreshSavedPoemNameOptions('');
  renderSavedVersionList(savedPoemName?.value ?? '', savedPoemVersion?.value ?? '');
  renderPoemTrash();
  updateVersionManagerStatus();
});

function loadVersionById(poemKey, versionId) {
  let selectedPoemKey = String(poemKey ?? '').trim();
  const selectedVersionId = String(versionId ?? '').trim();
  if (!selectedPoemKey || !selectedVersionId) {
    return false;
  }

  const store = loadPoemMemoryStore();
  if (!Array.isArray(store.poems?.[selectedPoemKey])) {
    const legacyMatch = getPoemEntries(store).find(({ title, versions }) =>
      title === selectedPoemKey
      && versions.some((entry) => String(entry.id ?? '') === selectedVersionId));
    selectedPoemKey = legacyMatch?.poemKey || selectedPoemKey;
  }
  const versions = Array.isArray(store.poems?.[selectedPoemKey]) ? store.poems[selectedPoemKey] : [];
  const version = versions.find((entry) => String(entry.id ?? '') === selectedVersionId);
  if (!version) {
    return false;
  }

  if (savedPoemName) {
    savedPoemName.value = selectedPoemKey;
  }
  if (savedPoemVersion) {
    savedPoemVersion.value = selectedVersionId;
  }

  const selectedTitle = getStoredPoemTitle(selectedPoemKey, versions);
  if (poemTitle) {
    poemTitle.value = selectedTitle;
  }
  setPoemTitleDisplay(selectedTitle);
  poemInput.value = String(version.poemText ?? '');

  if (version.settings) {
    applyPoemFont(version.settings.poemFont);
    if (poeticForm) {
      const savedForm = String(version.settings.poeticForm ?? 'custom');
      poeticForm.value = Object.hasOwn(POETIC_FORM_PRESETS, savedForm) ? savedForm : 'custom';
    }
    if (syllablePattern) {
      syllablePattern.value = String(version.settings.syllablePattern ?? '');
    }
    renderStressPatternFields(resolveStoredStressPatterns(version.settings));
    hemistichSplit.value = String(version.settings.hemistichSplit ?? hemistichSplit.value);
    if (rhymeMode) {
      rhymeMode.value = normalizeRhymeMode(version.settings.rhymeMode);
    }
    if (rhymeScheme) {
      rhymeScheme.value = String(version.settings.rhymeScheme ?? rhymeScheme.value);
    }
    if (repeatRhymeScheme) {
      repeatRhymeScheme.checked = Boolean(version.settings.repeatRhymeScheme);
    }
    if (distinguishSZInRhyme) {
      distinguishSZInRhyme.checked = Boolean(version.settings.distinguishSZInRhyme);
    }
    if (rioplatenseY) {
      rioplatenseY.checked = version.settings.rioplatenseY === undefined
        ? true
        : Boolean(version.settings.rioplatenseY);
    }
  }

  state.sinalefaOverrides = version.sinalefaOverrides && typeof version.sinalefaOverrides === 'object'
    ? { ...version.sinalefaOverrides }
    : {};
  state.lineOverrides = version.lineOverrides && typeof version.lineOverrides === 'object'
    ? { ...version.lineOverrides }
    : {};
  state.loadedVersionTitle = selectedPoemKey;
  state.loadedVersionId = selectedVersionId;
  saveLastWorkedPoemReference(selectedPoemKey, selectedVersionId);
  state.openAdvancedByLine = {};

  updateAnalysis();
  refreshSavedPoemVersionOptions(selectedPoemKey, selectedVersionId);
  syncQuickVersionLabelInput();
  updateVersionManagerStatus();
  return true;
}

function applySelectorEditMode(isEditMode) {
  state.selectorEditMode = Boolean(isEditMode);

  savedPoemName?.classList.toggle('hidden', state.selectorEditMode);
  savedPoemVersion?.classList.toggle('hidden', state.selectorEditMode);
  editPoemNameInput?.classList.toggle('hidden', !state.selectorEditMode);
  editPoemVersionInput?.classList.toggle('hidden', !state.selectorEditMode);
  editSelectors?.classList.toggle('hidden', state.selectorEditMode);
  saveSelectorEdits?.classList.toggle('hidden', !state.selectorEditMode);
  cancelSelectorEdits?.classList.toggle('hidden', !state.selectorEditMode);

  if (state.selectorEditMode) {
    if (editPoemNameInput) {
      const poemKey = String(savedPoemName?.value ?? '').trim();
      const store = loadPoemMemoryStore();
      editPoemNameInput.value = getStoredPoemTitle(poemKey, store.poems?.[poemKey]);
    }
    if (editPoemVersionInput) {
      editPoemVersionInput.value = String(syncQuickVersionLabelInput() ?? '').trim();
    }
  }
}

function saveSelectorEditsInline() {
  const currentPoemKey = String(savedPoemName?.value ?? '').trim();
  const nextTitle = String(editPoemNameInput?.value ?? '').trim();

  if (nextTitle && currentPoemKey) {
    const renamed = renamePoemTitleInline(currentPoemKey, nextTitle);
    if (!renamed) {
      showToast('No se pudo renombrar el poema seleccionado.', 'error');
      return;
    }
  }

  const selectedTitle = String(savedPoemName?.value ?? '').trim();
  const selectedVersionId = String(savedPoemVersion?.value ?? '').trim();
  if (selectedTitle && selectedVersionId && editPoemVersionInput) {
    updateVersionLabelInline(selectedTitle, selectedVersionId, editPoemVersionInput.value, { notify: true });
  }

  applySelectorEditMode(false);
}

function formatVersionTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'fecha desconocida';
  }
  return date.toLocaleString('es-ES');
}

function getVersionDownloadBaseName(title, version) {
  const versionLabel = normalizeVersionLabel(version?.label ?? '') || `version-${Number.isInteger(Number(version?.versionNumber)) ? Number(version.versionNumber) : '1'}`;
  return `${sanitizeFileNamePart(title)}-${sanitizeFileNamePart(versionLabel)}`;
}

function makeVersionSelectionKey(title, versionId) {
  return `${String(title ?? '')}::${String(versionId ?? '')}`;
}

function buildVersionMarkdownContent(title, version) {
  return `# ${normalizePoemTitle(title)}\n\n${normalizeInput(version?.poemText ?? '').trimEnd()}\n`;
}

function downloadTextFile(filename, content, mimeType) {
  if (!String(content ?? '').trim()) {
    return;
  }

  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function downloadTextAsPdf(filename, title, content) {
  const text = String(content ?? '').trim();
  if (!text) {
    return;
  }

  try {
    const module = await getJsPdfModule();
    const JsPdfCtor = module?.jsPDF ?? module?.default?.jsPDF ?? module?.default;
    if (typeof JsPdfCtor !== 'function') {
      throw new Error('jsPDF no está disponible.');
    }

    const pdf = new JsPdfCtor({ unit: 'pt', format: 'a4' });
    const marginLeft = 54;
    const marginTop = 54;
    const lineHeight = 16;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const usableWidth = pageWidth - (marginLeft * 2);
    const usableHeight = pageHeight - (marginTop * 2);
    const linesPerPage = Math.max(1, Math.floor(usableHeight / lineHeight));

    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text(String(title ?? 'Poema'), marginLeft, marginTop);

    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(12);

    const lines = text.split('\n');
    let currentLineCount = 2;
    for (const line of lines) {
      const wrappedLines = pdf.splitTextToSize(line, usableWidth) || [''];
      for (const wrappedLine of wrappedLines) {
        if (currentLineCount >= linesPerPage) {
          pdf.addPage();
          currentLineCount = 0;
        }

        const y = marginTop + (currentLineCount * lineHeight);
        pdf.text(String(wrappedLine ?? ''), marginLeft, y);
        currentLineCount += 1;
      }
    }

    pdf.save(filename);
  } catch {
    showToast('No se pudo generar el PDF.', 'error');
  }
}

function downloadVersionMarkdown(title, version) {
  const fileName = `${getVersionDownloadBaseName(title, version)}.md`;
  downloadTextFile(fileName, buildVersionMarkdownContent(title, version), 'text/markdown');
}

function downloadVersionPdf(title, version) {
  const fileName = `${getVersionDownloadBaseName(title, version)}.pdf`;
  downloadTextAsPdf(fileName, normalizePoemTitle(title), buildVersionMarkdownContent(title, version));
}

function normalizeVersionLabel(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 48);
}

function ensureVersionMetadata(versions) {
  if (!Array.isArray(versions) || !versions.length) {
    return false;
  }

  let changed = false;
  let maxVersionNumber = 0;

  for (const entry of versions) {
    const number = Number(entry?.versionNumber);
    if (Number.isInteger(number) && number > 0) {
      maxVersionNumber = Math.max(maxVersionNumber, number);
    }
  }

  const rankedByAge = [...versions].sort((a, b) => {
    const left = new Date(a?.savedAt ?? 0).getTime();
    const right = new Date(b?.savedAt ?? 0).getTime();
    return left - right;
  });

  for (const entry of rankedByAge) {
    const number = Number(entry?.versionNumber);
    if (Number.isInteger(number) && number > 0) {
      continue;
    }

    maxVersionNumber += 1;
    entry.versionNumber = maxVersionNumber;
    changed = true;
  }

  return changed;
}

function getNextVersionNumber(versions) {
  let maxVersionNumber = 0;
  for (const entry of versions) {
    const number = Number(entry?.versionNumber);
    if (Number.isInteger(number) && number > 0) {
      maxVersionNumber = Math.max(maxVersionNumber, number);
    }
  }

  return maxVersionNumber + 1;
}

function getVersionLabel(entry, index, total) {
  const label = normalizeVersionLabel(entry?.label ?? '');
  if (label) {
    return label;
  }

  return getDefaultVersionLabel(entry, index, total);
}

function getDefaultVersionLabel(entry, index, total) {
  const versionNumber = Number(entry?.versionNumber);
  if (Number.isInteger(versionNumber) && versionNumber > 0) {
    return `Versión ${versionNumber}`;
  }

  return `Versión ${total - index}`;
}

function updateSelectAllButtonLabel(totalItems) {
  if (!selectAllVersions) {
    return;
  }

  const checked = selectedVersionIds.size;
  selectAllVersions.innerHTML = `<span aria-hidden="true">☑</span> ${totalItems > 0 && checked >= totalItems ? 'Deseleccionar todo' : 'Seleccionar todo'}`;
  selectAllVersions.disabled = totalItems === 0;
}

function updateVersionManagerStatus() {
  if (!versionManagerStatus) {
    return;
  }

  const loadedVersion = String(state.loadedVersionId ?? '').trim();
  const loadedPoemKey = String(state.loadedVersionTitle ?? '').trim();
  const store = loadPoemMemoryStore();
  const loadedTitle = getStoredPoemTitle(loadedPoemKey, store.poems?.[loadedPoemKey]);
  const isOpen = Boolean(loadedVersion && loadedPoemKey);

  versionManagerStatus.classList.toggle('is-open', isOpen);
  versionManagerStatus.classList.toggle('is-closed', !isOpen);
  versionManagerStatus.textContent = isOpen ? `Poema abierto: ${loadedTitle}` : 'Poema cerrado';
}

function openVersionManagerModal() {
  if (!versionManagerModal || !managerShell) {
    return;
  }

  managerShell.open = true;
  versionManagerModal.classList.add('is-open');
  updateDefaultColorButton();
  updateVersionManagerStatus();
  renderSavedVersionList(savedPoemName?.value ?? '', savedPoemVersion?.value ?? '');
  versionSearchInput?.focus();
}

function closeVersionManagerModal() {
  if (!managerShell) {
    return;
  }

  managerShell.open = false;
}

function renderSavedVersionList(selectedPoemKey, preferredVersionId = '') {
  if (!savedVersionsList) {
    return;
  }

  const savedScrollTop = savedVersionsList.scrollTop;

  const previouslyOpenTitles = new Set(
    [...savedVersionsList.querySelectorAll('.poem-tree-node[open]')]
      .map((node) => String(node.dataset.title ?? '').trim())
      .filter(Boolean)
  );

  const store = loadPoemMemoryStore();
  renderPoemTrash();
  const searchQuery = normalizeSearchText(versionSearchInput?.value ?? '');
  const poems = getPoemEntries(store).sort((a, b) => a.title.localeCompare(b.title, 'es'));
  let totalVersions = 0;
  let metadataChanged = false;

  savedVersionsList.innerHTML = '';
  if (!poems.length) {
    selectedVersionIds = new Set();
    updateSelectAllButtonLabel(0);
    savedVersionsList.innerHTML = '<div class="saved-version-meta">No hay poemas guardados.</div>';
    return;
  }

  const validIds = new Set();
  for (const { poemKey, versions } of poems) {
    if (ensureVersionMetadata(versions)) {
      metadataChanged = true;
    }
    for (const version of versions) {
      validIds.add(makeVersionSelectionKey(poemKey, String(version.id ?? '')));
    }
  }

  if (metadataChanged) {
    savePoemMemoryStore(store);
  }

  selectedVersionIds = new Set([...selectedVersionIds].filter((id) => validIds.has(id)));

  let poemColorIndex = 0;
  for (const { poemKey, title: poemTitle, versions } of poems) {
    const ranked = [...versions].sort((a, b) => {
      const left = new Date(a.savedAt ?? 0).getTime();
      const right = new Date(b.savedAt ?? 0).getTime();
      return right - left;
    });

    const poemTitleMatches = searchQuery && normalizeSearchText(poemTitle).includes(searchQuery);
    const rankedWithIndex = ranked.map((entry, rankedIndex) => ({ entry, rankedIndex }));
    const visibleVersions = poemTitleMatches
      ? rankedWithIndex
      : rankedWithIndex.filter(({ entry, rankedIndex }) => {
          const label = getVersionLabel(entry, rankedIndex, ranked.length);
          const searchable = normalizeSearchText([
            poemTitle,
            label,
            entry.kind,
            entry.savedAt,
            entry.poemText
          ].join('\n'));
          return !searchQuery || searchable.includes(searchQuery);
        });

    if (!visibleVersions.length) {
      continue;
    }

    totalVersions += visibleVersions.length;

    const poemColors = loadPoemColors();
    const savedColor = poemColors[poemTitle];
    const poemNode = document.createElement('details');
    poemNode.className = 'poem-tree-node';
    poemNode.dataset.title = poemKey;
    poemNode.dataset.colorIndex = String(Number.isInteger(savedColor) ? savedColor : (poemColorIndex % POEM_COLOR_COUNT));
    const colorTheme = applyPoemColorTheme(poemNode, savedColor, poemColorIndex % POEM_COLOR_COUNT);
    poemColorIndex += 1;
    poemNode.open = searchQuery
      ? true
      : (previouslyOpenTitles.has(poemKey) || (!previouslyOpenTitles.size && poemKey === selectedPoemKey));

    const summary = document.createElement('summary');
    summary.className = 'poem-tree-summary';

    const indicator = document.createElement('span');
    indicator.className = 'poem-tree-indicator';
    indicator.textContent = '^';

    const poemTitleInput = document.createElement('input');
    poemTitleInput.type = 'text';
    poemTitleInput.className = 'poem-title-input';
    poemTitleInput.value = poemTitle;
    poemTitleInput.maxLength = 80;
    poemTitleInput.dataset.action = 'edit-poem-title';
    poemTitleInput.dataset.title = poemKey;
    poemTitleInput.title = 'Editar título del poema';

    const count = document.createElement('span');
    count.className = 'poem-tree-count';
    count.textContent = visibleVersions.length === ranked.length
      ? `${ranked.length} versión${ranked.length === 1 ? '' : 'es'}`
      : `${visibleVersions.length} de ${ranked.length} versión${ranked.length === 1 ? '' : 'es'}`;

    const poemActions = document.createElement('span');
    poemActions.className = 'poem-tree-actions';

    const poemColorBtn = document.createElement('button');
    poemColorBtn.type = 'button';
    poemColorBtn.className = 'secondary saved-version-action poem-color-btn';
    poemColorBtn.title = 'Cambiar color del poema';
    poemColorBtn.setAttribute('aria-label', 'Cambiar color del poema');
    poemColorBtn.dataset.action = 'edit-poem-color';
    poemColorBtn.dataset.title = poemKey;
    poemColorBtn.style.background = colorTheme.colorHex;
    poemColorBtn.style.borderColor = toRgba(colorTheme.colorHex, 0.45);

    const poemOpen = document.createElement('button');
    poemOpen.type = 'button';
    poemOpen.className = 'secondary compact-action saved-version-action';
    poemOpen.textContent = 'Abrir';
    poemOpen.dataset.action = 'load-poem';
    poemOpen.dataset.title = poemKey;

    const poemSelectAll = document.createElement('input');
    poemSelectAll.type = 'checkbox';
    poemSelectAll.className = 'poem-select-all';
    poemSelectAll.dataset.action = 'select-all-poem';
    poemSelectAll.dataset.title = poemKey;

    const poemMd = document.createElement('button');
    poemMd.type = 'button';
    poemMd.className = 'secondary format-action logo-action saved-version-action';
    poemMd.innerHTML = MD_LOGO_ICON;
    poemMd.dataset.action = 'download-poem-md';
    poemMd.dataset.title = poemKey;

    const poemPdf = document.createElement('button');
    poemPdf.type = 'button';
    poemPdf.className = 'secondary format-action logo-action saved-version-action';
    poemPdf.innerHTML = PDF_LOGO_ICON;
    poemPdf.dataset.action = 'download-poem-pdf';
    poemPdf.dataset.title = poemKey;

    const poemDelete = document.createElement('button');
    poemDelete.type = 'button';
    poemDelete.className = 'secondary saved-version-action is-danger';
    poemDelete.textContent = '🗑';
    poemDelete.dataset.action = 'delete-poem';
    poemDelete.dataset.title = poemKey;

    const poemVersionKeys = visibleVersions.map(({ entry }) => makeVersionSelectionKey(poemKey, String(entry.id ?? '')));
    poemSelectAll.checked = poemVersionKeys.every((key) => selectedVersionIds.has(key));

    poemSelectAll.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const shouldSelectAll = poemVersionKeys.some((key) => !selectedVersionIds.has(key));
      if (shouldSelectAll) {
        for (const key of poemVersionKeys) {
          selectedVersionIds.add(key);
        }
      } else {
        for (const key of poemVersionKeys) {
          selectedVersionIds.delete(key);
        }
      }

      renderSavedVersionList(savedPoemName?.value ?? '', savedPoemVersion?.value ?? '');
    });

    poemActions.append(poemColorBtn, poemOpen, poemMd, poemPdf, poemDelete);
    summary.append(poemSelectAll, poemTitleInput, count, poemActions, indicator);
    poemNode.append(summary);

    const poemVersionList = document.createElement('div');
    poemVersionList.className = 'poem-version-list';

    visibleVersions.forEach(({ entry, rankedIndex }) => {
      const item = document.createElement('div');
      item.className = 'saved-version-item';
      item.setAttribute('role', 'listitem');
      if (poemKey === selectedPoemKey && String(entry.id ?? '') === preferredVersionId) {
        item.classList.add('is-active');
      }

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'saved-version-checkbox';
      checkbox.value = makeVersionSelectionKey(poemKey, String(entry.id ?? ''));
      checkbox.checked = selectedVersionIds.has(checkbox.value);

      const text = document.createElement('span');
      text.className = 'saved-version-text';

      const main = document.createElement('span');
      main.className = 'saved-version-main';

      const label = document.createElement('input');
      label.type = 'text';
      label.className = 'saved-version-label-input';
      label.maxLength = 48;
      label.value = getVersionLabel(entry, rankedIndex, ranked.length);
      label.placeholder = getDefaultVersionLabel(entry, rankedIndex, ranked.length);
      label.title = 'Edita y presiona Enter para guardar el título de esta versión';
      label.dataset.action = 'edit-version-label';
      label.dataset.versionId = String(entry.id ?? '');
      label.dataset.title = poemKey;

      const kind = document.createElement('span');
      kind.className = 'saved-version-kind';
      kind.textContent = entry.kind === 'autosave' ? 'Auto' : 'Manual';

      const meta = document.createElement('span');
      meta.className = 'saved-version-meta';
      meta.textContent = formatVersionTimestamp(entry.savedAt);

      const actions = document.createElement('span');
      actions.className = 'saved-version-actions';

      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.className = 'secondary compact-action saved-version-action';
      openButton.textContent = 'Abrir';
      openButton.dataset.action = 'load-version';
      openButton.dataset.versionId = String(entry.id ?? '');
      openButton.dataset.title = poemKey;

      const mdButton = document.createElement('button');
      mdButton.type = 'button';
      mdButton.className = 'secondary format-action logo-action saved-version-action';
      mdButton.innerHTML = MD_LOGO_ICON;
      mdButton.dataset.action = 'download-md';
      mdButton.dataset.versionId = String(entry.id ?? '');
      mdButton.dataset.title = poemKey;

      const pdfButton = document.createElement('button');
      pdfButton.type = 'button';
      pdfButton.className = 'secondary format-action logo-action saved-version-action';
      pdfButton.innerHTML = PDF_LOGO_ICON;
      pdfButton.dataset.action = 'download-pdf';
      pdfButton.dataset.versionId = String(entry.id ?? '');
      pdfButton.dataset.title = poemKey;

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'secondary saved-version-action is-danger';
      deleteButton.textContent = '🗑';
      deleteButton.dataset.action = 'delete-version';
      deleteButton.dataset.versionId = String(entry.id ?? '');
      deleteButton.dataset.title = poemKey;

      const previewButton = document.createElement('button');
      previewButton.type = 'button';
      previewButton.className = 'secondary saved-version-action preview-action';
      previewButton.textContent = '👁';
      previewButton.title = 'Previsualizar versión';
      previewButton.dataset.action = 'preview-version';
      previewButton.dataset.versionId = String(entry.id ?? '');
      previewButton.dataset.title = poemKey;

      actions.append(previewButton, openButton, mdButton, pdfButton, deleteButton);

      main.append(label, kind);
      text.append(main, meta, actions);
      item.append(checkbox, text);
      poemVersionList.appendChild(item);
    });

    poemNode.appendChild(poemVersionList);
    savedVersionsList.appendChild(poemNode);
  }

  if (!totalVersions) {
    savedVersionsList.innerHTML = '<div class="saved-version-meta">No hay resultados para esa búsqueda.</div>';
  }

  updateSelectAllButtonLabel(totalVersions);

  // Restore scroll position after full DOM rebuild
  requestAnimationFrame(() => {
    savedVersionsList.scrollTop = savedScrollTop;
  });
}

function refreshSavedPoemVersionOptions(poemKey, preferredVersionId = '') {
  if (!savedPoemVersion) {
    return;
  }

  const store = loadPoemMemoryStore();
  const versions = Array.isArray(store.poems?.[poemKey]) ? store.poems[poemKey] : [];
  const metadataChanged = ensureVersionMetadata(versions);
  if (metadataChanged) {
    savePoemMemoryStore(store);
  }
  const ranked = [...versions].sort((a, b) => {
    const left = new Date(a.savedAt ?? 0).getTime();
    const right = new Date(b.savedAt ?? 0).getTime();
    return right - left;
  });

  savedPoemVersion.innerHTML = '';
  if (!ranked.length) {
    savedPoemVersion.innerHTML = '<option value="">Sin versiones</option>';
    savedPoemVersion.disabled = true;
    renderSavedVersionList(poemKey, preferredVersionId);
    syncQuickVersionLabelInput();
    return;
  }

  ranked.forEach((entry, index) => {
    const option = document.createElement('option');
    option.value = String(entry.id ?? '');
    option.textContent = `${getVersionLabel(entry, index, ranked.length)} · ${formatVersionTimestamp(entry.savedAt)}`;
    savedPoemVersion.appendChild(option);
  });

  savedPoemVersion.disabled = false;
  if (preferredVersionId && ranked.some((item) => String(item.id) === preferredVersionId)) {
    savedPoemVersion.value = preferredVersionId;
  }

  renderSavedVersionList(poemKey, preferredVersionId);
  syncQuickVersionLabelInput();
}

function refreshSavedPoemNameOptions(preferredPoemKey = '') {
  if (!savedPoemName) {
    return;
  }

  const store = loadPoemMemoryStore();
  const poems = getPoemEntries(store).sort((a, b) => a.title.localeCompare(b.title, 'es'));

  savedPoemName.innerHTML = '';
  if (!poems.length) {
    savedPoemName.innerHTML = '<option value="">Sin poemas guardados</option>';
    savedPoemName.disabled = true;
    refreshSavedPoemVersionOptions('', '');
    return;
  }

  for (const { poemKey, title } of poems) {
    const option = document.createElement('option');
    option.value = poemKey;
    option.textContent = title;
    savedPoemName.appendChild(option);
  }

  savedPoemName.disabled = false;
  const fallback = poems.some((poem) => poem.poemKey === preferredPoemKey)
    ? preferredPoemKey
    : poems[0].poemKey;
  savedPoemName.value = fallback;
  refreshSavedPoemVersionOptions(fallback);
}

function getSelectedSavedVersion() {
  const selectedTitle = savedPoemName?.value ?? '';
  const selectedVersionId = savedPoemVersion?.value ?? '';
  if (!selectedTitle || !selectedVersionId) {
    return null;
  }

  const store = loadPoemMemoryStore();
  const versions = Array.isArray(store.poems?.[selectedTitle]) ? store.poems[selectedTitle] : [];
  const version = versions.find((entry) => String(entry.id ?? '') === selectedVersionId);
  if (!version) {
    return null;
  }

  return {
    title: selectedTitle,
    version
  };
}

function buildCurrentSnapshot() {
  return {
    poemText: poemInput.value,
    settings: {
      poemFont: normalizePoemFont(state.poemFont),
      poeticForm: poeticForm?.value ?? 'custom',
      syllablePattern: syllablePattern?.value ?? '',
      stressPatterns: readStressPatternsFromControls(),
      hemistichSplit: hemistichSplit.value,
      rhymeMode: rhymeMode?.value ?? 'asonante',
      rhymeScheme: rhymeScheme?.value ?? '',
      repeatRhymeScheme: Boolean(repeatRhymeScheme?.checked),
      distinguishSZInRhyme: Boolean(distinguishSZInRhyme?.checked),
      rioplatenseY: Boolean(rioplatenseY?.checked)
    },
    sinalefaOverrides: state.sinalefaOverrides,
    lineOverrides: state.lineOverrides
  };
}

function dispatchPoemSaved(poemKey, title, version, previousTitle = '') {
  window.dispatchEvent(new CustomEvent('escandidor:poem-saved', {
    detail: {
      poemKey,
      title,
      previousTitle,
      version: structuredClone(version)
    }
  }));
}

function getSnapshotSignature(snapshot) {
  return JSON.stringify({
    poemText: String(snapshot.poemText ?? ''),
    settings: {
      poemFont: normalizePoemFont(snapshot.settings?.poemFont),
      poeticForm: String(snapshot.settings?.poeticForm ?? 'custom'),
      syllablePattern: String(snapshot.settings?.syllablePattern ?? ''),
      stressPatterns: resolveStoredStressPatterns(snapshot.settings),
      hemistichSplit: String(snapshot.settings?.hemistichSplit ?? ''),
      rhymeMode: String(snapshot.settings?.rhymeMode ?? 'asonante'),
      rhymeScheme: String(snapshot.settings?.rhymeScheme ?? ''),
      repeatRhymeScheme: Boolean(snapshot.settings?.repeatRhymeScheme),
      distinguishSZInRhyme: Boolean(snapshot.settings?.distinguishSZInRhyme),
      rioplatenseY: Boolean(snapshot.settings?.rioplatenseY)
    },
    sinalefaOverrides: snapshot.sinalefaOverrides ?? {},
    lineOverrides: snapshot.lineOverrides ?? {}
  });
}

function getVersionSnapshotSignature(entry) {
  return getSnapshotSignature({
    poemText: entry?.poemText,
    settings: entry?.settings,
    sinalefaOverrides: entry?.sinalefaOverrides,
    lineOverrides: entry?.lineOverrides
  });
}

function isCurrentDraftDirtyAgainstLoadedVersion() {
  const loadedTitle = String(state.loadedVersionTitle ?? '').trim();
  const loadedVersionId = String(state.loadedVersionId ?? '').trim();
  if (!loadedTitle || !loadedVersionId) {
    return false;
  }

  const store = loadPoemMemoryStore();
  const versions = Array.isArray(store.poems?.[loadedTitle]) ? store.poems[loadedTitle] : [];
  const loadedEntry = versions.find((entry) => String(entry.id ?? '') === loadedVersionId);
  if (!loadedEntry) {
    return false;
  }

  const loadedSignature = getVersionSnapshotSignature(loadedEntry);
  const currentSignature = getSnapshotSignature(buildCurrentSnapshot());
  return loadedSignature !== currentSignature;
}

function generateNewPoemTitle() {
  const store = loadPoemMemoryStore();
  const existing = new Set(getPoemEntries(store).map((poem) => poem.title));
  const base = 'Nuevo poema';
  if (!existing.has(base)) {
    return base;
  }
  let counter = 2;
  while (existing.has(`${base} ${counter}`)) {
    counter += 1;
  }
  return `${base} ${counter}`;
}

function createNewPoem() {
  const title = generateNewPoemTitle();

  if (poemTitle) {
    poemTitle.value = title;
  }
  setPoemTitleDisplay(title);
  poemInput.value = '';

  if (poeticForm) {
    poeticForm.value = 'custom';
  }
  if (syllablePattern) {
    syllablePattern.value = '';
  }

  renderStressPatternFields({});
  if (hemistichSplit) {
    hemistichSplit.value = '';
  }
  if (rhymeMode) {
    rhymeMode.value = 'asonante';
  }
  if (rhymeScheme) {
    rhymeScheme.value = '';
  }
  if (repeatRhymeScheme) {
    repeatRhymeScheme.checked = false;
  }
  if (distinguishSZInRhyme) {
    distinguishSZInRhyme.checked = false;
  }
  if (rioplatenseY) {
    rioplatenseY.checked = true;
  }

  state.sinalefaOverrides = {};
  state.lineOverrides = {};
  state.openAdvancedByLine = {};
  state.loadedVersionTitle = '';
  state.loadedVersionId = '';

  applyPoemFont(loadDefaultPoemFont());

  const defaultColor = loadDefaultPoemColor();
  if (isHexColor(defaultColor)) {
    setPoemCustomColor(title, defaultColor);
  }

  saveCurrentPoemVersion({ notify: false });
  refreshSavedPoemNameOptions(state.loadedVersionTitle);
  updateAnalysis();
  applyPoemScreenTheme(title);
  poemInput.focus();
  showToast('Nuevo poema creado.', 'success');
}

function saveCurrentPoemVersion(options = {}) {
  const {
    notify = false,
    notifyWhenUnchanged = false,
    kind = 'manual'
  } = options;
  const saveKind = kind === 'autosave' ? 'autosave' : 'manual';

  const title = normalizePoemTitle(poemTitle?.value ?? '');
  if (poemTitle) {
    poemTitle.value = title;
  }
  setPoemTitleDisplay(title);

  const loadedPoemKey = String(state.loadedVersionTitle ?? '').trim();
  const loadedVersionId = String(state.loadedVersionId ?? '').trim();
  const store = loadPoemMemoryStore();
  const poemKey = loadedPoemKey && loadedVersionId && Array.isArray(store.poems[loadedPoemKey])
    ? loadedPoemKey
    : createLocalPoemKey();
  const versions = Array.isArray(store.poems[poemKey]) ? store.poems[poemKey] : [];
  const previousTitle = versions.length ? getStoredPoemTitle(poemKey, versions) : '';
  setStoredPoemTitle(versions, title);
  store.poems[poemKey] = versions;
  ensureVersionMetadata(versions);
  const nextVersionNumber = getNextVersionNumber(versions);

  const snapshot = buildCurrentSnapshot();
  const latest = versions.at(-1);
  const nextSignature = getSnapshotSignature(snapshot);
  const nextVersion = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
    poemText: snapshot.poemText,
    settings: snapshot.settings,
    sinalefaOverrides: snapshot.sinalefaOverrides,
    lineOverrides: snapshot.lineOverrides,
    kind: saveKind,
    label: '',
    versionNumber: nextVersionNumber,
    poemTitle: title
  };

  if (latest) {
    const latestSignature = getSnapshotSignature({
      poemText: latest.poemText,
      settings: latest.settings,
      sinalefaOverrides: latest.sinalefaOverrides,
      lineOverrides: latest.lineOverrides
    });
    const latestKind = String(latest.kind ?? 'manual');
    const latestWasAutosave = latestKind === 'autosave';
    const shouldReplaceLatest = latestWasAutosave && (saveKind === 'autosave' || saveKind === 'manual');

    if (shouldReplaceLatest) {
      const preservedVersionNumber = Number.isInteger(Number(latest.versionNumber)) && Number(latest.versionNumber) > 0
        ? Number(latest.versionNumber)
        : nextVersionNumber;
      versions[versions.length - 1] = {
        ...latest,
        ...nextVersion,
        versionNumber: preservedVersionNumber,
        label: normalizeVersionLabel(latest.label ?? '')
      };
    } else if (latestSignature === nextSignature && latestKind === saveKind) {
      refreshSavedPoemNameOptions(poemKey);
      refreshSavedPoemVersionOptions(poemKey, String(latest.id ?? ''));
      if (notify && notifyWhenUnchanged) {
        showToast('Sin cambios para guardar.', 'warning');
      }
      if (saveKind === 'manual') {
        dispatchPoemSaved(poemKey, title, latest, previousTitle !== title ? previousTitle : '');
      }
      return false;
    } else {
      versions.push(nextVersion);
    }
  } else {
    versions.push(nextVersion);
  }

  const ok = savePoemMemoryStore(store);
  if (!ok) {
    if (notify) {
      showToast('No se pudo guardar el poema.', 'error');
    }
    return false;
  }

  if (previousTitle && previousTitle !== title) {
    renamePoemColorKey(previousTitle, title);
    renameRhymeColorStoreKey(previousTitle, title);
  }

  refreshSavedPoemNameOptions(poemKey);
  refreshSavedPoemVersionOptions(poemKey, nextVersion.id);
  state.loadedVersionTitle = poemKey;
  state.loadedVersionId = String(nextVersion.id ?? '');
  saveLastWorkedPoemReference(poemKey, state.loadedVersionId);
  updateVersionManagerStatus();
  if (notify) {
    showToast('Poema guardado.', 'success');
  }
  if (saveKind === 'manual') {
    dispatchPoemSaved(poemKey, title, nextVersion, previousTitle !== title ? previousTitle : '');
  }
  return true;
}

function getSelectedPoemVersionEntry() {
  const selectedTitle = savedPoemName?.value ?? '';
  const selectedVersionId = savedPoemVersion?.value ?? '';
  if (!selectedTitle || !selectedVersionId) {
    return null;
  }

  const store = loadPoemMemoryStore();
  const versions = Array.isArray(store.poems?.[selectedTitle]) ? store.poems[selectedTitle] : [];
  const versionIndex = versions.findIndex((entry) => String(entry.id ?? '') === selectedVersionId);
  if (versionIndex < 0) {
    return null;
  }

  return {
    title: selectedTitle,
    versionIndex,
    version: versions[versionIndex]
  };
}

function syncQuickVersionLabelInput() {
  if (!editPoemVersionInput) {
    return '';
  }

  const selected = getSelectedPoemVersionEntry();
  if (!selected) {
    editPoemVersionInput.value = '';
    editPoemVersionInput.placeholder = 'Nombre de versión';
    editPoemVersionInput.disabled = true;
    editPoemVersionInput.dataset.title = '';
    editPoemVersionInput.dataset.versionId = '';
    return '';
  }

  const store = loadPoemMemoryStore();
  const versions = Array.isArray(store.poems?.[selected.title]) ? store.poems[selected.title] : [];
  const ranked = [...versions].sort((a, b) => new Date(b.savedAt ?? 0).getTime() - new Date(a.savedAt ?? 0).getTime());
  const rankedIndex = ranked.findIndex((entry) => String(entry.id ?? '') === String(selected.version.id ?? ''));
  const rankedEntry = ranked[rankedIndex];

  if (!rankedEntry) {
    const value = getVersionLabel(selected.version, 0, 1);
    editPoemVersionInput.value = value;
    editPoemVersionInput.placeholder = getDefaultVersionLabel(selected.version, 0, 1);
    editPoemVersionInput.disabled = false;
    editPoemVersionInput.dataset.title = selected.title;
    editPoemVersionInput.dataset.versionId = String(selected.version.id ?? '');
    return value;
  }

  const value = getVersionLabel(rankedEntry, rankedIndex, ranked.length);
  editPoemVersionInput.value = value;
  editPoemVersionInput.placeholder = getDefaultVersionLabel(rankedEntry, rankedIndex, ranked.length);
  editPoemVersionInput.disabled = false;
  editPoemVersionInput.dataset.title = selected.title;
  editPoemVersionInput.dataset.versionId = String(selected.version.id ?? '');
  return value;
}

function updateVersionLabelInline(title, versionId, nextValue, options = {}) {
  const { notify = false } = options;
  const normalizedTitle = String(title ?? '').trim();
  const normalizedVersionId = String(versionId ?? '').trim();
  if (!normalizedTitle || !normalizedVersionId) {
    return;
  }

  const store = loadPoemMemoryStore();
  const versions = Array.isArray(store.poems?.[normalizedTitle]) ? store.poems[normalizedTitle] : [];
  if (!versions.length) {
    return;
  }

  const versionIndex = versions.findIndex((entry) => String(entry.id ?? '') === normalizedVersionId);
  if (versionIndex < 0) {
    return;
  }

  const ranked = [...versions].sort((a, b) => new Date(b.savedAt ?? 0).getTime() - new Date(a.savedAt ?? 0).getTime());
  const rankedIndex = ranked.findIndex((entry) => String(entry.id ?? '') === normalizedVersionId);
  const rankedEntry = ranked[rankedIndex];
  if (!rankedEntry) {
    return;
  }

  const defaultLabel = getDefaultVersionLabel(rankedEntry, rankedIndex, ranked.length);
  const typedLabel = normalizeVersionLabel(nextValue);
  const normalizedTarget = typedLabel && typedLabel !== defaultLabel ? typedLabel : '';
  const currentLabel = normalizeVersionLabel(versions[versionIndex].label ?? '');

  if (normalizedTarget === currentLabel) {
    return;
  }

  versions[versionIndex] = {
    ...versions[versionIndex],
    label: normalizedTarget
  };

  if (!savePoemMemoryStore(store)) {
    showToast('No se pudo actualizar el título de la versión.', 'error');
    return;
  }

  refreshSavedPoemNameOptions(normalizedTitle);
  refreshSavedPoemVersionOptions(normalizedTitle, normalizedVersionId);
  updateVersionManagerStatus();

  if (notify) {
    showToast(normalizedTarget ? 'Título de versión actualizado.' : 'Título de versión restablecido.', 'success');
  }
}

function getCheckedVersionIds() {
  return [...selectedVersionIds];
}

function getCheckedVersionEntries() {
  const ids = getCheckedVersionIds();
  if (!ids.length) {
    return [];
  }

  const selectedSet = new Set(ids);
  const store = loadPoemMemoryStore();
  const entries = [];

  for (const { poemKey, title, versions } of getPoemEntries(store)) {
    if (!Array.isArray(versions) || !versions.length) {
      continue;
    }

    for (const version of versions) {
      const key = makeVersionSelectionKey(poemKey, String(version?.id ?? ''));
      if (selectedSet.has(key)) {
        entries.push({ poemKey, title, version });
      }
    }
  }

  return entries;
}

function downloadSelectedVersionsAsMarkdown() {
  const entries = getCheckedVersionEntries();
  if (!entries.length) {
    showToast('Selecciona al menos una versión.', 'warning');
    return;
  }

  const sections = entries.map(({ title, version }) => buildVersionMarkdownContent(title, version).trimEnd());
  const combined = sections.join('\n\n---\n\n') + '\n';
  const fileName = entries.length === 1
    ? `${getVersionDownloadBaseName(entries[0].title, entries[0].version)}.md`
    : 'seleccion.md';
  downloadTextFile(fileName, combined, 'text/markdown');
}

async function downloadSelectedVersionsAsPdf() {
  const entries = getCheckedVersionEntries();
  if (!entries.length) {
    showToast('Selecciona al menos una versión.', 'warning');
    return;
  }

  if (entries.length === 1) {
    downloadVersionPdf(entries[0].title, entries[0].version);
    return;
  }

  try {
    const module = await getJsPdfModule();
    const JsPdfCtor = module?.jsPDF ?? module?.default?.jsPDF ?? module?.default;
    if (typeof JsPdfCtor !== 'function') throw new Error('jsPDF no disponible.');

    const pdf = new JsPdfCtor({ unit: 'pt', format: 'a4' });
    const marginLeft = 54;
    const marginTop = 54;
    const lineHeightBody = 16;
    const lineHeightTitle = 24;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const usableWidth = pageWidth - marginLeft * 2;
    let y = marginTop;

    const addLine = (text, bold, size) => {
      const lh = bold ? lineHeightTitle : lineHeightBody;
      const wrapped = pdf.splitTextToSize(String(text ?? ''), usableWidth) || [''];
      for (const line of wrapped) {
        if (y + lh > pageHeight - marginTop) {
          pdf.addPage();
          y = marginTop;
        }
        pdf.setFont('Helvetica', bold ? 'bold' : 'normal');
        pdf.setFontSize(size ?? (bold ? 16 : 12));
        pdf.text(String(line ?? ''), marginLeft, y);
        y += lh;
      }
    };

    entries.forEach(({ title, version }, i) => {
      if (i > 0) {
        y += lineHeightBody;
        if (y + 40 > pageHeight - marginTop) {
          pdf.addPage();
          y = marginTop;
        }
        pdf.setDrawColor(180, 160, 140);
        pdf.line(marginLeft, y, pageWidth - marginLeft, y);
        y += lineHeightBody;
      }
      addLine(normalizePoemTitle(title), true, 16);
      y += 6;
      const bodyText = String(version?.poemText ?? '').trimEnd();
      for (const line of bodyText.split('\n')) {
        addLine(line, false, 12);
      }
    });

    pdf.save('seleccion.pdf');
    showToast('PDF descargado.', 'success');
  } catch {
    showToast('No se pudo generar el PDF.', 'error');
  }
}

function renamePoemTitleInline(poemKey, nextTitleRaw) {
  const selectedPoemKey = String(poemKey ?? '').trim();
  const targetTitle = normalizePoemTitle(nextTitleRaw);
  if (!selectedPoemKey || !targetTitle) {
    return false;
  }

  const selectedTitleBefore = String(savedPoemName?.value ?? '').trim();
  const selectedVersionBefore = String(savedPoemVersion?.value ?? '').trim();
  const visibleTitleBefore = normalizePoemTitle(poemTitle?.value ?? '');
  const store = loadPoemMemoryStore();
  const sourceVersions = Array.isArray(store.poems?.[selectedPoemKey]) ? store.poems[selectedPoemKey] : [];
  if (!sourceVersions.length) {
    return false;
  }
  const sourceTitle = getStoredPoemTitle(selectedPoemKey, sourceVersions);
  const wasVisibleOnPage =
    visibleTitleBefore === sourceTitle ||
    state.currentAnalysisTitle === sourceTitle ||
    selectedTitleBefore === selectedPoemKey ||
    state.loadedVersionTitle === selectedPoemKey;
  if (sourceTitle === targetTitle) return true;
  setStoredPoemTitle(sourceVersions, targetTitle);

  if (!savePoemMemoryStore(store)) {
    showToast('No se pudo renombrar el poema.', 'error');
    return false;
  }

  if (state.currentAnalysisTitle === sourceTitle) {
    state.currentAnalysisTitle = targetTitle;
  }

  renamePoemColorKey(sourceTitle, targetTitle);
  renameRhymeColorStoreKey(sourceTitle, targetTitle);

  const previousLastWorked = loadLastWorkedPoemReference();
  if (previousLastWorked && previousLastWorked.title === selectedPoemKey) {
    saveLastWorkedPoemReference(selectedPoemKey, previousLastWorked.versionId);
  }

  const preferredPoemKey = selectedTitleBefore === selectedPoemKey
    ? selectedPoemKey
    : (selectedTitleBefore || selectedPoemKey);
  const preferredVersionId = selectedTitleBefore === selectedPoemKey
    ? selectedVersionBefore
    : String(savedPoemVersion?.value ?? selectedVersionBefore);

  refreshSavedPoemNameOptions(preferredPoemKey);
  if (preferredPoemKey) {
    refreshSavedPoemVersionOptions(preferredPoemKey, preferredVersionId);
  }

  if (wasVisibleOnPage) {
    if (poemTitle) {
      poemTitle.value = targetTitle;
    }
    setPoemTitleDisplay(targetTitle);
    applyPoemScreenTheme(targetTitle);
  }

  renderSavedVersionList(preferredPoemKey, preferredVersionId);
  syncQuickVersionLabelInput();
  updateVersionManagerStatus();
  return true;
}

function deleteSelectedPoemVersions() {
  const checkedIds = getCheckedVersionIds();
  if (!checkedIds.length) {
    return;
  }

  const store = loadPoemMemoryStore();
  const deleteSet = new Set(checkedIds);
  const targetsByTitle = new Map();
  const titlesByPoemKey = new Map(getPoemEntries(store).map(({ poemKey, title }) => [poemKey, title]));

  for (const { poemKey, versions } of getPoemEntries(store)) {
    if (!Array.isArray(versions) || !versions.length) {
      continue;
    }

    const targetIds = versions
      .filter((entry) => deleteSet.has(makeVersionSelectionKey(poemKey, String(entry.id ?? ''))))
      .map((entry) => String(entry.id ?? ''));

    if (targetIds.length) {
      targetsByTitle.set(poemKey, new Set(targetIds));
    }
  }

  const selectedCount = [...targetsByTitle.values()].reduce((total, set) => total + set.size, 0);

  if (!selectedCount) {
    return;
  }

  const shouldDelete = window.confirm(`¿Eliminar ${selectedCount} versión${selectedCount === 1 ? '' : 'es'} seleccionada${selectedCount === 1 ? '' : 's'}?`);
  if (!shouldDelete) {
    return;
  }

  for (const { poemKey, title, versions } of getPoemEntries(store)) {
    const targets = targetsByTitle.get(poemKey);
    if (!targets?.size) {
      continue;
    }

    const removed = versions.filter((entry) => targets.has(String(entry.id ?? '')));
    movePoemToTrash(store, title, removed);

    const remaining = versions.filter((entry) => !targets.has(String(entry.id ?? '')));
    if (remaining.length) {
      store.poems[poemKey] = remaining;
    } else {
      delete store.poems[poemKey];
    }
  }

  if (!savePoemMemoryStore(store)) {
    showToast('No se pudieron borrar las versiones.', 'error');
    return;
  }

  for (const [poemKey, targets] of targetsByTitle) {
    const versions = store.poems[poemKey];
    const title = titlesByPoemKey.get(poemKey) || getStoredPoemTitle(poemKey, versions);
    dispatchPoemDeleted(poemKey, title, [...targets], !versions);
  }

  const fallbackTitle = savedPoemName?.value ?? '';
  refreshSavedPoemNameOptions(fallbackTitle);

  selectedVersionIds = new Set();
  renderSavedVersionList(savedPoemName?.value ?? '', savedPoemVersion?.value ?? '');
  updateVersionManagerStatus();

  showToast(`${selectedCount} versión${selectedCount === 1 ? '' : 'es'} borrada${selectedCount === 1 ? '' : 's'}.`, 'success');
}

function scheduleAutoSave() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }

  autoSaveTimer = setTimeout(() => {
    saveCurrentPoemVersion({ kind: 'autosave' });
  }, AUTO_SAVE_DELAY_MS);
}

function loadSelectedPoemVersion() {
  const selectedTitle = String(savedPoemName?.value ?? '').trim();
  const selectedVersionId = String(savedPoemVersion?.value ?? '').trim();
  if (!selectedTitle || !selectedVersionId) {
    return;
  }
  loadVersionById(selectedTitle, selectedVersionId);
}

function deleteSelectedPoemVersion() {
  const selectedTitle = savedPoemName?.value ?? '';
  const selectedVersionId = savedPoemVersion?.value ?? '';
  if (!selectedTitle || !selectedVersionId) {
    return;
  }

  const store = loadPoemMemoryStore();
  const versions = Array.isArray(store.poems?.[selectedTitle]) ? store.poems[selectedTitle] : [];
  if (!versions.length) {
    return;
  }

  const target = versions.find((entry) => String(entry.id ?? '') === selectedVersionId);
  if (!target) {
    return;
  }

  const selectedDisplayTitle = getStoredPoemTitle(selectedTitle, versions);
  const shouldDelete = window.confirm(`¿Eliminar la versión guardada de "${selectedDisplayTitle}" (${formatVersionTimestamp(target.savedAt)})?`);
  if (!shouldDelete) {
    return;
  }

  movePoemToTrash(store, getStoredPoemTitle(selectedTitle, versions), [target]);

  const remaining = versions.filter((entry) => String(entry.id ?? '') !== selectedVersionId);
  if (remaining.length) {
    store.poems[selectedTitle] = remaining;
  } else {
    delete store.poems[selectedTitle];
  }

  const ok = savePoemMemoryStore(store);
  if (!ok) {
    return;
  }

  dispatchPoemDeleted(
    selectedTitle,
    getStoredPoemTitle(selectedTitle, versions),
    [selectedVersionId],
    !remaining.length,
  );

  if (state.loadedVersionTitle === selectedTitle && state.loadedVersionId === selectedVersionId) {
    state.loadedVersionTitle = '';
    state.loadedVersionId = '';
  }

  refreshSavedPoemNameOptions(selectedTitle);
  if (store.poems[selectedTitle]?.length) {
    refreshSavedPoemVersionOptions(selectedTitle);
    loadSelectedPoemVersion();
  } else if ((savedPoemName?.value ?? '') && !savedPoemName.disabled) {
    loadSelectedPoemVersion();
  }
  updateVersionManagerStatus();
}

function deleteSelectedPoemEntry() {
  const selectedTitle = savedPoemName?.value ?? '';
  if (!selectedTitle) {
    return;
  }

  const store = loadPoemMemoryStore();
  const versions = Array.isArray(store.poems?.[selectedTitle]) ? store.poems[selectedTitle] : [];
  const selectedDisplayTitle = getStoredPoemTitle(selectedTitle, versions);
  const shouldDelete = window.confirm(`¿Eliminar todo el historial del poema "${selectedDisplayTitle}"?`);
  if (!shouldDelete) {
    return;
  }

  if (versions.length) {
    movePoemToTrash(store, getStoredPoemTitle(selectedTitle, versions), versions);
  }
  delete store.poems[selectedTitle];

  const ok = savePoemMemoryStore(store);
  if (!ok) {
    return;
  }

  dispatchPoemDeleted(
    selectedTitle,
    getStoredPoemTitle(selectedTitle, versions),
    versions.map((entry) => String(entry.id ?? '')),
    true,
  );

  if (state.loadedVersionTitle === selectedTitle) {
    state.loadedVersionTitle = '';
    state.loadedVersionId = '';
  }

  refreshSavedPoemNameOptions('');
  if ((savedPoemName?.value ?? '') && !savedPoemName.disabled) {
    loadSelectedPoemVersion();
  }
  updateVersionManagerStatus();
}

function parsePoemsFromMarkdown(markdown) {
  const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
  const poems = [];
  let currentTitle = '';
  let currentLines = [];

  const flush = () => {
    if (!currentTitle) {
      return;
    }
    poems.push({
      title: normalizePoemTitle(currentTitle),
      text: currentLines.join('\n').trim()
    });
    currentLines = [];
  };

  for (const line of lines) {
    const heading = line.match(/^#\s*(.+?)\s*$/);
    if (heading) {
      flush();
      currentTitle = heading[1];
      continue;
    }

    if (currentTitle) {
      currentLines.push(line);
    }
  }

  flush();
  return poems.filter((item) => item.title && item.text.trim());
}

function importPoemsFromMarkdown(markdown) {
  const parsed = parsePoemsFromMarkdown(markdown);
  if (!parsed.length) {
    return;
  }

  const store = loadPoemMemoryStore();
  const importedPoemKeys = [];
  for (const entry of parsed) {
    const poemKey = createLocalPoemKey();
    importedPoemKeys.push(poemKey);
    store.poems[poemKey] = [];
    const nextVersionNumber = 1;

    store.poems[poemKey].push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      savedAt: new Date().toISOString(),
      poemText: entry.text,
      settings: {
        poemFont: normalizePoemFont(state.poemFont),
        poeticForm: poeticForm?.value ?? 'custom',
        syllablePattern: syllablePattern?.value ?? '',
        stressPatterns: readStressPatternsFromControls(),
        hemistichSplit: hemistichSplit.value,
        rhymeMode: rhymeMode?.value ?? 'asonante',
        rhymeScheme: rhymeScheme?.value ?? '',
        repeatRhymeScheme: Boolean(repeatRhymeScheme?.checked),
        distinguishSZInRhyme: Boolean(distinguishSZInRhyme?.checked),
        rioplatenseY: Boolean(rioplatenseY?.checked)
      },
      sinalefaOverrides: {},
      lineOverrides: {},
      kind: 'manual',
      label: '',
      versionNumber: nextVersionNumber,
      poemTitle: entry.title
    });
  }

  const ok = savePoemMemoryStore(store);
  if (!ok) {
    return;
  }

  const first = parsed[0];
  refreshSavedPoemNameOptions(importedPoemKeys[0] ?? '');
  if (poemTitle) {
    poemTitle.value = first.title;
  }
  setPoemTitleDisplay(first.title);
  poemInput.value = first.text;
  updateAnalysis();
}

function downloadMarkdownFile() {
  const content = buildPoemMarkdownExport();
  if (!content.trim()) {
    return;
  }

  const fileName = `${sanitizeFileNamePart(normalizePoemTitle(poemTitle?.value ?? 'poema')) || 'poema'}.md`;
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const JSPDF_CDN_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm';
let jsPdfModulePromise = null;

function buildPoemMarkdownExport() {
  const title = normalizePoemTitle(poemTitle?.value ?? '') || 'Poema';
  return `# ${title}\n\n${normalizeInput(poemInput.value).trimEnd()}\n`;
}

async function getJsPdfModule() {
  if (!jsPdfModulePromise) {
    jsPdfModulePromise = import(JSPDF_CDN_URL);
  }

  return jsPdfModulePromise;
}

async function downloadPoemPdfFile() {
  const markdownText = buildPoemMarkdownExport();
  if (!markdownText.trim()) {
    return;
  }

  try {
    const module = await getJsPdfModule();
    const JsPdfCtor = module?.jsPDF ?? module?.default?.jsPDF ?? module?.default;
    if (typeof JsPdfCtor !== 'function') {
      throw new Error('jsPDF no está disponible.');
    }

    const pdf = new JsPdfCtor({ unit: 'pt', format: 'a4' });
    const marginLeft = 54;
    const marginTop = 54;
    const lineHeight = 16;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const usableWidth = pageWidth - (marginLeft * 2);
    const usableHeight = pageHeight - (marginTop * 2);
    const linesPerPage = Math.max(1, Math.floor(usableHeight / lineHeight));

    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(12);

    const markdownLines = markdownText.split('\n');
    let currentLineCount = 0;

    for (const rawLine of markdownLines) {
      const isHeading = rawLine.startsWith('# ');
      const text = isHeading ? rawLine.slice(2) : rawLine;
      const wrappedLines = pdf.splitTextToSize(text, usableWidth) || [''];

      for (const wrappedLine of wrappedLines) {
        if (currentLineCount >= linesPerPage) {
          pdf.addPage();
          currentLineCount = 0;
        }

        if (isHeading) {
          pdf.setFont('Helvetica', 'bold');
          pdf.setFontSize(16);
        } else {
          pdf.setFont('Helvetica', 'normal');
          pdf.setFontSize(12);
        }

        const y = marginTop + (currentLineCount * lineHeight);
        pdf.text(String(wrappedLine ?? ''), marginLeft, y);
        currentLineCount += 1;
      }

      if (currentLineCount >= linesPerPage) {
        pdf.addPage();
        currentLineCount = 0;
      }
    }

    const fileName = `${normalizePoemTitle(poemTitle?.value ?? 'poema') || 'poema'}.pdf`;
    pdf.save(fileName);
    showToast('PDF descargado.', 'success');
  } catch (error) {
    showToast('No se pudo generar el PDF.', 'error');
  }
}

function formatWordPlain(wordAnalysis) {
  if (!wordAnalysis?.syllables?.length) {
    return String(wordAnalysis?.original ?? '');
  }

  const displayStressIndices = getDisplayStressIndices(wordAnalysis);

  return wordAnalysis.syllables
    .map((syllable, index) => {
      if (displayStressIndices.has(index)) {
        return `**${syllable}**`;
      }
      return syllable;
    })
    .join('-');
}

function renderAnnotatedLinePlain(runtime) {
  const chunks = [];
  const { lineAnalysis, activeBoundaries, hemistichBoundaries } = runtime;

  for (let index = 0; index < lineAnalysis.analyses.length; index += 1) {
    chunks.push(formatWordPlain(lineAnalysis.analyses[index]));

    if (index >= lineAnalysis.analyses.length - 1) {
      continue;
    }

    const boundary = activeBoundaries[index];
    const separator = lineAnalysis.separators[index] ?? ' ';
    const cleanedSeparator = separator.replace(/\//g, '');

    if (boundary?.active) {
      chunks.push(/[^\s]/.test(cleanedSeparator) ? `${cleanedSeparator}⏝` : '⏝');
    } else {
      chunks.push(cleanedSeparator);
    }

    if (hemistichBoundaries.includes(index)) {
      chunks.push(' / ');
    }
  }

  return chunks.join('');
}

function renderPositionTrackPlain(runtime) {
  const targetSet = new Set(runtime.effectivePattern);
  const merged = [...new Set([...runtime.metricStress, ...runtime.effectivePattern])].sort((a, b) => a - b);

  if (!merged.length) {
    return '-';
  }

  return merged
    .map((position) => {
      if (!targetSet.has(position)) {
        return String(position);
      }
      const status = resolveVersalStatus(runtime.metricEntries, position, runtime.versalConflictPositions);
      const marker = status === 'green' ? 'G' : status === 'red' ? 'R' : 'Y';
      return `${position}${marker}`;
    })
    .join('-');
}

function buildAnalysisText(runtimes, stanzaSummary) {
  const output = [];
  for (const runtime of runtimes) {
    const rawLine = runtime.lineAnalysis.text;
    if (!rawLine.trim()) {
      output.push('');
      continue;
    }

    output.push(`${renderAnnotatedLinePlain(runtime)} ${runtime.rhyme.label} ${runtime.countLabel}`.trim());
  }

  return output.join('\n').trimEnd();
}

function applyAnalysisMode() {
  const textMode = state.analysisMode === 'text';
  if (analysisOutput) {
    analysisOutput.classList.toggle('hidden', textMode);
  }
  if (analysisTextOutput) {
    analysisTextOutput.classList.toggle('hidden', !textMode);
  }
  if (copyAnalysisText) {
    copyAnalysisText.classList.toggle('hidden', !textMode);
  }
  if (analysisModeToggle) {
    analysisModeToggle.textContent = textMode ? 'Modo visual' : 'Modo texto';
  }
}

function captureInlineInputFocus() {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement) && !(active instanceof HTMLSelectElement)) {
    return null;
  }

  const role = active.dataset.role;
  const line = active.dataset.line;
  if (!role || line === undefined) {
    return null;
  }

  return {
    role,
    line,
    selectionStart: active.selectionStart,
    selectionEnd: active.selectionEnd
  };
}

function restoreInlineInputFocus(snapshot) {
  if (!snapshot) {
    return;
  }

  const selector = `[data-role="${snapshot.role}"][data-line="${snapshot.line}"]`;
  const input = analysisOutput.querySelector(selector);
  if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLSelectElement)) {
    return;
  }

  input.focus();
  if (
    input instanceof HTMLInputElement &&
    typeof snapshot.selectionStart === 'number' &&
    typeof snapshot.selectionEnd === 'number'
  ) {
    const max = input.value.length;
    const start = Math.max(0, Math.min(snapshot.selectionStart, max));
    const end = Math.max(0, Math.min(snapshot.selectionEnd, max));
    input.setSelectionRange(start, end);
  }
}

function getLineStartOffsetInText(text, targetLineIndex) {
  const source = String(text ?? '');
  if (!Number.isInteger(targetLineIndex) || targetLineIndex <= 0) {
    return 0;
  }

  let lineIndex = 0;
  for (let cursor = 0; cursor < source.length; cursor += 1) {
    const current = source[cursor];
    if (current === '\r') {
      if (source[cursor + 1] === '\n') {
        cursor += 1;
      }
      lineIndex += 1;
      if (lineIndex === targetLineIndex) {
        return cursor + 1;
      }
      continue;
    }

    if (current === '\n') {
      lineIndex += 1;
      if (lineIndex === targetLineIndex) {
        return cursor + 1;
      }
    }
  }

  return source.length;
}

function focusPoemLine(lineIndex) {
  if (!poemInput || !Number.isInteger(lineIndex) || lineIndex < 0) {
    return;
  }

  const offset = getLineStartOffsetInText(poemInput.value, lineIndex);
  poemInput.focus();
  poemInput.setSelectionRange(offset, offset);

  const lineHeight = Number.parseFloat(window.getComputedStyle(poemInput).lineHeight) || 18;
  poemInput.scrollTop = Math.max(0, lineIndex * lineHeight - lineHeight * 1.5);
}

function getEffectiveRhymeMode(lineIndex) {
  const local = String(getLineOverride(lineIndex).rhymeMode ?? '').trim();
  if (local) {
    return normalizeRhymeMode(local);
  }
  return state.rhymeMode;
}

function normalizeRhymeScheme(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

function normalizeRhymeApostrophes(value) {
  return String(value ?? '').replace(/[´`’‘]/g, "'");
}

function formatRhymeSchemeDisplayToken(value) {
  return normalizeRhymeApostrophes(String(value ?? '').trim()).replace(/'/g, '´');
}

function formatRhymeChipLabel(runtime) {
  const label = String(runtime?.rhyme?.label ?? '').trim() || '-';
  if (label === '-' || runtime?.lineAnalysis?.accentType !== 'aguda') {
    return label;
  }

  if (label.endsWith('´')) {
    return label;
  }

  return `${label}´`;
}

function parseRhymeSchemeToken(token) {
  const normalized = normalizeRhymeApostrophes(String(token ?? '').trim());
  if (!normalized) {
    return { isFree: false, letter: '', familyKey: '', requiresAguda: false };
  }

  if (normalized === '-') {
    return { isFree: true, letter: '-', familyKey: '-', requiresAguda: false };
  }

  const letter = normalized[0];
  if (!/[A-Za-z]/.test(letter)) {
    return { isFree: false, letter: '', familyKey: '', requiresAguda: false };
  }

  return {
    isFree: false,
    letter,
    familyKey: letter.toUpperCase(),
    requiresAguda: normalized.includes("'")
  };
}

function tokenizeRhymeScheme(value, isSextinaForm = state.poeticForm === 'sextina') {
  const raw = normalizeRhymeApostrophes(String(value ?? '').trim());
  if (!raw) {
    return [];
  }

  if (isSextinaForm) {
    const grouped = raw.match(/[A-Za-z]+/g) ?? [];
    const tokens = [];

    for (const chunk of grouped) {
      if (chunk.length === 6) {
        tokens.push(...chunk.split(''));
        continue;
      }

      tokens.push(chunk);
    }

    return tokens;
  }

  const tokens = [];
  for (let index = 0; index < raw.length; index += 1) {
    const current = raw[index];

    if (current === '-') {
      tokens.push('-');
      continue;
    }

    if (!/[A-Za-z]/.test(current)) {
      continue;
    }

    const next = raw[index + 1] ?? '';
    if (next === "'") {
      tokens.push(`${current}'`);
      index += 1;
      continue;
    }

    tokens.push(current);
  }

  return tokens;
}

function markRhymeSchemeFailure(lineStatus, runtime, reason) {
  if (!runtime || !reason) {
    return;
  }

  const existing = lineStatus.get(runtime.lineIndex) ?? { valid: true, reasons: [], expectedLetter: '', verseNumber: 0 };
  existing.valid = false;
  existing.reasons = [...existing.reasons, reason];
  lineStatus.set(runtime.lineIndex, existing);
}

function markRhymeSchemeWarning(lineStatus, runtime, warning) {
  if (!runtime || !warning) {
    return;
  }

  const existing = lineStatus.get(runtime.lineIndex) ?? { valid: true, reasons: [], warnings: [], expectedLetter: '', verseNumber: 0 };
  existing.warnings = [...(existing.warnings ?? []), warning];
  lineStatus.set(runtime.lineIndex, existing);
}

function validateRhymeSchemeArt(lineStatus, runtime, tokenMeta) {
  if (!tokenMeta.letter || matchesRhymeSchemeArt(tokenMeta.letter, runtime.metricVerseCount)) {
    return;
  }

  const requirement = getRhymeSchemeArtRequirement(tokenMeta.letter);
  const description = requirement === 'minor'
    ? 'minúscula exige arte menor (8 sílabas o menos)'
    : 'mayúscula exige arte mayor (más de 8 sílabas)';
  markRhymeSchemeFailure(
    lineStatus,
    runtime,
    `La letra ${tokenMeta.letter} es inválida: ${description}; el verso tiene ${runtime.metricVerseCount}.`
  );
}

function validateRhymeScheme(runtimes, schemeValue, mode = state.rhymeMode) {
  const verseRuntimes = runtimes.filter((runtime) => runtime.lineAnalysis.text.trim());
  const isSextinaForm = state.poeticForm === 'sextina';
  const tokens = tokenizeRhymeScheme(schemeValue, isSextinaForm);
  const repeatByStanza = Boolean(state.repeatRhymeScheme && !isSextinaForm);
  const scheme = isSextinaForm ? tokens.join(' ') : tokens.join('');
  const lineStatus = new Map();

  if (!tokens.length) {
    return {
      valid: true,
      summary: 'Esquema libre',
      failingVerses: [],
      lineStatus,
      scheme
    };
  }

  if (isSextinaForm) {
    const checkedCount = Math.min(verseRuntimes.length, tokens.length);
    const checkedRuntimes = verseRuntimes.slice(0, checkedCount);
    const baseWords = checkedRuntimes.slice(0, 6).map((runtime) => normalizeValidationWord(runtime.lineAnalysis.lastWord));

    for (let index = 0; index < checkedRuntimes.length; index += 1) {
      const runtime = checkedRuntimes[index];
      const expectedToken = tokens[index] ?? '';
      const current = lineStatus.get(runtime.lineIndex) ?? { valid: true, reasons: [] };
      current.expectedLetter = expectedToken;
      current.verseNumber = index + 1;
      lineStatus.set(runtime.lineIndex, current);

      const lineWords = runtime.lineAnalysis.analyses.map((word) => normalizeValidationWord(word.original)).filter(Boolean);
      const expectedWords = expectedToken
        .split('')
        .map((letter) => baseWords[letter.charCodeAt(0) - 65])
        .filter(Boolean);

      if (!expectedWords.length) {
        markRhymeSchemeFailure(lineStatus, runtime, `Token de sextina inválido: ${expectedToken}.`);
        continue;
      }

      if (expectedToken.length === 1) {
        const finalWord = normalizeValidationWord(runtime.lineAnalysis.lastWord);
        if (finalWord !== expectedWords[0]) {
          markRhymeSchemeFailure(lineStatus, runtime, `Debe cerrar con ${expectedWords[0]}.`);
        }
        continue;
      }

      const missingWords = expectedWords.filter((word) => !lineWords.includes(word));
      if (missingWords.length) {
        markRhymeSchemeFailure(lineStatus, runtime, `Faltan end-words de sextina: ${missingWords.join(', ')}.`);
      }
    }

    const failingVerses = checkedRuntimes
      .map((runtime, index) => ({ runtime, verseNumber: index + 1 }))
      .filter(({ runtime }) => lineStatus.get(runtime.lineIndex)?.valid === false)
      .map(({ verseNumber }) => verseNumber);

    const checkedLabel = checkedCount < verseRuntimes.length || checkedCount < tokens.length
      ? ` (v. 1-${checkedCount})`
      : '';

    return {
      valid: failingVerses.length === 0,
      summary: failingVerses.length ? `${scheme}${checkedLabel}: falla v. ${failingVerses.join(', ')}` : `${scheme}${checkedLabel}`,
      failingVerses,
      lineStatus,
      scheme
    };
  }

  if (repeatByStanza) {
    const stanzaGroups = [];
    let currentGroup = [];

    for (const runtime of runtimes) {
      if (runtime.lineAnalysis.text.trim()) {
        currentGroup.push(runtime);
        continue;
      }

      if (currentGroup.length) {
        stanzaGroups.push(currentGroup);
        currentGroup = [];
      }
    }

    if (currentGroup.length) {
      stanzaGroups.push(currentGroup);
    }

    let verseNumber = 0;
    for (const stanza of stanzaGroups) {
      const letterToKey = new Map();
      const keyToLetter = new Map();

      for (let index = 0; index < stanza.length; index += 1) {
        const runtime = stanza[index];
        const expectedToken = tokens[index % tokens.length] ?? '';
        const tokenMeta = parseRhymeSchemeToken(expectedToken);
        const actualKey = normalizeValidationWord(runtime.rhyme?.activeKey ?? '');
        const current = lineStatus.get(runtime.lineIndex) ?? { valid: true, reasons: [] };
        verseNumber += 1;
        current.expectedLetter = expectedToken;
        current.verseNumber = verseNumber;
        lineStatus.set(runtime.lineIndex, current);

        if (tokenMeta.isFree) {
          continue;
        }

        if (tokenMeta.requiresAguda && runtime.lineAnalysis?.accentType !== 'aguda') {
          markRhymeSchemeFailure(lineStatus, runtime, `La letra ${tokenMeta.letter}' exige final aguda.`);
        }

        validateRhymeSchemeArt(lineStatus, runtime, tokenMeta);

        const expectedLetter = tokenMeta.familyKey;
        if (!expectedLetter) {
          markRhymeSchemeFailure(lineStatus, runtime, `Token de rima inválido: ${expectedToken}.`);
          continue;
        }

        if (!actualKey) {
          markRhymeSchemeFailure(lineStatus, runtime, 'No hay rima definida para este verso.');
          continue;
        }

        if (!letterToKey.has(expectedLetter)) {
          const mappedLetter = keyToLetter.get(actualKey);
          if (mappedLetter && mappedLetter !== expectedLetter) {
            markRhymeSchemeFailure(lineStatus, runtime, `La rima ya se usa en la letra ${mappedLetter}.`);
            continue;
          }

          letterToKey.set(expectedLetter, actualKey);
          keyToLetter.set(actualKey, expectedLetter);
          continue;
        }

        if (letterToKey.get(expectedLetter) !== actualKey) {
          markRhymeSchemeFailure(lineStatus, runtime, `Debe rimar como ${expectedLetter}.`);
        }
      }
    }

    const failingVerses = [...lineStatus.entries()]
      .filter(([, status]) => status.valid === false)
      .map(([, status]) => status.verseNumber)
      .filter((value) => Number.isInteger(value) && value > 0)
      .sort((left, right) => left - right);

    return {
      valid: failingVerses.length === 0,
      summary: failingVerses.length ? `${scheme}: falla v. ${failingVerses.join(', ')}` : scheme,
      failingVerses,
      lineStatus,
      scheme
    };
  }

  const checkedCount = Math.min(verseRuntimes.length, tokens.length);
  const checkedRuntimes = verseRuntimes.slice(0, checkedCount);

  const letterToKey = new Map();
  const keyToLetter = new Map();

  for (let index = 0; index < checkedRuntimes.length; index += 1) {
    const runtime = checkedRuntimes[index];
    const expectedToken = tokens[index];
    const tokenMeta = parseRhymeSchemeToken(expectedToken);
    const actualKey = normalizeValidationWord(runtime.rhyme?.activeKey ?? '');
    const current = lineStatus.get(runtime.lineIndex) ?? { valid: true, reasons: [] };
    current.expectedLetter = expectedToken;
    current.verseNumber = index + 1;
    lineStatus.set(runtime.lineIndex, current);

    if (tokenMeta.isFree) {
      continue;
    }

    if (tokenMeta.requiresAguda && runtime.lineAnalysis?.accentType !== 'aguda') {
      markRhymeSchemeFailure(lineStatus, runtime, `La letra ${tokenMeta.letter}' exige final aguda.`);
    }

    validateRhymeSchemeArt(lineStatus, runtime, tokenMeta);

    const expectedLetter = tokenMeta.familyKey;
    if (!expectedLetter) {
      markRhymeSchemeFailure(lineStatus, runtime, `Token de rima inválido: ${expectedToken}.`);
      continue;
    }

    if (!actualKey) {
      markRhymeSchemeFailure(lineStatus, runtime, 'No hay rima definida para este verso.');
      continue;
    }

    if (!letterToKey.has(expectedLetter)) {
      const mappedLetter = keyToLetter.get(actualKey);
      if (mappedLetter && mappedLetter !== expectedLetter) {
        markRhymeSchemeFailure(lineStatus, runtime, `La rima ya se usa en la letra ${mappedLetter}.`);
        continue;
      }

      letterToKey.set(expectedLetter, actualKey);
      keyToLetter.set(actualKey, expectedLetter);
      continue;
    }

    if (letterToKey.get(expectedLetter) !== actualKey) {
      markRhymeSchemeFailure(lineStatus, runtime, `Debe rimar como ${expectedLetter}.`);
    }
  }

  const failingVerses = checkedRuntimes
    .map((runtime, index) => ({ runtime, verseNumber: index + 1 }))
    .filter(({ runtime }) => lineStatus.get(runtime.lineIndex)?.valid === false)
    .map(({ verseNumber }) => verseNumber);

  const checkedLabel = checkedCount < verseRuntimes.length || checkedCount < tokens.length
    ? ` (v. 1-${checkedCount})`
    : '';

  return {
    valid: failingVerses.length === 0,
    summary: failingVerses.length ? `${scheme}${checkedLabel}: falla v. ${failingVerses.join(', ')}` : `${scheme}${checkedLabel}`,
    failingVerses,
    lineStatus,
    scheme
  };
}

function renderRhymeSchemeStatus(runtime, rhymeSchemeValidation) {
  if (!runtime?.lineAnalysis?.text.trim() || !rhymeSchemeValidation?.scheme) {
    return '';
  }

  const status = rhymeSchemeValidation.lineStatus.get(runtime.lineIndex);
  if (!status) {
    return '';
  }

  const expectedLetter = formatRhymeSchemeDisplayToken(status.expectedLetter || '');
  const letter = expectedLetter.replace(/´$/, '');
  const isAgudaToken = /´$/.test(expectedLetter);
  const actualLetter = runtime.metricVerseCount <= 8 ? letter.toLowerCase() : letter.toUpperCase();
  const displayedLetter = `${actualLetter}${isAgudaToken ? '´' : ''}`;
  const artMismatch = Boolean(letter && actualLetter !== letter);
  const classes = ['scheme-chip', status.valid ? 'is-valid' : 'is-invalid', 'info-click', status.valid ? '' : 'jump-to-verse'].filter(Boolean).join(' ');
  const suffix = status.valid ? (isAgudaToken ? '' : '✓') : '✕';
  const artTitle = artMismatch
    ? `La letra configurada ${expectedLetter} no corresponde al arte ${runtime.metricVerseCount <= 8 ? 'menor' : 'mayor'} del verso.`
    : '';
  const title = [...(status.reasons ?? []), artTitle].filter(Boolean).join(' · ') || `Cumple el esquema ${rhymeSchemeValidation.scheme}.`;
  const jumpAttrs = `${status.valid ? '' : ` data-jump-line="${runtime.lineIndex}"`} role="button" tabindex="0" data-info="${escapeHtml(title)}"`;
  return `<span class="${classes}" title="${escapeHtml(title)}"${jumpAttrs}>${escapeHtml(displayedLetter)} ${suffix}</span>`;
}

function getManualRhymeKey(lineIndex) {
  const raw = String(getLineOverride(lineIndex).rhymeText ?? '').trim();
  if (!raw) {
    return '';
  }

  return normalizeRhymeChunk(raw, { distinguishSZInRhyme: state.distinguishSZInRhyme });
}

function getManualRhymeLabel(lineIndex) {
  return String(getLineOverride(lineIndex).rhymeText ?? '').trim();
}

function getRhymeLabel(index) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let number = index;
  let out = '';

  do {
    out = alphabet[number % 26] + out;
    number = Math.floor(number / 26) - 1;
  } while (number >= 0);

  return out;
}

function assignRhymeLabels(runtimes) {
  const labelByGroup = new Map();
  let labelCounter = 0;

  for (const runtime of runtimes) {
    const text = runtime.lineAnalysis.text.trim();
    if (!text) {
      runtime.rhyme.label = '-';
      continue;
    }

    if (runtime.rhyme.manualLabel) {
      runtime.rhyme.label = runtime.rhyme.manualLabel;
      continue;
    }

    if (runtime.rhyme.activeKey === '-') {
      runtime.rhyme.label = '-';
      continue;
    }

    const groupKey = `${runtime.rhyme.mode}:${runtime.rhyme.activeKey}`;
    if (!labelByGroup.has(groupKey)) {
      labelByGroup.set(groupKey, getRhymeLabel(labelCounter));
      labelCounter += 1;
    }

    runtime.rhyme.label = labelByGroup.get(groupKey);
  }
}

function computeAsonanteConsonantMixWarnings(runtimes) {
  const warningsByLine = new Map();
  if (state.rhymeMode !== 'asonante') {
    return warningsByLine;
  }

  const verseRuntimes = runtimes.filter((runtime) => {
    return runtime.lineAnalysis.text.trim() && runtime.rhyme.mode === 'asonante' && runtime.rhyme.assonantKey !== '-';
  });

  const byAsonantKey = new Map();
  for (const runtime of verseRuntimes) {
    const key = runtime.rhyme.assonantKey;
    if (!byAsonantKey.has(key)) {
      byAsonantKey.set(key, []);
    }
    byAsonantKey.get(key).push(runtime);
  }

  for (const [assonantKey, group] of byAsonantKey.entries()) {
    if (group.length < 2) {
      continue;
    }

    const byConsonantKey = new Map();
    for (const runtime of group) {
      const consonantKey = runtime.rhyme.consonantKey;
      if (!byConsonantKey.has(consonantKey)) {
        byConsonantKey.set(consonantKey, []);
      }
      byConsonantKey.get(consonantKey).push(runtime);
    }

    // Warn only when at least two different consonant subgroups are repeated
    // inside the same assonant family. A single repeated subgroup is a normal
    // consonant coincidence and is already marked with "C".
    const repeatedConsonantSubgroups = [...byConsonantKey.values()].filter((items) => items.length >= 2);
    if (repeatedConsonantSubgroups.length < 2) {
      continue;
    }

    for (const subgroup of repeatedConsonantSubgroups) {
      for (const runtime of subgroup) {
        warningsByLine.set(
          runtime.lineIndex,
          `Consonancia dentro de rima asonante (${assonantKey}). Puede mezclar consonante y asonante en la misma serie.`
        );
      }
    }
  }

  return warningsByLine;
}

function computeAsonanteConsonantMatches(runtimes) {
  const matchesByLine = new Map();
  if (state.rhymeMode !== 'asonante') {
    return matchesByLine;
  }

  const verseRuntimes = runtimes.filter((runtime) => {
    return runtime.lineAnalysis.text.trim() && runtime.rhyme.mode === 'asonante' && runtime.rhyme.assonantKey !== '-';
  });

  const byAsonantKey = new Map();
  for (const runtime of verseRuntimes) {
    const key = runtime.rhyme.assonantKey;
    if (!byAsonantKey.has(key)) {
      byAsonantKey.set(key, []);
    }
    byAsonantKey.get(key).push(runtime);
  }

  for (const group of byAsonantKey.values()) {
    if (group.length < 2) {
      continue;
    }

    const byConsonantKey = new Map();
    for (const runtime of group) {
      const consonantKey = runtime.rhyme.consonantKey;
      if (!byConsonantKey.has(consonantKey)) {
        byConsonantKey.set(consonantKey, []);
      }
      byConsonantKey.get(consonantKey).push(runtime);
    }

    for (const subgroup of byConsonantKey.values()) {
      if (subgroup.length < 2) {
        continue;
      }

      for (const runtime of subgroup) {
        matchesByLine.set(runtime.lineIndex, true);
      }
    }
  }

  return matchesByLine;
}

function computeConsonanteAsonantMatches(runtimes) {
  const matchesByLine = new Map();
  if (state.rhymeMode !== 'consonante') {
    return matchesByLine;
  }

  const verseRuntimes = runtimes.filter((runtime) => {
    return runtime.lineAnalysis.text.trim()
      && runtime.rhyme.mode === 'consonante'
      && runtime.rhyme.assonantKey !== '-'
      && runtime.rhyme.consonantKey !== '-';
  });

  const byAsonantKey = new Map();
  for (const runtime of verseRuntimes) {
    const key = runtime.rhyme.assonantKey;
    if (!byAsonantKey.has(key)) {
      byAsonantKey.set(key, []);
    }
    byAsonantKey.get(key).push(runtime);
  }

  for (const group of byAsonantKey.values()) {
    if (group.length < 2) {
      continue;
    }

    for (const runtime of group) {
      const hasAssonantOnlyPair = group.some((other) => {
        return other.lineIndex !== runtime.lineIndex && other.rhyme.consonantKey !== runtime.rhyme.consonantKey;
      });

      if (hasAssonantOnlyPair) {
        matchesByLine.set(runtime.lineIndex, true);
      }
    }
  }

  return matchesByLine;
}

function getDisplayStressIndices(wordAnalysis) {
  const indices = new Set();
  if (!wordAnalysis || !Array.isArray(wordAnalysis.syllables)) {
    return indices;
  }

  if (wordAnalysis.accentType !== 'monosílaba' && Number.isInteger(wordAnalysis.stressIndex)) {
    indices.add(wordAnalysis.stressIndex);
  }

  const secondaryIndices = Array.isArray(wordAnalysis.secondaryStressIndices)
    ? wordAnalysis.secondaryStressIndices
    : [];

  for (const index of secondaryIndices) {
    if (Number.isInteger(index) && index >= 0 && index < wordAnalysis.syllables.length) {
      indices.add(index);
    }
  }

  return indices;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseNumberList(value) {
  const numbers = String(value ?? '')
    .split(/[^0-9]+/)
    .map((part) => Number(part.trim()))
    .filter((number) => Number.isInteger(number) && number > 0);

  return [...new Set(numbers)].sort((a, b) => a - b);
}

function parseStressPattern(value) {
  return parseNumberList(value);
}

function parseStressPatternAlternatives(value) {
  return String(value ?? '')
    .split(/[,;|]+/)
    .map((pattern) => parseStressPattern(pattern))
    .filter((pattern) => pattern.length);
}

function chooseStressPattern(value, naturalStressPositions = []) {
  const alternatives = parseStressPatternAlternatives(value);
  if (alternatives.length < 2) return alternatives[0] ?? [];

  const natural = new Set(naturalStressPositions);
  return alternatives.reduce((best, pattern) => {
    const score = pattern.filter((position) => natural.has(position)).length;
    const bestScore = best.filter((position) => natural.has(position)).length;
    if (score !== bestScore) return score > bestScore ? pattern : best;
    return pattern.length < best.length ? pattern : best;
  });
}

function normalizeStressPatterns(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized = {};
  for (const [rawCount, rawPattern] of Object.entries(value)) {
    const count = Number(rawCount);
    const pattern = String(rawPattern ?? '').trim();
    if (Number.isInteger(count) && count > 0 && count <= 20 && pattern) {
      normalized[count] = pattern;
    }
  }
  return normalized;
}

function getConfiguredSyllableCounts(pattern = syllablePattern?.value ?? '') {
  return [...new Set(parseSyllablePattern(pattern).flat())].sort((left, right) => left - right);
}

function getDefaultStressPattern(count) {
  return Number(count) === 11 ? '6-10' : '';
}

function resolveStoredStressPatterns(settings) {
  const normalized = normalizeStressPatterns(settings?.stressPatterns);
  if (Object.keys(normalized).length) return normalized;

  const legacyPattern = String(settings?.stressCustom ?? '').trim();
  const counts = getConfiguredSyllableCounts(settings?.syllablePattern ?? '');
  if (legacyPattern && counts.length === 1) {
    return { [counts[0]]: legacyPattern };
  }
  return normalized;
}

function readStressPatternsFromControls() {
  if (!stressPatternFields) return {};
  const patterns = {};
  for (const group of stressPatternFields.querySelectorAll('[data-stress-group]')) {
    const count = Number(group.dataset.stressGroup);
    const alternatives = [...group.querySelectorAll('[data-stress-count]')]
      .map((input) => String(input.value ?? '').trim())
      .filter(Boolean);
    if (Number.isInteger(count) && alternatives.length) patterns[count] = alternatives.join(', ');
  }
  return patterns;
}

function renderStressPatternFields(patterns = readStressPatternsFromControls()) {
  if (!stressPatternFields) return;
  const normalized = normalizeStressPatterns(patterns);
  const counts = getConfiguredSyllableCounts();
  if (!counts.length) {
    stressPatternFields.innerHTML = '<span class="hint">Define primero el conteo silábico.</span>';
    return;
  }

  stressPatternFields.innerHTML = counts.map((count) => {
    const value = normalized[count] ?? getDefaultStressPattern(count);
    const alternatives = String(value).split(/[,;|]+/).map((pattern) => pattern.trim()).filter(Boolean);
    if (!alternatives.length) alternatives.push('');
    const inputs = alternatives.map((pattern, index) => `
      <div class="stress-pattern-entry">
        <input type="text" data-stress-count="${count}" value="${escapeHtml(pattern)}" placeholder="${count === 11 ? '6-10' : 'Ej: 3-6'}" aria-label="Acento versal ${index + 1} para ${count} sílabas" />
        ${index ? '<button type="button" class="stress-pattern-remove" data-remove-stress title="Eliminar patrón" aria-label="Eliminar patrón">−</button>' : ''}
      </div>`).join('');
    return `<div class="stress-pattern-group" data-stress-group="${count}"><div class="stress-pattern-heading"><strong>${count} sílabas</strong><button type="button" class="stress-pattern-add" data-add-stress="${count}" title="Añadir otro acento versal" aria-label="Añadir otro acento versal para ${count} sílabas">+</button></div>${inputs}</div>`;
  }).join('');
}

function parseHemistichPositions(value) {
  return parseNumberList(value);
}

function buildValidationBoundaries(lineAnalysis, lineIndex, verseIndex = 0, patternOverride = null) {
  const effectivePattern = patternOverride ?? getEffectiveStressPattern(lineAnalysis, lineIndex, verseIndex);
  const localOverride = getLineOverride(lineIndex);
  const forceOn = parseNumberList(localOverride.sinalefaOn ?? '');
  const forceOff = parseNumberList(localOverride.sinalefaOff ?? '');

  return lineAnalysis.boundaries.map((boundary) => {
    const boundaryUiIndex = boundary.index + 1;
    const blockedByPause = state.conservativeSinalefa && boundary.strongPause;
    const blockedByStress =
      effectivePattern.includes(boundary.boundaryPosition) ||
      effectivePattern.includes(boundary.boundaryPosition + 1);

    let active = state.sinalefaEnabled && boundary.candidate && !blockedByPause && !blockedByStress;

    if (Object.prototype.hasOwnProperty.call(state.sinalefaOverrides, `${lineIndex}:${boundary.index}`)) {
      active = Boolean(state.sinalefaOverrides[`${lineIndex}:${boundary.index}`]) && boundary.candidate;
    }

    if (forceOn.includes(boundaryUiIndex) && boundary.candidate) {
      active = true;
    }

    if (forceOff.includes(boundaryUiIndex)) {
      active = false;
    }

    return {
      ...boundary,
      uiIndex: boundaryUiIndex,
      blockedByPause,
      blockedByStress,
      active
    };
  });
}

function getLineOverride(lineIndex) {
  return state.lineOverrides[lineIndex] ?? {};
}

function getEffectiveStressPattern(lineAnalysis, lineIndex, verseIndex = 0, metricCount = lineAnalysis?.poeticCount) {
  const naturalStress = getNaturalStressPositions(buildSyllableEntries(lineAnalysis, []));
  const local = chooseStressPattern(getLineOverride(lineIndex).stress ?? '', naturalStress);
  if (getLineOverride(lineIndex).stress?.trim()) return local;

  const expectedCounts = getExpectedSyllableCounts(state.syllablePattern, Math.max(0, verseIndex));
  const selectedCount = expectedCounts.includes(Number(metricCount))
    ? Number(metricCount)
    : expectedCounts[0];
  if (!selectedCount) return [];
  return chooseStressPattern(state.stressPatterns?.[selectedCount] ?? getDefaultStressPattern(selectedCount), naturalStress);
}

function getEffectiveHemistichPositions(lineAnalysis, lineIndex, verseIndex = 0, effectivePattern = null) {
  const inlineHemistich = getInlineHemistichBoundaries(lineAnalysis);
  if (inlineHemistich.length) {
    return { boundaries: inlineHemistich, invalid: [] };
  }

  if (!state.hemistichEnabled) {
    return { boundaries: [], invalid: [] };
  }

  const override = getLineOverride(lineIndex).hemistich;
  const inputPositions = override?.trim() ? parseHemistichPositions(override) : state.hemistichPositions;
  const validationBoundaries = buildValidationBoundaries(lineAnalysis, lineIndex, verseIndex, effectivePattern);

  const total = lineAnalysis.rawCount;
  const boundaries = [];
  const invalid = [];
  let previousBoundary = -1;
  let previousTarget = 0;
  let activeMergesBeforeBoundary = 0;

  for (const target of inputPositions) {
    if (target >= total) {
      invalid.push({ target, reason: 'fuera de rango' });
      continue;
    }

    const segmentTarget = target - previousTarget;
    let cursor = 0;
    let found = null;
    let reason = 'no encaja';
    let mergesBeforeCurrent = 0;

    for (let index = previousBoundary + 1; index < lineAnalysis.analyses.length - 1; index += 1) {
      cursor += lineAnalysis.analyses[index].syllableCount;
      const lastWord = lineAnalysis.analyses[index];
      const boundary = validationBoundaries[index];
      const metricCount = adjustPoeticCount(cursor - mergesBeforeCurrent, lastWord.accentType);

      if (metricCount === segmentTarget) {
        found = index;
        break;
      }

      if (metricCount > segmentTarget && lastWord.accentType === 'aguda') {
        reason = 'aguda desplaza el corte';
      }

      if (metricCount >= segmentTarget && found === null) {
        reason = metricCount > segmentTarget ? reason : 'la palabra final no ajusta';
      }

      if (boundary?.active) {
        mergesBeforeCurrent += 1;
      }
    }

    if (found === null || found >= lineAnalysis.analyses.length - 1) {
      invalid.push({ target, reason });
    } else {
      boundaries.push(found);
      previousBoundary = found;
      previousTarget = target;
    }
  }

  return {
    boundaries: [...new Set(boundaries)].sort((a, b) => a - b),
    invalid
  };
}

function getInlineHemistichBoundaries(lineAnalysis) {
  const slashIndices = [...lineAnalysis.text.matchAll(/\//g)].map((item) => item.index ?? -1).filter((i) => i >= 0);
  const boundaries = [];

  for (const slashIndex of slashIndices) {
    const matches = lineAnalysis.wordMatches;
    for (let index = 0; index < matches.length - 1; index += 1) {
      if (matches[index].end <= slashIndex && matches[index + 1].start >= slashIndex) {
        boundaries.push(index);
        break;
      }
    }
  }

  return [...new Set(boundaries)].sort((a, b) => a - b);
}

function wordHasMainStress(wordAnalysis) {
  if (wordAnalysis.syllableCount !== 1) {
    return true;
  }

  return !isUnstressedMonosyllable(wordAnalysis.original);
}

function buildSyllableEntries(lineAnalysis, activeBoundaries) {
  const entries = [];
  let position = 1;

  lineAnalysis.analyses.forEach((analysis, wordIndex) => {
    for (let syllableIndex = 0; syllableIndex < analysis.syllableCount; syllableIndex += 1) {
      entries.push({
        originalPosition: position,
        wordIndex,
        syllableIndex,
        isStress: syllableIndex === analysis.stressIndex && wordHasMainStress(analysis),
        wordHasStress: wordHasMainStress(analysis)
      });
      position += 1;
    }
  });

  for (const entry of entries) {
    const shift = activeBoundaries.reduce((total, boundary) => {
      return boundary.active && boundary.boundaryPosition < entry.originalPosition ? total + 1 : total;
    }, 0);
    entry.effectivePosition = entry.originalPosition - shift;
  }

  return entries;
}

function getNaturalStressPositions(entries) {
  return [...new Set(entries.filter((entry) => entry.isStress).map((entry) => entry.effectivePosition))].sort((a, b) => a - b);
}

function buildMetricSegmentData(lineAnalysis, activeBoundaries, hemistichBoundaries) {
  const segments = [];
  const segmentBoundaries = [-1, ...hemistichBoundaries, lineAnalysis.analyses.length - 1];
  let cumulativeMetricOffset = 0;
  let cumulativeMetricTotal = 0;

  for (let idx = 0; idx < segmentBoundaries.length - 1; idx += 1) {
    const startBoundary = segmentBoundaries[idx];
    const endBoundary = segmentBoundaries[idx + 1];
    const words = lineAnalysis.analyses.slice(startBoundary + 1, endBoundary + 1);

    if (!words.length) {
      continue;
    }

    const segmentMerges = activeBoundaries.filter((item) => item.active && item.index > startBoundary && item.index < endBoundary).length;
    const raw = words.reduce((total, word) => total + word.syllableCount, 0) - segmentMerges;
    const accentType = words.at(-1)?.accentType ?? 'llana';
    const metric = adjustPoeticCount(raw, accentType);
    const bonus = metric - raw;

    segments.push({
      idx,
      startWord: startBoundary + 1,
      endWord: endBoundary,
      raw,
      metric,
      bonus,
      offsetBefore: cumulativeMetricOffset,
      metricOffsetBefore: cumulativeMetricTotal,
      accentType
    });

    cumulativeMetricOffset += bonus;
    cumulativeMetricTotal += metric;
  }

  return segments;
}

function buildMetricStressData(entries, segments) {
  const metricEntries = [];
  const metricStress = [];

  for (const entry of entries) {
    const segment = segments.find((item) => entry.wordIndex >= item.startWord && entry.wordIndex <= item.endWord);
    if (!segment) {
      continue;
    }

    const metricPosition = entry.effectivePosition + segment.offsetBefore;
    metricEntries.push({
      ...entry,
      metricPosition,
      segmentIndex: segment.idx
    });

    if (entry.isStress) {
      metricStress.push(metricPosition);
    }
  }

  return {
    metricEntries,
    metricStress: [...new Set(metricStress)].sort((a, b) => a - b)
  };
}

function getSegmentFinalStressPositions(metricEntries, segments) {
  const positions = [];

  for (const segment of segments) {
    const segmentStress = metricEntries
      .filter((entry) => entry.segmentIndex === segment.idx && entry.isStress)
      .map((entry) => entry.metricPosition);

    if (segmentStress.length) {
      positions.push(Math.max(...segmentStress));
    }
  }

  return [...new Set(positions)].sort((a, b) => a - b);
}

function resolveVersalStatus(entries, targetPosition, conflictPositions = new Set()) {
  if (conflictPositions.has(targetPosition)) {
    return 'yellow';
  }

  const onTarget = entries.filter((entry) => entry.metricPosition === targetPosition);

  if (!onTarget.length) {
    return 'yellow';
  }

  if (onTarget.some((entry) => entry.isStress)) {
    return 'green';
  }

  if (onTarget.some((entry) => entry.wordHasStress)) {
    return 'red';
  }

  return 'yellow';
}

function normalizeVowelForChain(ch) {
  const lower = String(ch ?? '').toLowerCase();
  if (lower === 'y') {
    return 'y';
  }
  return lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isWeakVowelForChain(ch) {
  const normalized = normalizeVowelForChain(ch);
  return normalized === 'i' || normalized === 'u' || normalized === 'y';
}

function isStrongVowelForChain(ch) {
  const normalized = normalizeVowelForChain(ch);
  return normalized === 'a' || normalized === 'e' || normalized === 'o';
}

function isAccentedWeakForChain(ch) {
  const lower = String(ch ?? '').toLowerCase();
  return lower === 'í' || lower === 'ú';
}

function extractVowelsForChain(text) {
  return extractVowelsForSinalefa(text, { rioplatenseY: state.rioplatenseY });
}

function getSinalefaVowelWarning(lineAnalysis, boundary) {
  if (!boundary?.active) {
    return null;
  }

  const leftWord = lineAnalysis?.analyses?.[boundary.index];
  const rightWord = lineAnalysis?.analyses?.[boundary.index + 1];
  const leftSyllable = leftWord?.syllables?.at(-1) ?? '';
  const rightSyllable = rightWord?.syllables?.[0] ?? '';
  const vowelCount = extractVowelsForChain(leftSyllable).length + extractVowelsForChain(rightSyllable).length;

  if (vowelCount < 3) {
    return null;
  }

  return {
    vowelCount,
    location: `${leftWord.original} + ${rightWord.original}`
  };
}

function canMergeBoundariesAsTriphthong(lineAnalysis, leftBoundaryIndex) {
  const leftWord = lineAnalysis?.analyses?.[leftBoundaryIndex];
  const middleWord = lineAnalysis?.analyses?.[leftBoundaryIndex + 1];
  const rightWord = lineAnalysis?.analyses?.[leftBoundaryIndex + 2];
  const vowels = [
    ...extractVowelsForChain(leftWord?.syllables?.at(-1)),
    ...extractVowelsForChain(middleWord?.original),
    ...extractVowelsForChain(rightWord?.syllables?.[0])
  ];

  return vowels.length === 3 &&
    isStrongVowelForChain(vowels[0]) &&
    isWeakVowelForChain(vowels[1]) &&
    isStrongVowelForChain(vowels[2]) &&
    !isAccentedWeakForChain(vowels[1]);
}

function applySinalefaChains(lineAnalysis, activeBoundaries) {
  const sinalefaChains = [];
  let chainStart = null;

  for (let index = 0; index < activeBoundaries.length; index += 1) {
    const boundary = activeBoundaries[index];
    if (boundary.candidate && boundary.active) {
      if (chainStart === null) {
        chainStart = index;
      } else if (!canMergeBoundariesAsTriphthong(lineAnalysis, index - 1)) {
        sinalefaChains.push({ start: chainStart, end: index - 1 });
        chainStart = index;
      }
      continue;
    }

    if (chainStart !== null) {
      sinalefaChains.push({ start: chainStart, end: index - 1 });
      chainStart = null;
    }
  }

  if (chainStart !== null) {
    sinalefaChains.push({ start: chainStart, end: activeBoundaries.length - 1 });
  }

  for (const boundary of activeBoundaries) {
    boundary.chainStart = boundary.index;
    boundary.chainEnd = boundary.index;
    boundary.chainLength = 0;
    boundary.isChainHead = false;
    boundary.isChainTail = false;
  }

  for (const chain of sinalefaChains) {
    for (let index = chain.start; index <= chain.end; index += 1) {
      activeBoundaries[index].chainStart = chain.start;
      activeBoundaries[index].chainEnd = chain.end;
      activeBoundaries[index].chainLength = chain.end - chain.start + 1;
      activeBoundaries[index].isChainHead = index === chain.start;
      activeBoundaries[index].isChainTail = index === chain.end;
    }
  }

  return sinalefaChains;
}

function buildLineRuntime(lineAnalysis, lineIndex, verseIndex = 0, forcedStressPattern = null) {
  const effectivePattern = forcedStressPattern ?? getEffectiveStressPattern(lineAnalysis, lineIndex, verseIndex);
  const inlineHemistich = getInlineHemistichBoundaries(lineAnalysis);
  const configHemistich = getEffectiveHemistichPositions(lineAnalysis, lineIndex, verseIndex, effectivePattern);
  const hemistichBoundaries = inlineHemistich.length ? inlineHemistich : configHemistich.boundaries;
  const hasHemistich = hemistichBoundaries.length > 0;

  const localOverride = getLineOverride(lineIndex);
  const forceOn = parseNumberList(localOverride.sinalefaOn ?? '');
  const forceOff = parseNumberList(localOverride.sinalefaOff ?? '');

  const activeBoundaries = lineAnalysis.boundaries.map((boundary) => {
    const key = `${lineIndex}:${boundary.index}`;
    const boundaryUiIndex = boundary.index + 1;
    const blockedByPause = state.conservativeSinalefa && boundary.strongPause;
    const blockedByStress =
      effectivePattern.includes(boundary.boundaryPosition) ||
      effectivePattern.includes(boundary.boundaryPosition + 1);
    const blockedByHemistich = hemistichBoundaries.includes(boundary.index);

    let active = state.sinalefaEnabled && boundary.candidate && !blockedByPause && !blockedByStress && !blockedByHemistich;

    const hasManualOverride = !blockedByHemistich && Object.prototype.hasOwnProperty.call(state.sinalefaOverrides, key);
    const manualOverrideOn = hasManualOverride && Boolean(state.sinalefaOverrides[key]) && boundary.candidate;
    const forceOnByLine = forceOn.includes(boundaryUiIndex) && !blockedByHemistich && boundary.candidate;

    if (hasManualOverride) {
      active = manualOverrideOn;
    }

    if (forceOnByLine) {
      active = true;
    }

    if (forceOff.includes(boundaryUiIndex)) {
      active = false;
    }

    return {
      ...boundary,
      uiIndex: boundaryUiIndex,
      blockedByPause,
      blockedByStress,
      blockedByHemistich,
      active,
      forcedOn: manualOverrideOn || forceOnByLine
    };
  });
  let sinalefaChains = applySinalefaChains(lineAnalysis, activeBoundaries);

  function computeMetricState() {
    const entries = buildSyllableEntries(lineAnalysis, activeBoundaries);
    const naturalStress = getNaturalStressPositions(entries);

    const merges = activeBoundaries.filter((item) => item.active).length;
    const effectiveRawCount = lineAnalysis.rawCount - merges;

    const segments = buildMetricSegmentData(lineAnalysis, activeBoundaries, hemistichBoundaries);
    const segmentCounts = segments.map((item) => item.metric);
    const { metricEntries, metricStress } = buildMetricStressData(entries, segments);
    const segmentFinalStress = getSegmentFinalStressPositions(metricEntries, segments);
    const effectivePatternWithNatural = [
      ...new Set([...effectivePattern, ...segmentFinalStress])
    ].sort((a, b) => a - b);
    const versalConflictPositions = new Set();
    const versalConflictBoundaryIndices = new Set();
    const firstMetricPosByWord = new Map();
    const lastMetricPosByWord = new Map();

    for (const entry of metricEntries) {
      if (!firstMetricPosByWord.has(entry.wordIndex)) {
        firstMetricPosByWord.set(entry.wordIndex, entry.metricPosition);
      }
      lastMetricPosByWord.set(entry.wordIndex, entry.metricPosition);
    }

    for (const boundary of activeBoundaries) {
      if (!boundary.active) {
        continue;
      }

      let hasConflict = false;
      const leftMetricPos = lastMetricPosByWord.get(boundary.index);
      const rightMetricPos = firstMetricPosByWord.get(boundary.index + 1);

      if (Number.isInteger(leftMetricPos) && effectivePatternWithNatural.includes(leftMetricPos)) {
        versalConflictPositions.add(leftMetricPos);
        hasConflict = true;
      }

      if (Number.isInteger(rightMetricPos) && effectivePatternWithNatural.includes(rightMetricPos)) {
        versalConflictPositions.add(rightMetricPos);
        hasConflict = true;
      }

      if (hasConflict) {
        versalConflictBoundaryIndices.add(boundary.index);
      }
    }

    const countLabel = segmentCounts.length > 1 ? segmentCounts.join('+') : String(adjustPoeticCount(effectiveRawCount, lineAnalysis.accentType));
    const metricVerseCount = segmentCounts.length > 1 ? null : adjustPoeticCount(effectiveRawCount, lineAnalysis.accentType);
    const hemistichWarning = !hasHemistich && Number.isFinite(metricVerseCount) && metricVerseCount > 11
      ? `Verso de ${metricVerseCount} sílabas métricas sin hemistiquio.`
      : '';

    return {
      entries,
      naturalStress,
      segments,
      metricEntries,
      metricStress,
      effectivePatternWithNatural,
      versalConflictPositions,
      versalConflictBoundaryIndices,
      countLabel,
      metricVerseCount: segmentCounts.reduce((total, count) => total + count, 0),
      hemistichWarning
    };
  }

  let metricState = computeMetricState();
  let autoBreakApplied = false;

  for (const boundary of activeBoundaries) {
    if (!boundary.active || boundary.forcedOn) {
      continue;
    }

    if (metricState.versalConflictBoundaryIndices.has(boundary.index)) {
      boundary.active = false;
      autoBreakApplied = true;
    }
  }

  if (autoBreakApplied) {
    sinalefaChains = applySinalefaChains(lineAnalysis, activeBoundaries);
    metricState = computeMetricState();
  }

  const sinalefaNotice = metricState.versalConflictPositions.size
    ? 'Hay sinalefas forzadas sobre acento versal (amarillo). Detectar automáticamente las rompe si no están forzadas.'
    : '';

  if (!forcedStressPattern && !getLineOverride(lineIndex).stress?.trim()) {
    const resolvedPattern = getEffectiveStressPattern(
      lineAnalysis,
      lineIndex,
      verseIndex,
      metricState.metricVerseCount
    );
    if (resolvedPattern.join('-') !== effectivePattern.join('-')) {
      return buildLineRuntime(lineAnalysis, lineIndex, verseIndex, resolvedPattern);
    }
  }

  const rhymeData = extractRhymeData(lineAnalysis, { distinguishSZInRhyme: state.distinguishSZInRhyme });
  const mode = getEffectiveRhymeMode(lineIndex);
  const manualKey = getManualRhymeKey(lineIndex);
  const manualLabel = getManualRhymeLabel(lineIndex);
  const activeKey = manualKey || (mode === 'consonante'
    ? rhymeData.consonantKey
    : mode === 'palabra-final'
      ? rhymeData.finalWordKey
      : rhymeData.assonantKey);

  return {
    lineIndex,
    lineAnalysis,
    configuredStressPattern: effectivePattern,
    effectivePattern: metricState.effectivePatternWithNatural,
    activeBoundaries,
    hemistichBoundaries,
    hasHemistich,
    invalidHemistich: configHemistich.invalid,
    entries: metricState.entries,
    metricEntries: metricState.metricEntries,
    metricStress: metricState.metricStress,
    segments: metricState.segments,
    naturalStress: metricState.naturalStress,
    countLabel: metricState.countLabel,
    metricVerseCount: metricState.metricVerseCount,
    hemistichWarning: metricState.hemistichWarning,
    rhyme: {
      mode,
      consonantKey: rhymeData.consonantKey,
      assonantKey: rhymeData.assonantKey,
      finalWordKey: rhymeData.finalWordKey,
      manualLabel,
      manualKey,
      activeKey,
      label: '-'
    },
    sinalefaChains,
    versalConflictPositions: metricState.versalConflictPositions,
    versalConflictBoundaryIndices: metricState.versalConflictBoundaryIndices,
    sinalefaNotice
  };
}

function renderSinalefaChainLabel(runtime, startIndex, endIndex) {
  const leftWord = runtime?.lineAnalysis?.analyses?.[startIndex];
  const firstBoundary = runtime?.activeBoundaries?.[startIndex];
  const chainParts = [];

  if (!leftWord?.syllables?.length || !firstBoundary) {
    return '';
  }

  chainParts.push(leftWord.syllables.at(-1));

  for (let index = startIndex; index <= endIndex; index += 1) {
    const rightWord = runtime?.lineAnalysis?.analyses?.[index + 1];
    const rightSyllable = rightWord?.syllables?.[0] ?? '';
    if (rightSyllable) {
      chainParts.push(rightSyllable);
    }
  }

  const joined = chainParts.map((item) => escapeHtml(item)).join('');
  return `(${joined})`;
}

function renderRhyme(runtime) {
  const modeLabel = runtime.rhyme.mode === 'consonante'
    ? 'consonante'
    : runtime.rhyme.mode === 'palabra-final'
      ? 'repetición de palabra final'
      : 'asonante';
  const source = runtime.rhyme.manualLabel ? 'manual' : modeLabel;
  const label = String(runtime.rhyme.label ?? '').trim();
  const mixWarning = String(runtime.rhyme.mixWarning ?? '').trim();
  const consonantMatchHint = String(runtime.rhyme.consonantMatchHint ?? '').trim();
  const assonantMatchHint = String(runtime.rhyme.assonantMatchHint ?? '').trim();
  const poemTitleScope = state.currentAnalysisTitle || normalizePoemTitle(poemTitle?.value ?? 'Sin título');
  const rhymeColor = getRhymeColor(poemTitleScope, label || runtime.rhyme.activeKey || '');
  const labelColor = label && label !== '-' ? rhymeColor : '#4b7f8f';
  const contrastColor = getReadableTextColor(labelColor);
  const chipStyle = `background:${toRgba(labelColor, 0.12)};border-color:${toRgba(labelColor, 0.28)};color:${labelColor};`;
  const agudaNote = runtime.lineAnalysis?.accentType === 'aguda'
    ? ' Final aguda.'
    : '';
  const info = `Rima ${escapeHtml(source)} activa. Clave usada: ${escapeHtml(runtime.rhyme.activeKey)}. Consonante: ${escapeHtml(runtime.rhyme.consonantKey)}. Asonante: ${escapeHtml(runtime.rhyme.assonantKey)}. Final completa: ${escapeHtml(runtime.rhyme.finalWordKey)}.${agudaNote}`;
  const warningHint = mixWarning ? `<span class="hover-hint info-click jump-to-verse" role="button" tabindex="0" data-info="${escapeHtml(mixWarning)}" data-jump-line="${runtime.lineIndex}" title="${escapeHtml(mixWarning)}">!</span>` : '';
  const consonantHint = consonantMatchHint ? `<span class="hover-hint info-click" role="button" tabindex="0" data-info="${escapeHtml(consonantMatchHint)}" title="${escapeHtml(consonantMatchHint)}">C</span>` : '';
  const assonantHint = assonantMatchHint ? `<span class="hover-hint info-click" role="button" tabindex="0" data-info="${escapeHtml(assonantMatchHint)}" title="${escapeHtml(assonantMatchHint)}">A</span>` : '';
  const swatchStyle = `background:${labelColor};color:${contrastColor};`;
  const colorAction = label && label !== '-'
    ? `<button type="button" class="rhyme-color-btn" data-action="edit-rhyme-color" data-rhyme-label="${escapeHtml(label)}" data-rhyme-poem="${escapeHtml(poemTitleScope)}" data-color="${escapeHtml(labelColor)}" title="Cambiar color de la rima ${escapeHtml(label)}" aria-label="Cambiar color de la rima ${escapeHtml(label)}" style="${swatchStyle}" onclick="window.openRhymeColorSelector(this)"></button>`
    : '';
  return `<span class="rhyme-chip info-click ${runtime.lineAnalysis?.accentType === 'aguda' ? 'is-warning' : ''}" role="button" tabindex="0" data-info="${escapeHtml(info)}" title="${escapeHtml(info)}" style="${chipStyle}">${escapeHtml(formatRhymeChipLabel(runtime))}</span>${colorAction}${consonantHint}${assonantHint}${warningHint}`;
}

function formatWordInline(wordAnalysis) {
  if (!wordAnalysis.syllables.length) {
    return escapeHtml(wordAnalysis.original);
  }

  if (wordAnalysis.accentType === 'monosílaba') {
    return wordAnalysis.syllables.map((syllable) => escapeHtml(syllable)).join('-');
  }

  const displayStressIndices = getDisplayStressIndices(wordAnalysis);

  return wordAnalysis.syllables
    .map((syllable, index) => {
      const clean = escapeHtml(syllable);
      return displayStressIndices.has(index) ? `<strong>${clean}</strong>` : clean;
    })
    .join('-');
}

function renderWordInlineWithBoundaryAwareness(wordAnalysis, wordIndex, runtime) {
  if (!wordAnalysis.syllables.length) {
    return escapeHtml(wordAnalysis.original);
  }

  const previousBoundary = runtime.activeBoundaries[wordIndex - 1];
  const nextBoundary = runtime.activeBoundaries[wordIndex];
  const hideFirst = Boolean(previousBoundary?.candidate && !previousBoundary?.blockedByHemistich);
  const hideLast = Boolean(nextBoundary?.candidate && !nextBoundary?.blockedByHemistich);
  const displayStressIndices = getDisplayStressIndices(wordAnalysis);

  const syllables = wordAnalysis.syllables
    .map((syllable, index) => {
      const isFirst = index === 0;
      const isLast = index === wordAnalysis.syllables.length - 1;
      if ((isFirst && hideFirst) || (isLast && hideLast)) {
        return '';
      }

      const clean = escapeHtml(syllable);
      return displayStressIndices.has(index) ? `<strong>${clean}</strong>` : clean;
    })
    .filter(Boolean)
    .join('-');

  return syllables;
}

function renderSinalefaMarker(boundary, lineIndex) {
  if (!boundary.candidate) {
    return '';
  }

  const runtime = lastRuntime[lineIndex];
  const previousBoundary = runtime?.activeBoundaries?.[boundary.index - 1];
  const nextBoundary = runtime?.activeBoundaries?.[boundary.index + 1];
  const leftWord = runtime?.lineAnalysis?.analyses?.[boundary.index];
  const rightWord = runtime?.lineAnalysis?.analyses?.[boundary.index + 1];
  const leftSyllable = leftWord?.syllables?.at(-1) ?? '';
  const rightSyllable = rightWord?.syllables?.[0] ?? '';
  const leftStress = leftWord && wordHasMainStress(leftWord) && leftWord.stressIndex === leftWord.syllables.length - 1;
  const rightStress = rightWord && wordHasMainStress(rightWord) && rightWord.stressIndex === 0;
  const mergedTonic = boundary.active && (leftStress || rightStress);
  const vowelWarning = getSinalefaVowelWarning(runtime?.lineAnalysis, boundary);
  const chainWords = boundary.active && boundary.chainLength > 1
    ? runtime.lineAnalysis.analyses.slice(boundary.chainStart, boundary.chainEnd + 2)
    : [];
  const chainVowelCount = chainWords.reduce((total, word, index) => {
    const syllable = index === 0
      ? word.syllables.at(-1)
      : index === chainWords.length - 1
        ? word.syllables[0]
        : word.original;
    return total + extractVowelsForChain(syllable).length;
  }, 0);
  const chainWarning = chainVowelCount >= 3
    ? { vowelCount: chainVowelCount, location: chainWords.map((word) => word.original).join(' + ') }
    : null;
  const inactiveLabel = `(${(leftStress ? `<strong>${escapeHtml(leftSyllable)}</strong>` : escapeHtml(leftSyllable))} ${(rightStress ? `<strong>${escapeHtml(rightSyllable)}</strong>` : escapeHtml(rightSyllable))})`;
  const label = boundary.active && boundary.chainLength > 1
    ? renderSinalefaChainLabel(runtime, boundary.chainStart, boundary.chainEnd)
    : boundary.active
      ? `(${(mergedTonic || leftStress) ? `<strong>${escapeHtml(leftSyllable)}</strong>` : escapeHtml(leftSyllable)}${(mergedTonic || rightStress) ? `<strong>${escapeHtml(rightSyllable)}</strong>` : escapeHtml(rightSyllable)})`
      : inactiveLabel;

  const classes = [
    'sinalefa-toggle',
    boundary.active ? 'is-active' : 'is-inactive',
    boundary.active && (chainWarning || vowelWarning || runtime?.versalConflictBoundaryIndices?.has(boundary.index)) ? 'is-warning' : '',
    boundary.blockedByHemistich ? 'is-locked' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const title = boundary.blockedByHemistich
    ? 'Bloqueada por hemistiquio'
    : chainWarning
      ? `Triptongo en sinalefa ${boundary.uiIndex}: ${chainWarning.location} (${chainWarning.vowelCount} vocales). Clic para separar.`
    : vowelWarning
      ? `Triptongo en sinalefa ${boundary.uiIndex}: ${vowelWarning.location} (${vowelWarning.vowelCount} vocales). Clic para separar.`
    : boundary.active && boundary.chainLength > 1
      ? `Triptongo: ${boundary.chainLength} sinalefas enlazadas. Clic para separar.`
      : boundary.active && runtime?.versalConflictBoundaryIndices?.has(boundary.index)
        ? 'Sinalefa forzada sobre acento versal: se marca en amarillo.'
      : boundary.blockedByStress
        ? 'El acento versal rompe la sinalefa automática en este punto.'
        : `Sinalefa ${boundary.uiIndex}: clic para alternar`;

  const disabled = boundary.blockedByHemistich ? 'disabled' : '';
  const clickBoundary = boundary.active && boundary.chainLength > 1 ? boundary.chainEnd : boundary.index;
  return `<button type="button" class="${classes}" data-line="${lineIndex}" data-boundary="${clickBoundary}" title="${escapeHtml(title)}" ${disabled}>${label}</button>`;
}

function renderAnnotatedLine(runtime) {
  const chunks = [];
  const { lineAnalysis, activeBoundaries, lineIndex, hemistichBoundaries } = runtime;

  for (let index = 0; index < lineAnalysis.analyses.length; index += 1) {
    chunks.push(renderWordInlineWithBoundaryAwareness(lineAnalysis.analyses[index], index, runtime));

    if (index >= lineAnalysis.analyses.length - 1) {
      continue;
    }

    const boundary = activeBoundaries[index];
    const previousBoundary = activeBoundaries[index - 1];
    const belongsToSameChain =
      boundary?.active &&
      previousBoundary?.active &&
      previousBoundary?.candidate &&
      boundary.chainLength > 1 &&
      previousBoundary.chainLength > 1 &&
      boundary.chainStart === previousBoundary.chainStart;

    if (belongsToSameChain) {
      continue;
    }

    const separator = lineAnalysis.separators[index] ?? ' ';
    const noSlash = hemistichBoundaries.includes(index) ? separator.replace(/\//g, '') : separator;

    chunks.push(escapeHtml(noSlash));

    if (hemistichBoundaries.includes(index)) {
      chunks.push('<span class="hemistich-marker"> / </span>');
    }

    chunks.push(renderSinalefaMarker(boundary, lineIndex));
  }

  return chunks.join('');
}

function renderPositionTrack(runtime) {
  const renderPositionToken = (position, offsetBefore = 0) => {
    const localPosition = position - offsetBefore;
    if (!targetSet.has(position)) {
      return `${localPosition}`;
    }

    const status = resolveVersalStatus(runtime.metricEntries, position);
    return `<span class="vpos ${status}">${localPosition}</span>`;
  };

  const targetSet = new Set(runtime.effectivePattern);

  const merged = [...new Set([...runtime.metricStress, ...runtime.effectivePattern])].sort((a, b) => a - b);

  if (!merged.length) {
    return '-';
  }

  if (runtime.hasHemistich && runtime.segments.length > 1) {
    const segmentTracks = runtime.segments
      .map((segment) => {
        const start = segment.metricOffsetBefore + 1;
        const end = segment.metricOffsetBefore + segment.metric;
        const segmentPositions = merged.filter((position) => position >= start && position <= end);

        if (!segmentPositions.length) {
          return '';
        }

        return segmentPositions
          .map((position) => renderPositionToken(position, segment.metricOffsetBefore))
          .join('-');
      })
      .filter(Boolean);

    return segmentTracks.length ? segmentTracks.join('-/') : '-';
  }

  return merged
    .map((position) => renderPositionToken(position))
    .join('-');
}

function renderInvalidHemistich(runtime) {
  if (!runtime.invalidHemistich.length) {
    return '';
  }

  return runtime.invalidHemistich
    .map((item) => `<span class="invalid-hemi info-click jump-to-verse" role="button" tabindex="0" data-info="Hemistiquio ${item.target}: ${escapeHtml(item.reason)}" data-jump-line="${runtime.lineIndex}" title="Hemistiquio ${item.target}: ${escapeHtml(item.reason)}">H${item.target}!</span>`)
    .join(' ');
}

function renderMetricCount(runtime) {
  const validation = runtime.syllableValidation;
  if (!validation) {
    return escapeHtml(runtime.countLabel);
  }

  const expectedLabel = validation.expected.join(' o ');
  const title = validation.valid
    ? `Cumple el conteo esperado: ${expectedLabel}.`
    : `Se esperaban ${expectedLabel} sílabas métricas; se contaron ${validation.actual}.`;
  const statusClass = validation.valid ? 'is-valid' : 'is-invalid';
  return `<span class="metric-count ${statusClass}" title="${escapeHtml(title)}">${escapeHtml(runtime.countLabel)}</span>`;
}

function renderLineAdvanced(runtime) {
  const override = getLineOverride(runtime.lineIndex);
  const lineRhymeText = String(override.rhymeText ?? '').trim();
  const openAttr = state.openAdvancedByLine[runtime.lineIndex] ? 'open' : '';
  return `
    <details class="line-advanced" data-line="${runtime.lineIndex}" ${openAttr}>
      <summary aria-label="Abrir avanzado">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span class="sr-only">Avanzado</span>
      </summary>
      <div class="line-advanced-grid">
        <label>
          Acento versal
          <input type="text" data-role="line-stress" data-line="${runtime.lineIndex}" value="${escapeHtml(override.stress ?? '')}" placeholder="${escapeHtml(runtime.configuredStressPattern.join('-'))}" title="Posiciones de acento versal para esta línea (ej: 4-8-10)." />
        </label>
        <label>
          Hemistiquio
          <input type="text" data-role="line-hemi" data-line="${runtime.lineIndex}" value="${escapeHtml(override.hemistich ?? '')}" placeholder="${escapeHtml(state.hemistichPositions.join(','))}" title="Cortes de hemistiquio para esta línea (ej: 6,12)." />
        </label>
        <label>
          Rima (override)
          <input type="text" data-role="line-rhyme-text" data-line="${runtime.lineIndex}" value="${escapeHtml(lineRhymeText)}" placeholder="Auto (${escapeHtml(state.rhymeMode)})" title="Escribe una clave de rima para esta línea (ej: A, aa, ada). Vacío = automático." />
        </label>
      </div>
    </details>
  `;
}

function renderAnalysis(result) {
  if (!result.lines.length) {
    analysisOutput.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>Escribe un poema para ver la escansión.</strong>
        </div>
      </div>
    `;
    if (analysisTextOutput) {
      analysisTextOutput.textContent = 'Escribe un poema para ver la escansión en formato texto.';
    }
    applyPoemScreenTheme(normalizePoemTitle(poemTitle?.value ?? savedPoemName?.value ?? ''));
    applyAnalysisMode();
    return;
  }

  let runtimeVerseIndex = -1;
  const runtimes = result.lines.map((line, index) => {
    if (line.text.trim()) runtimeVerseIndex += 1;
    return buildLineRuntime(line, index, Math.max(0, runtimeVerseIndex));
  });
  state.currentAnalysisTitle = normalizePoemTitle(poemTitle?.value ?? savedPoemName?.value ?? 'Sin título');
  applyPoemScreenTheme(state.currentAnalysisTitle);
  let verseCounter = 0;
  for (const runtime of runtimes) {
    if (runtime.lineAnalysis.text.trim()) {
      verseCounter += 1;
      runtime.verseNumber = verseCounter;
      const expected = getExpectedSyllableCounts(
        state.syllablePattern,
        verseCounter - 1
      );
      runtime.syllableValidation = expected.length ? {
        actual: runtime.metricVerseCount,
        expected,
        valid: matchesSyllablePattern(
          runtime.metricVerseCount,
          state.syllablePattern,
          verseCounter - 1
        )
      } : null;
    } else {
      runtime.verseNumber = 0;
      runtime.syllableValidation = null;
    }
  }
  assignRhymeLabels(runtimes);
  const rhymeLabels = [...new Set(runtimes.map((runtime) => String(runtime.rhyme?.label ?? '').trim()).filter((label) => label && label !== '-'))];
  ensureRhymeColorStoreForPoem(state.currentAnalysisTitle, rhymeLabels);
  const asonanteMixWarnings = computeAsonanteConsonantMixWarnings(runtimes);
  const asonanteConsonantMatches = computeAsonanteConsonantMatches(runtimes);
  const consonanteAsonantMatches = computeConsonanteAsonantMatches(runtimes);
  for (const runtime of runtimes) {
    runtime.rhyme.mixWarning = asonanteMixWarnings.get(runtime.lineIndex) ?? '';
    runtime.rhyme.consonantMatchHint = asonanteConsonantMatches.has(runtime.lineIndex)
      ? 'Este verso coincide en rima consonante dentro de su serie asonante.'
      : '';
    runtime.rhyme.assonantMatchHint = consonanteAsonantMatches.has(runtime.lineIndex)
      ? 'Este verso coincide en rima asonante con otro verso, aunque no en consonante.'
      : '';
  }
  lastRuntime = runtimes;
  const rhymeSchemeValidation = validateRhymeScheme(runtimes, state.rhymeScheme, state.rhymeMode);

  if (rhymeSchemeBadge) {
    rhymeSchemeBadge.className = rhymeSchemeValidation.valid ? 'badge scheme-badge is-valid' : 'badge scheme-badge is-invalid';
    rhymeSchemeBadge.textContent = rhymeSchemeValidation.summary;
  }

  analysisOutput.innerHTML = `
    <section class="clean-analysis">
      <div class="analysis-lines">
        ${runtimes
          .map((runtime) => {
            if (!runtime.lineAnalysis.text.trim()) {
              return '<div class="stanza-gap" aria-hidden="true"></div>';
            }

            return `
              <div class="analysis-line-wrap">
                <div class="analysis-row">
                  <div class="analysis-col verse-index-col">${runtime.verseNumber}</div>
                  <div class="analysis-col visual-col">${renderAnnotatedLine(runtime)}</div>
                  <div class="analysis-col stress-col">${renderPositionTrack(runtime)} ${renderInvalidHemistich(runtime)}${runtime.sinalefaNotice ? `<span class="hover-hint info-click jump-to-verse" role="button" tabindex="0" data-info="${escapeHtml(runtime.sinalefaNotice)}" data-jump-line="${runtime.lineIndex}" title="${escapeHtml(runtime.sinalefaNotice)}">!</span>` : ''}</div>
                  <div class="analysis-col rhyme-col">${renderRhyme(runtime)}</div>
                  <div class="analysis-col scheme-col">${renderRhymeSchemeStatus(runtime, rhymeSchemeValidation)}</div>
                  <div class="analysis-col advanced-col">${renderLineAdvanced(runtime)}</div>
                  <div class="analysis-col count-col">${renderMetricCount(runtime)}${runtime.hemistichWarning ? ` <span class="hover-hint info-click jump-to-verse" role="button" tabindex="0" data-info="${escapeHtml(runtime.hemistichWarning)}" data-jump-line="${runtime.lineIndex}" title="${escapeHtml(runtime.hemistichWarning)}">!</span>` : ''}</div>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    </section>
  `;

  if (analysisTextOutput) {
    analysisTextOutput.textContent = buildAnalysisText(runtimes, result.stanzaSummary ?? '1');
  }
  applyAnalysisMode();
}

function syncStateFromControls() {
  state.poeticForm = Object.hasOwn(POETIC_FORM_PRESETS, poeticForm?.value) ? poeticForm.value : 'custom';
  state.syllablePattern = syllablePattern?.value ?? '';
  state.stressPatterns = readStressPatternsFromControls();
  state.hemistichPositions = parseHemistichPositions(hemistichSplit.value);
  state.hemistichEnabled = state.hemistichPositions.length > 0;
  state.rhymeMode = normalizeRhymeMode(rhymeMode?.value);
  state.rhymeScheme = rhymeScheme?.value ?? '';
  state.repeatRhymeScheme = Boolean(repeatRhymeScheme?.checked);
  state.distinguishSZInRhyme = Boolean(distinguishSZInRhyme?.checked);
  state.rioplatenseY = Boolean(rioplatenseY?.checked);
  state.sinalefaEnabled = true;
}

function updatePoeticFormHint() {
  if (!poeticFormHint) return;
  const preset = POETIC_FORM_PRESETS[poeticForm?.value] ?? POETIC_FORM_PRESETS.custom;
  const details = [];
  if (preset.verseCount) details.push(`${preset.verseCount} versos`);
  if (preset.syllablePattern) details.push(`metro ${preset.syllablePattern}`);
  if (preset.rhymeScheme) details.push(`rima ${preset.rhymeScheme}`);
  poeticFormHint.textContent = details.length
    ? `${preset.label}: ${details.join(' · ')}. Puedes ajustar cualquier campo.`
    : 'Forma editable: configura libremente el conteo, acento versal y rima.';
}

function applyPoeticFormPreset() {
  const preset = POETIC_FORM_PRESETS[poeticForm?.value] ?? POETIC_FORM_PRESETS.custom;
  if (syllablePattern) syllablePattern.value = preset.syllablePattern ?? '';
  renderStressPatternFields(preset.stressPatterns ?? {});
  if (hemistichSplit) hemistichSplit.value = preset.hemistichSplit ?? '';
  if (rhymeMode) rhymeMode.value = preset.rhymeMode ?? 'asonante';
  if (rhymeScheme) rhymeScheme.value = preset.rhymeScheme ?? '';
  if (repeatRhymeScheme) repeatRhymeScheme.checked = Boolean(preset.repeatRhymeScheme);
  updatePoeticFormHint();
  recomputeLookupRhymes();
  refreshLookupBar();
  updateAnalysis();
}

function markPoeticFormCustom() {
  if (poeticForm) poeticForm.value = 'custom';
  updatePoeticFormHint();
}

function syncRhymeSchemePreset() {
  if (!rhymeMode || !rhymeScheme) {
    return;
  }

  const normalizedCurrent = String(rhymeScheme.value ?? '').trim();
  if (poeticForm?.value === 'sextina') {
    if (!normalizedCurrent || normalizedCurrent === DEFAULT_SEXTINA_SCHEME) {
      rhymeScheme.value = DEFAULT_SEXTINA_SCHEME;
    }
    return;
  }

  if (normalizedCurrent === DEFAULT_SEXTINA_SCHEME) {
    rhymeScheme.value = '';
  }
}

function buildStanzaSummary(text) {
  const lines = normalizeInput(text).split('\n');
  const stanzaCounts = [];
  let versesInStanza = 0;

  for (const line of lines) {
    if (line.trim()) {
      versesInStanza += 1;
      continue;
    }

    if (versesInStanza > 0) {
      stanzaCounts.push(versesInStanza);
      versesInStanza = 0;
    }
  }

  if (versesInStanza > 0) {
    stanzaCounts.push(versesInStanza);
  }

  return stanzaCounts.length ? stanzaCounts.join('-') : '1';
}

function updateAnalysis() {
  const focusSnapshot = captureInlineInputFocus();
  setPoemTitleDisplay(poemTitle?.value ?? '');
  updatePoeticFormHint();
  syncRhymeSchemePreset();
  syncStateFromControls();
  const text = normalizeInput(poemInput.value);
  previousPoemText = poemInput.value;
  const result = analyzePoem(text, { rioplatenseY: state.rioplatenseY });
  const stanzaSummary = buildStanzaSummary(text);
  if (stanzaSummaryBadge) {
    stanzaSummaryBadge.textContent = stanzaSummary;
  }
  renderAnalysis({ ...result, stanzaSummary });
  restoreInlineInputFocus(focusSnapshot);
}

function setLineOverride(line, key, value) {
  const index = Number(line);
  if (!Number.isInteger(index) || index < 0) {
    return;
  }

  const current = state.lineOverrides[index] ?? {};
  state.lineOverrides[index] = {
    ...current,
    [key]: value
  };
}

function clearAutomaticSinalefaOverrides() {
  state.sinalefaOverrides = {};
  const cleanedLineOverrides = {};

  for (const [line, override] of Object.entries(state.lineOverrides)) {
    if (!override || typeof override !== 'object') {
      continue;
    }

    const { sinalefaOn, sinalefaOff, ...rest } = override;
    if (Object.keys(rest).length) {
      cleanedLineOverrides[line] = rest;
    }
  }

  state.lineOverrides = cleanedLineOverrides;
}

function insertIntoPoemInput(recognizedText) {
  const result = insertPoemText(
    poemInput.value,
    poemInput.selectionStart,
    poemInput.selectionEnd,
    recognizedText
  );

  if (result.text === poemInput.value) return;

  poemInput.value = result.text;
  poemInput.focus();
  poemInput.setSelectionRange(result.cursor, result.cursor);
  poemInput.dispatchEvent(new Event('input', { bubbles: true }));
}

function insertLineBreakIntoPoemInput() {
  const result = insertPoemLineBreak(
    poemInput.value,
    poemInput.selectionStart,
    poemInput.selectionEnd
  );

  if (result.text === poemInput.value) return;

  poemInput.value = result.text;
  poemInput.focus();
  poemInput.setSelectionRange(result.cursor, result.cursor);
  poemInput.dispatchEvent(new Event('input', { bubbles: true }));
}

function setSpeechRecognitionActive(active) {
  isSpeechRecognitionActive = active;
  if (active) isSpeechRecognitionStarting = false;
  speechToText?.classList.toggle('is-active', active);
  speechToText?.classList.toggle('is-busy', isSpeechRecognitionStarting);
  speechToText?.setAttribute('aria-pressed', String(active));
  speechToText?.setAttribute('aria-busy', String(isSpeechRecognitionStarting));
  speechToText?.setAttribute('title', active ? 'Detener dictado' : 'Iniciar dictado en español');
  if (captureStatus) {
    captureStatus.textContent = active
      ? 'Escuchando...'
      : isSpeechRecognitionStarting
        ? 'Preparando micrófono...'
        : '';
  }
}

function setSpeechRecognitionStarting(starting) {
  isSpeechRecognitionStarting = starting;
  setSpeechRecognitionActive(false);
}

function loadVoskScript() {
  if (window.Vosk) return Promise.resolve(window.Vosk);
  if (voskScriptPromise) return voskScriptPromise;

  voskScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = VOSK_SCRIPT_URL;
    script.onload = () => resolve(window.Vosk);
    script.onerror = () => reject(new Error('No se pudo cargar Vosk.'));
    document.head.append(script);
  }).catch((error) => {
    voskScriptPromise = null;
    throw error;
  });

  return voskScriptPromise;
}

async function loadVoskModelArchiveUrl() {
  const responses = await Promise.all(VOSK_SPANISH_MODEL_PART_URLS.map((url) => fetch(url)));
  const failedResponse = responses.find((response) => !response.ok);
  if (failedResponse) {
    throw new Error(`No se pudo descargar el modelo de voz (${failedResponse.status}).`);
  }

  const parts = await Promise.all(responses.map((response) => response.blob()));
  return URL.createObjectURL(new Blob(parts, { type: 'application/gzip' }));
}

async function getVoskModel() {
  if (!voskModelPromise) {
    voskModelPromise = Promise.all([loadVoskScript(), loadVoskModelArchiveUrl()])
      .then(async ([Vosk, modelArchiveUrl]) => {
        try {
          return await Vosk.createModel(modelArchiveUrl);
        } finally {
          URL.revokeObjectURL(modelArchiveUrl);
        }
      })
      .catch((error) => {
        voskModelPromise = null;
        throw error;
      });
  }
  return voskModelPromise;
}

async function startVoskRecognition() {
  setSpeechRecognitionStarting(true);
  if (captureStatus) captureStatus.textContent = 'Descargando dictado en español (40 MB)...';

  try {
    const [model, mediaStream] = await Promise.all([
      getVoskModel(),
      navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
          sampleRate: 16000
        }
      })
    ]);

    if (!shouldContinueSpeechRecognition) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setSpeechRecognitionStarting(false);
      return;
    }

    const audioContext = new AudioContext();
    const recognizer = new model.KaldiRecognizer(audioContext.sampleRate);
    const source = audioContext.createMediaStreamSource(mediaStream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    const silentOutput = audioContext.createGain();
    silentOutput.gain.value = 0;

    recognizer.on('result', (message) => {
      const transcript = message.result?.text?.trim();
      if (!transcript) return;
      insertIntoPoemInput(transcript);
      insertLineBreakIntoPoemInput();
    });
    processor.onaudioprocess = (event) => recognizer.acceptWaveform(event.inputBuffer);
    source.connect(processor);
    processor.connect(silentOutput);
    silentOutput.connect(audioContext.destination);
    voskSession = { audioContext, mediaStream, processor, recognizer, silentOutput, source };
    setSpeechRecognitionActive(true);
  } catch (error) {
    shouldContinueSpeechRecognition = false;
    setSpeechRecognitionStarting(false);
    showToast(
      error?.name === 'NotAllowedError'
        ? getSpeechRecognitionErrorMessage('not-allowed')
        : 'No se pudo cargar el dictado local para Firefox.',
      'error'
    );
  }
}

function stopVoskRecognition() {
  shouldContinueSpeechRecognition = false;
  if (voskSession) {
    voskSession.source.disconnect();
    voskSession.processor.disconnect();
    voskSession.silentOutput.disconnect();
    voskSession.processor.onaudioprocess = null;
    voskSession.mediaStream.getTracks().forEach((track) => track.stop());
    voskSession.recognizer.remove();
    voskSession.audioContext.close();
    voskSession = null;
  }
  setSpeechRecognitionStarting(false);
}

function getSpeechRecognition() {
  if (speechRecognition) return speechRecognition;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  speechRecognition = new SpeechRecognition();
  speechRecognition.lang = 'es-ES';
  speechRecognition.continuous = false;
  speechRecognition.interimResults = false;
  speechRecognition.maxAlternatives = 1;
  speechRecognition.onstart = () => {
    speechRecognitionReceivedText = false;
    speechRecognitionHadError = false;
    setSpeechRecognitionActive(true);
  };
  speechRecognition.onend = () => {
    isSpeechRecognitionStarting = false;
    if (!shouldContinueSpeechRecognition || speechRecognitionHadError) {
      shouldContinueSpeechRecognition = false;
      setSpeechRecognitionActive(false);
      return;
    }

    if (speechRecognitionReceivedText) insertLineBreakIntoPoemInput();

    try {
      setSpeechRecognitionStarting(true);
      speechRecognition.start();
    } catch {
      shouldContinueSpeechRecognition = false;
      setSpeechRecognitionStarting(false);
      showToast('No se pudo continuar el dictado.', 'error');
    }
  };
  speechRecognition.onerror = (event) => {
    speechRecognitionHadError = event.error !== 'aborted';
    isSpeechRecognitionStarting = false;
    if (speechRecognitionHadError) shouldContinueSpeechRecognition = false;
    setSpeechRecognitionActive(false);
    if (event.error !== 'aborted') {
      const type = event.error === 'no-speech' ? 'warning' : 'error';
      const isVsCodeBrowser = /Electron\//.test(navigator.userAgent);
      const message = event.error === 'network' && isVsCodeBrowser
        ? 'El navegador integrado de VS Code no ofrece el servicio Web Speech. Ábrelo en Chrome o Edge.'
        : getSpeechRecognitionErrorMessage(event.error);
      showToast(message, type);
    }
  };
  speechRecognition.onresult = (event) => {
    let transcript = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      if (event.results[index].isFinal) transcript += event.results[index][0].transcript;
    }
    if (transcript.trim()) {
      speechRecognitionReceivedText = true;
      insertIntoPoemInput(transcript);
    }
  };

  return speechRecognition;
}

function toggleSpeechRecognition() {
  const recognition = getSpeechRecognition();
  if (!recognition) {
    if (isSpeechRecognitionActive || isSpeechRecognitionStarting) {
      stopVoskRecognition();
      return;
    }
    shouldContinueSpeechRecognition = true;
    startVoskRecognition();
    return;
  }

  if (isSpeechRecognitionActive || isSpeechRecognitionStarting) {
    shouldContinueSpeechRecognition = false;
    if (isSpeechRecognitionActive) recognition.stop();
    else recognition.abort();
    return;
  }

  try {
    shouldContinueSpeechRecognition = true;
    setSpeechRecognitionStarting(true);
    recognition.start();
  } catch {
    shouldContinueSpeechRecognition = false;
    setSpeechRecognitionStarting(false);
    showToast('No se pudo iniciar el dictado. Recarga la página e inténtalo de nuevo.', 'error');
  }
}

async function getTesseractModule() {
  if (!tesseractModulePromise) {
    tesseractModulePromise = import(TESSERACT_CDN_URL).catch((error) => {
      tesseractModulePromise = null;
      throw error;
    });
  }
  return tesseractModulePromise;
}

async function recognizePoemImage(file) {
  if (!file) return;

  imageToText.disabled = true;
  imageToText.classList.add('is-busy');
  if (captureStatus) captureStatus.textContent = 'Preparando imagen...';
  let worker = null;

  try {
    const { createWorker } = await getTesseractModule();
    worker = await createWorker('spa', undefined, {
      logger(message) {
        if (message.status !== 'recognizing text' || !captureStatus) return;
        captureStatus.textContent = `Leyendo texto... ${Math.round(message.progress * 100)} %`;
      }
    });
    const result = await worker.recognize(file);
    const text = String(result?.data?.text ?? '').trim();
    if (!text) {
      showToast('No se encontró texto legible en la imagen.', 'warning');
      return;
    }
    insertIntoPoemInput(text);
    showToast('Texto de la imagen añadido al poema.', 'success');
  } catch {
    showToast('No se pudo leer la imagen. Comprueba la conexión e inténtalo de nuevo.', 'error');
  } finally {
    await worker?.terminate();
    imageToText.disabled = false;
    imageToText.classList.remove('is-busy');
    poemImageFile.value = '';
    if (captureStatus) captureStatus.textContent = '';
  }
}

poemInput.value = SAMPLE_POEM;
poemInput.addEventListener('input', () => {
  const remappedSettings = remapPoemLineSettings(previousPoemText, poemInput.value, state);
  state.sinalefaOverrides = remappedSettings.sinalefaOverrides;
  state.lineOverrides = remappedSettings.lineOverrides;
  state.openAdvancedByLine = remappedSettings.openAdvancedByLine;
  updateAnalysis();
  scheduleAutoSave();
});
poemInput.addEventListener('keydown', async (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || String(event.key).toLowerCase() !== 'x') {
    return;
  }

  if (poemInput.selectionStart !== poemInput.selectionEnd) {
    return;
  }

  event.preventDefault();
  const result = cutPoemLine(poemInput.value, poemInput.selectionStart);
  try {
    await navigator.clipboard.writeText(result.cutText);
  } catch {
    showToast('No se pudo copiar el verso al portapapeles.', 'error');
    return;
  }

  poemInput.value = result.text;
  poemInput.setSelectionRange(result.cursor, result.cursor);
  poemInput.dispatchEvent(new Event('input', { bubbles: true }));
});
speechToText?.addEventListener('click', toggleSpeechRecognition);
imageToText?.addEventListener('click', () => poemImageFile?.click());
poemImageFile?.addEventListener('change', () => recognizePoemImage(poemImageFile.files?.[0]));

poeticForm?.addEventListener('change', applyPoeticFormPreset);
syllablePattern?.addEventListener('input', () => {
  const currentPatterns = readStressPatternsFromControls();
  markPoeticFormCustom();
  renderStressPatternFields(currentPatterns);
  updateAnalysis();
});

stressPatternFields?.addEventListener('input', () => {
  markPoeticFormCustom();
  updateAnalysis();
});

stressPatternFields?.addEventListener('click', (event) => {
  const addButton = event.target.closest('[data-add-stress]');
  const removeButton = event.target.closest('[data-remove-stress]');
  if (!addButton && !removeButton) return;

  const patterns = readStressPatternsFromControls();
  if (addButton) {
    const count = Number(addButton.dataset.addStress);
    const group = addButton.closest('[data-stress-group]');
    const entry = document.createElement('div');
    entry.className = 'stress-pattern-entry';
    entry.innerHTML = `<input type="text" data-stress-count="${count}" value="" placeholder="${count === 11 ? '6-10' : 'Ej: 3-6'}" aria-label="Otro acento versal para ${count} sílabas" /><button type="button" class="stress-pattern-remove" data-remove-stress title="Eliminar patrón" aria-label="Eliminar patrón">−</button>`;
    group?.append(entry);
    entry.querySelector('input')?.focus();
    return;
  } else {
    const group = removeButton.closest('[data-stress-group]');
    removeButton.closest('.stress-pattern-entry')?.remove();
    const count = Number(group?.dataset.stressGroup);
    const values = [...group.querySelectorAll('[data-stress-count]')].map((input) => input.value.trim()).filter(Boolean);
    patterns[count] = values.join(', ');
  }
  renderStressPatternFields(patterns);
  markPoeticFormCustom();
  updateAnalysis();
});

hemistichSplit.addEventListener('input', () => {
  markPoeticFormCustom();
  updateAnalysis();
});
rhymeMode?.addEventListener('change', () => {
  markPoeticFormCustom();
  syncRhymeSchemePreset();
  recomputeLookupRhymes();
  refreshLookupBar();
  if (state.selectedLookupWord && !state.lookupRhymeCandidates.length) {
    queueLookupAutoFetch();
  }
  updateAnalysis();
});
rhymeScheme?.addEventListener('input', () => {
  markPoeticFormCustom();
  updateAnalysis();
});
repeatRhymeScheme?.addEventListener('change', () => {
  markPoeticFormCustom();
  updateAnalysis();
});
distinguishSZInRhyme?.addEventListener('change', () => {
  recomputeLookupRhymes();
  renderLookupResults();
  updateAnalysis();
});
rioplatenseY?.addEventListener('change', updateAnalysis);
analysisModeToggle?.addEventListener('click', () => {
  state.analysisMode = state.analysisMode === 'visual' ? 'text' : 'visual';
  applyAnalysisMode();
});
copyAnalysisText?.addEventListener('click', async () => {
  const text = analysisTextOutput?.textContent ?? '';
  try {
    await navigator.clipboard.writeText(text);
    showToast('Análisis copiado.', 'success');
  } catch {
    showToast('No se pudo copiar el análisis.', 'error');
  }
});
for (const selector of poemFontSelectors) {
  selector.addEventListener('change', () => {
    applyPoemFont(selector.value);
    scheduleAutoSave();
  });
}
defaultPoemFont?.addEventListener('change', () => {
  const font = saveDefaultPoemFont(defaultPoemFont.value);
  defaultPoemFont.value = font;
  showToast('Fuente por defecto actualizada.', 'success');
});
fontSizeDown?.addEventListener('click', () => {
  adjustFontScale(-5);
});
fontSizeUp?.addEventListener('click', () => {
  adjustFontScale(5);
});
panelViewMode?.addEventListener('change', () => {
  state.panelViewMode = panelViewMode.value === 'writing' || panelViewMode.value === 'analysis'
    ? panelViewMode.value
    : 'both';
  applyPanelViewMode();
  saveUiPreferences();
});
lookupRaeBtn?.addEventListener('click', openWiktionaryDefinition);
lookupRimasBtn?.addEventListener('click', openOpenDataRhymesFromConfig);
poemInput?.addEventListener('mouseup', syncLookupWordFromPoemInput);
poemInput?.addEventListener('keyup', syncLookupWordFromPoemInput);
analysisOutput?.addEventListener('mouseup', syncLookupWordFromAnalysisSelection);
analysisOutput?.addEventListener('keyup', syncLookupWordFromAnalysisSelection);
selectedLookupWord?.addEventListener('input', () => {
  setSelectedLookupWord(selectedLookupWord.value);
});
lookupResults?.addEventListener('change', (event) => {
  const sizeTarget = event.target instanceof HTMLElement ? event.target.closest('#lookupRhymePageSize') : null;
  if (sizeTarget instanceof HTMLSelectElement) {
    const parsed = Math.min(96, Math.max(6, Number(sizeTarget.value) || LOOKUP_RHYME_PAGE_SIZE));
    state.lookupRhymePageSize = parsed;
    renderLookupResults();
    return;
  }

  const typeTarget = event.target instanceof HTMLElement ? event.target.closest('#lookupWordTypeFilter') : null;
  if (typeTarget instanceof HTMLSelectElement) {
    state.lookupWordTypeFilter = typeTarget.value || 'all';
    state.lookupRhymePage = 1;
    state.lookupWordTypeScanComplete = state.lookupWordTypeFilter === 'all';
    renderLookupResults();
    if (state.lookupWordTypeFilter === 'all') {
      state.lookupLoadingWordTypes = false;
      state.lookupWordTypeRequestId += 1;
      renderLookupResults();
      return;
    }

    startLookupWordTypeScan();
    return;
  }

  const target = event.target instanceof HTMLElement ? event.target.closest('#lookupSyllableFilter') : null;
  if (!(target instanceof HTMLSelectElement)) {
    const pageTarget = event.target instanceof HTMLElement ? event.target.closest('#lookupRhymePageInput') : null;
    if (!(pageTarget instanceof HTMLInputElement)) {
      return;
    }

    setLookupRhymePage(pageTarget.value);
    refreshLookupVisibleWordTypes();
    return;
  }

  state.lookupSyllableFilter = target.value || 'all';
  state.lookupRhymePage = 1;
  recomputeLookupRhymes();
  renderLookupResults();
  if (state.lookupWordTypeFilter !== 'all') {
    startLookupWordTypeScan();
  }

  if (state.selectedLookupWord && !state.lookupRhymeCandidates.length) {
    queueLookupAutoFetch();
  }
});
lookupResults?.addEventListener('input', (event) => {
  const pageTarget = event.target instanceof HTMLElement ? event.target.closest('#lookupRhymePageInput') : null;
  if (!(pageTarget instanceof HTMLInputElement)) {
    return;
  }

  const parsed = Number(pageTarget.value);
  if (Number.isFinite(parsed) && parsed >= 1) {
    state.lookupRhymePage = parsed;
    renderLookupResults();
  }
});
lookupResults?.addEventListener('click', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-action]') : null;
  if (!target) {
    return;
  }

  const action = target.getAttribute('data-action');

  if (action === 'add-lookup-excluded-word') {
    addLookupExcludedWord(target.getAttribute('data-word') ?? '');
    return;
  }

  if (action === 'lookup-rhyme-page-prev') {
    setLookupRhymePage(state.lookupRhymePage - 1);
    return;
  }

  if (action === 'lookup-rhyme-page-next') {
    setLookupRhymePage(state.lookupRhymePage + 1);
  }
});
lookupExcludeCurrentBtn?.addEventListener('click', () => {
  addLookupExcludedWord(selectedLookupWord?.value ?? state.selectedLookupWord ?? '');
});
lookupExcludedBar?.addEventListener('click', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-action]') : null;
  if (!target) {
    return;
  }

  const action = target.getAttribute('data-action');

  if (action === 'remove-lookup-excluded-word') {
    removeLookupExcludedWord(target.getAttribute('data-word') ?? '');
    return;
  }

  if (action === 'clear-lookup-excluded-words') {
    clearLookupExcludedWords();
  }
});
selectedLookupWord?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') {
    return;
  }

  event.preventDefault();
  openWiktionaryDefinition();
  openOpenDataRhymesFromConfig();
});

colorPickerSwatches?.addEventListener('click', (event) => {
  const swatch = event.target instanceof HTMLElement ? event.target.closest('.color-picker-swatch') : null;
  if (!swatch) {
    return;
  }
  if (swatch.dataset.action === 'default') {
    applyDefaultColorPicker();
    return;
  }
  setColorPickerSelection(swatch.dataset.color ?? '');
});

colorPickerCustom?.addEventListener('input', () => {
  setColorPickerSelection(colorPickerCustom.value ?? '');
});

colorPickerAccept?.addEventListener('click', () => {
  confirmColorPicker();
});

colorPickerModal?.addEventListener('click', (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && target.closest('[data-close-color-picker]')) {
    closeColorPicker();
  }
});
openVersionManager?.addEventListener('click', () => {
  openVersionManagerModal();
});
versionSearchInput?.addEventListener('input', () => {
  renderSavedVersionList(savedPoemName?.value ?? '', savedPoemVersion?.value ?? '');
});
savePoem?.addEventListener('click', () => {
  saveCurrentPoemVersion({ notify: true, notifyWhenUnchanged: true });
});
newPoemTop?.addEventListener('click', () => {
  createNewPoem();
});
newPoemManager?.addEventListener('click', () => {
  createNewPoem();
});
defaultPoemColorBtn?.addEventListener('click', () => {
  const current = loadDefaultPoemColor();
  openColorPicker({
    title: 'Color por defecto para nuevos poemas',
    current: isHexColor(current) ? current : getPoemColorHex(0),
    showDefaultAction: true,
    onAccept: (colorHex) => {
      saveDefaultPoemColor(colorHex);
      updateDefaultColorButton();
      showToast('Color por defecto actualizado.', 'success');
    },
    onDefault: () => {
      clearDefaultPoemColor();
      updateDefaultColorButton();
      showToast('Color por defecto restablecido.', 'success');
    }
  });
});
currentPoemColorBtn?.addEventListener('click', () => {
  const activeTitle = normalizePoemTitle(poemTitle?.value ?? savedPoemName?.value ?? state.currentAnalysisTitle ?? '');
  const current = loadPoemColors()[activeTitle];
  openColorPicker({
    title: `Color de "${activeTitle}"`,
    current: isHexColor(current) ? current : getPoemColorHex(0),
    showDefaultAction: true,
    onAccept: (colorHex) => {
      setPoemCustomColor(activeTitle, colorHex);
      applyPoemScreenTheme(activeTitle);
      renderSavedVersionList(savedPoemName?.value ?? activeTitle, savedPoemVersion?.value ?? '');
      showToast('Color del poema actualizado.', 'success');
    },
    onDefault: () => {
      removePoemCustomColor(activeTitle);
      applyPoemScreenTheme(activeTitle);
      renderSavedVersionList(savedPoemName?.value ?? activeTitle, savedPoemVersion?.value ?? '');
      showToast('Color del poema restablecido al predeterminado.', 'success');
    }
  });
});
importPoemsMd?.addEventListener('click', () => {
  importPoemsFile?.click();
});
importPoemsFile?.addEventListener('change', async () => {
  const file = importPoemsFile.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    importPoemsFromMarkdown(text);
  } finally {
    importPoemsFile.value = '';
  }
});
exportPoemsMd?.addEventListener('click', downloadMarkdownFile);
downloadPoemPdf?.addEventListener('click', downloadPoemPdfFile);
poemTitle?.addEventListener('input', () => {
  scheduleAutoSave();
});
savedPoemName?.addEventListener('change', () => {
  const targetTitle = savedPoemName.value;
  if (isCurrentDraftDirtyAgainstLoadedVersion()) {
    saveCurrentPoemVersion({ kind: 'manual' });
  }
  refreshSavedPoemNameOptions(targetTitle);
  savedPoemName.value = targetTitle;
  refreshSavedPoemVersionOptions(targetTitle);
  loadSelectedPoemVersion();
  updateVersionManagerStatus();
});
savedPoemVersion?.addEventListener('change', () => {
  const targetTitle = savedPoemName?.value ?? '';
  const targetVersion = savedPoemVersion?.value ?? '';
  if (isCurrentDraftDirtyAgainstLoadedVersion()) {
    saveCurrentPoemVersion({ kind: 'manual' });
  }
  if (targetTitle) {
    refreshSavedPoemNameOptions(targetTitle);
    savedPoemName.value = targetTitle;
    refreshSavedPoemVersionOptions(targetTitle, targetVersion);
    if (savedPoemVersion && targetVersion) {
      savedPoemVersion.value = targetVersion;
    }
  }
  loadSelectedPoemVersion();
  updateVersionManagerStatus();
});
editSelectors?.addEventListener('click', () => {
  applySelectorEditMode(true);
});
saveSelectorEdits?.addEventListener('click', () => {
  saveSelectorEditsInline();
});
cancelSelectorEdits?.addEventListener('click', () => {
  applySelectorEditMode(false);
  syncQuickVersionLabelInput();
});
editPoemVersionInput?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') {
    return;
  }

  event.preventDefault();
  saveSelectorEditsInline();
});
editPoemNameInput?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') {
    return;
  }

  event.preventDefault();
  saveSelectorEditsInline();
});
deletePoemVersion?.addEventListener('click', deleteSelectedPoemVersion);
deleteSelectedVersions?.addEventListener('click', deleteSelectedPoemVersions);
emptyPoemTrash?.addEventListener('click', () => {
  const store = loadPoemMemoryStore();
  store.trash = {};
  if (savePoemMemoryStore(store)) {
    renderPoemTrash();
    window.dispatchEvent(new CustomEvent('escandidor:trash-emptied'));
  }
});
poemTrashList?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="restore-trash"]');
  if (!button) return;
  restorePoemTrashEntry(
    String(button.dataset.title ?? ''),
    Number(button.dataset.groupIndex),
    button.dataset.trashId,
  );
});
downloadSelectedMd?.addEventListener('click', downloadSelectedVersionsAsMarkdown);
downloadSelectedPdf?.addEventListener('click', downloadSelectedVersionsAsPdf);
selectAllVersions?.addEventListener('click', () => {
  const checkboxes = savedVersionsList ? [...savedVersionsList.querySelectorAll('.saved-version-checkbox')] : [];
  const allIds = checkboxes
    .map((checkbox) => String(checkbox.value ?? ''))
    .filter(Boolean);

  if (!allIds.length) {
    return;
  }

  const allSelected = selectedVersionIds.size >= allIds.length;
  selectedVersionIds = allSelected ? new Set() : new Set(allIds);
  renderSavedVersionList(savedPoemName?.value ?? '', savedPoemVersion?.value ?? '');
  syncQuickVersionLabelInput();
});
savedVersionsList?.addEventListener('keydown', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  if (!input.classList.contains('saved-version-label-input') && !input.classList.contains('poem-title-input')) {
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    input.blur();
  }
});
savedVersionsList?.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.classList.contains('saved-version-checkbox')) {
    const id = String(target.value ?? '');
    if (!id) {
      return;
    }

    if (target.checked) {
      selectedVersionIds.add(id);
    } else {
      selectedVersionIds.delete(id);
    }

    updateSelectAllButtonLabel((savedVersionsList?.querySelectorAll('.saved-version-checkbox').length) ?? 0);
    renderSavedVersionList(savedPoemName?.value ?? '', savedPoemVersion?.value ?? '');
    return;
  }

  if (target.classList.contains('saved-version-label-input')) {
    updateVersionLabelInline(
      target.dataset.title ?? savedPoemName?.value ?? '',
      target.dataset.versionId ?? '',
      target.value,
      { notify: true }
    );
  }
});
savedVersionsList?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const poemTitleEditor = target.closest('.poem-title-input');
  if (poemTitleEditor) {
    event.stopPropagation();
    return;
  }

  const summaryActions = target.closest('.poem-tree-actions');
  if (summaryActions) {
    event.preventDefault();
    event.stopPropagation();
  }

  const actionButton = target.closest('button[data-action]');
  if (!actionButton) {
    return;
  }

  const action = String(actionButton.dataset.action ?? '');
  const poemKey = String(actionButton.dataset.title ?? savedPoemName?.value ?? '');
  const versionId = String(actionButton.dataset.versionId ?? '');
  if (!poemKey) {
    return;
  }

  const store = loadPoemMemoryStore();
  const versions = Array.isArray(store.poems?.[poemKey]) ? store.poems[poemKey] : [];
  const title = getStoredPoemTitle(poemKey, versions);
  const version = versions.find((entry) => String(entry.id ?? '') === versionId);

  if (action === 'load-poem') {
    const newest = [...versions].sort((a, b) => new Date(b.savedAt ?? 0).getTime() - new Date(a.savedAt ?? 0).getTime())[0];
    if (!newest) {
      return;
    }
    loadVersionById(poemKey, String(newest.id ?? ''));
    renderSavedVersionList(poemKey, String(newest.id ?? ''));
    closeVersionManagerModal();
    return;
  }

  if (action === 'download-poem-md') {
    const newest = [...versions].sort((a, b) => new Date(b.savedAt ?? 0).getTime() - new Date(a.savedAt ?? 0).getTime())[0];
    if (!newest) {
      return;
    }
    downloadVersionMarkdown(title, newest);
    return;
  }

  if (action === 'download-poem-pdf') {
    const newest = [...versions].sort((a, b) => new Date(b.savedAt ?? 0).getTime() - new Date(a.savedAt ?? 0).getTime())[0];
    if (!newest) {
      return;
    }
    downloadVersionPdf(title, newest);
    return;
  }

  if (action === 'delete-poem') {
    const shouldDelete = window.confirm(`¿Eliminar todo el historial del poema "${title}"?`);
    if (!shouldDelete) {
      return;
    }
    if (versions.length) {
      movePoemToTrash(store, title, versions);
    }
    delete store.poems[poemKey];
    if (!savePoemMemoryStore(store)) {
      showToast('No se pudo borrar el poema.', 'error');
      return;
    }
    refreshSavedPoemNameOptions('');
    renderSavedVersionList(savedPoemName?.value ?? '', savedPoemVersion?.value ?? '');
    dispatchPoemDeleted(
      poemKey,
      title,
      versions.map((entry) => String(entry.id ?? '')),
      true,
    );
    showToast('Poema borrado.', 'success');
    return;
  }

  if (action === 'edit-poem-color') {
    const node = actionButton.closest('.poem-tree-node');
    if (!node) {
      return;
    }

    const current = loadPoemColors()[title];
    const fallbackIndex = Number(node.dataset.colorIndex ?? 0);
    const currentHex = isHexColor(current) ? current : getPoemColorHex(fallbackIndex);
    openColorPicker({
      title: `Color de "${title}"`,
      current: currentHex,
      showDefaultAction: true,
      onAccept: (colorHex) => {
        setPoemCustomColor(title, colorHex);
        renderSavedVersionList(savedPoemName?.value ?? poemKey, savedPoemVersion?.value ?? '');
        if (normalizePoemTitle(title) === normalizePoemTitle(state.currentAnalysisTitle)) {
          applyPoemScreenTheme(title);
        }
        showToast('Color del poema actualizado.', 'success');
      },
      onDefault: () => {
        removePoemCustomColor(title);
        renderSavedVersionList(savedPoemName?.value ?? poemKey, savedPoemVersion?.value ?? '');
        if (normalizePoemTitle(title) === normalizePoemTitle(state.currentAnalysisTitle)) {
          applyPoemScreenTheme(title);
        }
        showToast('Color del poema restablecido al predeterminado.', 'success');
      }
    });
    return;
  }

  if (!version) {
    return;
  }

  if (action === 'load-version') {
    const loaded = loadVersionById(poemKey, versionId);
    if (loaded) {
      closeVersionManagerModal();
    } else {
      showToast('No se pudo abrir la versión seleccionada.', 'error');
    }
    return;
  }

  if (action === 'download-md') {
    downloadVersionMarkdown(title, version);
    return;
  }

  if (action === 'download-pdf') {
    downloadVersionPdf(title, version);
    return;
  }

  if (action === 'delete-version') {
    if (savedPoemName) {
      savedPoemName.value = poemKey;
    }
    if (savedPoemVersion) {
      savedPoemVersion.value = versionId;
    }
    deleteSelectedPoemVersion();
    return;
  }

  if (action === 'edit-rhyme-color') {
    openRhymeColorSelector(actionButton);
    return;
  }

  if (action === 'preview-version') {
    const item = actionButton.closest('.saved-version-item');
    if (!item) return;
    const existingPreview = item.querySelector('.version-preview-panel');
    if (existingPreview) {
      existingPreview.remove();
      actionButton.classList.remove('is-active');
      return;
    }
    const previewPanel = document.createElement('div');
    previewPanel.className = 'version-preview-panel';
    previewPanel.textContent = String(version?.poemText ?? '').trim() || '(versión vacía)';
    item.appendChild(previewPanel);
    actionButton.classList.add('is-active');
    return;
  }

});
savedVersionsList?.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.classList.contains('poem-title-input')) {
    renamePoemTitleInline(target.dataset.title ?? '', target.value);
    return;
  }
});
closeVersionManager?.addEventListener('click', closeVersionManagerModal);
deletePoemEntry?.addEventListener('click', deleteSelectedPoemEntry);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && managerShell?.open) {
    closeVersionManagerModal();
  }

  if (!(event.ctrlKey || event.metaKey)) {
    return;
  }

  const key = String(event.key || '').toLowerCase();
  if (key === 's') {
    event.preventDefault();
    saveCurrentPoemVersion({ notify: true, notifyWhenUnchanged: true });
    return;
  }

  if (key === 'l' && event.shiftKey) {
    event.preventDefault();
    loadSelectedPoemVersion();
  }
});
sinalefaEnabled.addEventListener('click', () => {
  clearAutomaticSinalefaOverrides();
  updateAnalysis();
});

analysisOutput.addEventListener('click', (event) => {
  const infoTarget = event.target?.closest?.('.info-click');
  if (infoTarget) {
    const info = String(infoTarget.dataset.info ?? '').trim();
    if (info) {
      showToast(info, 'info');
    }
  }

  const jumpTarget = event.target?.closest?.('.jump-to-verse');
  if (jumpTarget) {
    const line = Number(jumpTarget.dataset.jumpLine);
    if (Number.isInteger(line) && line >= 0) {
      focusPoemLine(line);
    }
    return;
  }

  const actionButton = event.target?.closest?.('button[data-action]');
  if (actionButton?.dataset.action === 'edit-rhyme-color') {
    openRhymeColorSelector(actionButton);
    return;
  }

  const target = event.target.closest('.sinalefa-toggle');
  if (!target || target.disabled) {
    return;
  }

  const line = Number(target.dataset.line);
  const boundary = Number(target.dataset.boundary);
  if (!Number.isInteger(line) || !Number.isInteger(boundary) || !lastRuntime?.[line]) {
    return;
  }

  const boundaryData = lastRuntime[line].activeBoundaries[boundary];
  if (!boundaryData || boundaryData.blockedByHemistich) {
    return;
  }

  const key = `${line}:${boundary}`;
  state.sinalefaOverrides[key] = !boundaryData.active;
  updateAnalysis();
});

analysisOutput.addEventListener('keydown', (event) => {
  const target = event.target?.closest?.('.jump-to-verse, .info-click');
  if (!target) {
    return;
  }

  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  const info = String(target.dataset.info ?? '').trim();
  if (info) {
    showToast(info, 'info');
  }
  const line = Number(target.dataset.jumpLine);
  if (Number.isInteger(line) && line >= 0) {
    focusPoemLine(line);
  }
});

analysisOutput.addEventListener('input', (event) => {
  const target = event.target?.closest?.('[data-role][data-line]') ?? event.target;
  const role = target.dataset.role;
  const line = target.dataset.line;

  if (!role || line === undefined) {
    return;
  }

  if (role === 'line-stress') {
    setLineOverride(line, 'stress', target.value);
  }

  if (role === 'line-hemi') {
    setLineOverride(line, 'hemistich', target.value);
  }

  if (role === 'line-rhyme') {
    setLineOverride(line, 'rhymeMode', target.value);
  }

  if (role === 'line-rhyme-text') {
    setLineOverride(line, 'rhymeText', target.value);
  }

  updateAnalysis();
});

analysisOutput.addEventListener('change', (event) => {
  const target = event.target?.closest?.('[data-role][data-line]') ?? event.target;
  const role = target.dataset.role;
  const line = target.dataset.line;

  if (!role || line === undefined) {
    return;
  }

  if (role === 'line-rhyme-text' || role === 'line-stress' || role === 'line-hemi') {
    if (role === 'line-stress') {
      setLineOverride(line, 'stress', target.value);
    }

    if (role === 'line-hemi') {
      setLineOverride(line, 'hemistich', target.value);
    }

    if (role === 'line-rhyme-text') {
      setLineOverride(line, 'rhymeText', target.value);
    }

    updateAnalysis();
  }
});

analysisOutput.addEventListener(
  'toggle',
  (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.classList.contains('line-advanced')) {
      return;
    }

    const line = Number(details.dataset.line);
    if (!Number.isInteger(line)) {
      return;
    }

    state.openAdvancedByLine[line] = details.open;
  },
  true
);

updateAnalysis();
initializeUiPreferences();
refreshSavedPoemNameOptions(normalizePoemTitle(poemTitle?.value ?? ''));
restoreLastWorkedPoemOnStartup();
applyAnalysisMode();
setPoemTitleDisplay(poemTitle?.value ?? '');
updateDefaultColorButton();
updateDefaultPoemFontControl();
updateVersionManagerStatus();
renderSavedVersionList(savedPoemName?.value ?? '', savedPoemVersion?.value ?? '');
refreshLookupBar();
queueLookupAutoFetch();

window.PoetryAnalyzer = {
  analyzePoem,
  analyzeWord,
  parseStressPattern,
  parseHemistichPositions
};
