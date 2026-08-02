import { analyzeWord, extractRhymeData } from './analyzer.js';
import { decode } from 'https://cdn.jsdelivr.net/npm/@msgpack/msgpack@3.1.2/+esm';
import { decompressSync } from 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/+esm';

const SOURCE_URL = 'https://raw.githubusercontent.com/rspeer/wordfreq/master/wordfreq/data/large_es.msgpack.gz';
const MAX_CANDIDATES = 600;
let corpusPromise = null;

function loadCorpus() {
  if (!corpusPromise) {
    corpusPromise = fetch(SOURCE_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then((buffer) => decode(decompressSync(new Uint8Array(buffer))))
      .then((decoded) => {
        if (!Array.isArray(decoded) || decoded[0]?.format !== 'cB' || decoded[0]?.version !== 1) {
          throw new Error('Formato de wordfreq inesperado.');
        }
        return decoded;
      })
      .catch((error) => {
        corpusPromise = null;
        throw error;
      });
  }
  return corpusPromise;
}

function comparable(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zñü]/g, '');
}

function rhymeData(word) {
  return extractRhymeData({ analyses: [analyzeWord(word)] });
}

self.onmessage = async ({ data }) => {
  const requestId = data.requestId;
  try {
    self.postMessage({ type: 'progress', requestId, message: 'Descargando palabras en segundo plano...' });
    const decoded = await loadCorpus();
    self.postMessage({ type: 'progress', requestId, message: 'Buscando rimas en segundo plano...' });

    const targetComparable = comparable(data.word);
    const candidates = [];
    let rank = 0;
    let targetRank = 0;

    for (let bucketIndex = 1; bucketIndex < decoded.length; bucketIndex += 1) {
      const bucket = decoded[bucketIndex];
      if (!Array.isArray(bucket)) continue;

      for (const rawWord of bucket) {
        const word = String(rawWord ?? '').trim().toLowerCase();
        const wordComparable = comparable(word);
        if (!wordComparable) continue;
        rank += 1;
        if (wordComparable === targetComparable) targetRank = rank;
        if (wordComparable === targetComparable || candidates.length >= MAX_CANDIDATES) continue;

        const candidateRhyme = rhymeData(word);
        if (candidateRhyme.consonantKey === data.consonantKey || candidateRhyme.assonantKey === data.assonantKey) {
          candidates.push(word);
        }
      }

      if (candidates.length >= MAX_CANDIDATES && targetRank) break;
    }

    self.postMessage({ type: 'result', requestId, candidates, rank: targetRank });
  } catch (error) {
    self.postMessage({ type: 'error', requestId, message: String(error?.message ?? error) });
  }
};