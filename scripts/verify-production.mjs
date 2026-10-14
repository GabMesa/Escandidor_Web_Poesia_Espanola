import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createEmptyWorkshop, defaultContestProfile } from '../taller/model.js';
const base = 'https://mesa-de-poesia.pages.dev';
let cookie = '';
let createdAccount = false;
const checks = {};
async function api(path, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: {
    ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json', Origin: base } : {})
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const value = await response.json();
  return { response, value };
}
try {
  const landing = await fetch(base + '/?release=workshop');
  assert.equal(landing.status, 200);
  const html = await landing.text();
  assert.match(html, /Tu poema,/); assert.match(html, /Canción del pirata/);
  assert.match(html, /Dejá los pendientes/); checks.landing = true;
  const workshop = await fetch(base + '/taller/');
  assert.equal(workshop.status, 200); assert.match(await workshop.text(), /workshop-theme.css/);
  for (const path of ['/api/workshop', '/api/plicas']) assert.equal((await api(path)).response.status, 401);
  assert.equal((await api('/api/contests/import', 'POST', { url: 'https://example.com/' })).response.status, 401);
  checks.anonymousAccess = true;
  const name = 'workshopqa' + Date.now();
  const registration = await api('/api/auth/register', 'POST', { username: name, email: name + '@example.test', password: randomBytes(24).toString('base64url') });
  assert.equal(registration.response.status, 200);
  cookie = registration.response.headers.get('set-cookie')?.split(';')[0] || '';
  assert.ok(cookie); createdAccount = true;
  assert.equal(registration.value.user.role, 'user'); checks.authentication = true;
  const poem = await api('/api/poems', 'POST', { title: 'Comprobación de publicación', content: 'La tarde vuelve al taller.', versionName: 'Guardada manualmente', settings: { poemFont: 'atkinson' } });
  assert.equal(poem.response.status, 201);
  const poemId = poem.value.poem.id;
  const initial = await api('/api/workshop'); assert.equal(initial.response.status, 200);
  const data = createEmptyWorkshop();
  data.tagCatalog = ['prueba']; data.tagColors = { prueba: '#5E409D' };
  data.localTags = { ['poem:' + poemId]: ['prueba'] };
  data.preferences = { poemColors: { ['poem:' + poemId]: '#5E409D' } };
  data.contests = [{ id: 'release-qa', name: 'Convocatoria de prueba de publicación', selections: [{ poemId: 'poem:' + poemId, versionId: 'latest' }], snapshots: [], profile: defaultContestProfile(), status: 'interested', reminders: [7, 2], agendaEnabled: true }];
  const saved = await api('/api/workshop', 'PUT', { revision: initial.value.revision, data });
  assert.equal(saved.response.status, 200);
  const recovered = await api('/api/workshop');
  assert.equal(recovered.value.data.tagColors.prueba, '#5E409D');
  assert.equal(recovered.value.data.contests[0].id, 'release-qa');
  assert.equal((await api('/api/workshop', 'PUT', { revision: initial.value.revision, data })).response.status, 409);
  checks.persistedWorkshop = true; checks.concurrentEdits = true;
  const plica = await api('/api/plicas', 'PUT', { plica: { fullName: 'Persona ficticia de QA', email: 'release@example.test', includeAi: false } });
  assert.equal(plica.response.status, 200);
  const recoveredPlica = await api('/api/plicas');
  assert.equal(recoveredPlica.value.plica.fullName, 'Persona ficticia de QA'); checks.plicaEncryptionRoundtrip = true;
  assert.equal((await api('/api/contests/import', 'POST', { url: 'http://127.0.0.1/' })).response.status, 422);
  const imported = await api('/api/contests/import', 'POST', { url: 'https://www.escritores.org/recursos-para-escritores/42187-48-concurso-literario-dr-alberto-manini-rios-2026' });
  assert.equal(imported.response.status, 200, imported.value.error);
  assert.equal(imported.value.contest.deadline, '2026-11-27'); checks.contestImport = true;
  // Only anonymous public responses are inspected; no user data is requested.
  for (const path of ['/qa/prototipo/verificacion.json', '/prototipo/', '/scripts/local-server.mjs', '/schema.sql']) {
    const response = await fetch(base + path); const text = await response.text();
    assert.ok(response.status === 404 || (!response.headers.get('content-type')?.includes('javascript') && !text.includes('CREATE TABLE') && !text.includes('realAccounts') && !text.includes('Prototipo local')));
  }
  checks.privateFilesExcluded = true;
} finally {
  if (createdAccount) {
    const deleted = await api('/api/auth/account', 'DELETE');
    assert.equal(deleted.response.status, 200, 'Failed to remove the disposable QA account');
    checks.qaAccountRemoved = true;
  }
}
await mkdir('qa/production', { recursive: true });
await writeFile('qa/production/verificacion.json', JSON.stringify({ checkedAt: new Date().toISOString(), ...checks }, null, 2));
console.log('Production verified: landing, real account, poems, workshop persistence, encrypted plica, importer, protected files and QA cleanup.');
