import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const wrangler = resolve(root, 'node_modules/wrangler/bin/wrangler.js');

function runWrangler(args) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

async function waitForServer(url, process) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (process.exitCode !== null) throw new Error('Wrangler termino antes de iniciar el servidor.');
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error('Wrangler no inicio el servidor a tiempo.');
}

function stopProcess(childProcess) {
  if (childProcess.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(childProcess.pid), '/T', '/F'], { windowsHide: true });
  } else {
    childProcess.kill('SIGTERM');
  }
}

function cookieFrom(response) {
  return response.headers.get('set-cookie')?.split(';', 1)[0] || '';
}

async function jsonRequest(baseUrl, path, { method = 'GET', body, cookie = '' } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  return { response, payload };
}

test('persists every poem version and user configuration in D1', { timeout: 45_000 }, async () => {
  const persistence = mkdtempSync(join(tmpdir(), 'escandidor-d1-'));
  const port = 8900 + Math.floor(Math.random() * 500);
  const baseUrl = `http://127.0.0.1:${port}`;
  let server;

  try {
    runWrangler([
      'd1', 'execute', 'escandidor-db', '--local', '--persist-to', persistence,
      '--file', './schema.sql',
    ]);

    server = spawn(process.execPath, [
      wrangler, 'pages', 'dev', '.', '--port', String(port),
      '--persist-to', persistence, '--log-level', 'error',
      '--show-interactive-dev-session=false',
    ], { cwd: root, stdio: 'ignore', windowsHide: true });
    await waitForServer(baseUrl, server);

    const firstRegistration = await jsonRequest(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { username: 'primera', email: 'primera@example.test', password: 'Password123!' },
    });
    assert.equal(firstRegistration.response.status, 200);
    assert.equal(firstRegistration.payload.user.role, 'user');
    let firstCookie = cookieFrom(firstRegistration.response);

    const duplicateLogin = await jsonRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'primera@example.test', password: 'Password123!' },
    });
    assert.equal(duplicateLogin.response.status, 200);
    assert.equal(duplicateLogin.payload.otherSessions, 1);
    const duplicateCookie = cookieFrom(duplicateLogin.response);

    const duplicateSessionState = await jsonRequest(baseUrl, '/api/auth/me', {
      cookie: duplicateCookie,
    });
    assert.equal(duplicateSessionState.payload.otherSessions, 1);

    const revoked = await jsonRequest(baseUrl, '/api/auth/sessions/others', {
      method: 'DELETE', cookie: duplicateCookie,
    });
    assert.equal(revoked.response.status, 200);
    assert.equal(revoked.payload.revoked, 1);

    const oldSessionState = await jsonRequest(baseUrl, '/api/auth/me', { cookie: firstCookie });
    assert.equal(oldSessionState.payload.user, null);
    const activeSessionState = await jsonRequest(baseUrl, '/api/auth/me', { cookie: duplicateCookie });
    assert.equal(activeSessionState.payload.user.username, 'primera');
    assert.equal(activeSessionState.payload.otherSessions, 0);
    firstCookie = duplicateCookie;

    const secondRegistration = await jsonRequest(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { username: 'segunda', email: 'segunda@example.test', password: 'Password123!' },
    });
    assert.equal(secondRegistration.response.status, 200);
    assert.equal(secondRegistration.payload.user.role, 'user');
    const secondCookie = cookieFrom(secondRegistration.response);

    runWrangler([
      'd1', 'execute', 'escandidor-db', '--local', '--persist-to', persistence,
      '--command', "UPDATE users SET role = 'admin' WHERE username = 'primera';",
    ]);

    const firstPoem = await jsonRequest(baseUrl, '/api/poems', {
      method: 'POST', cookie: firstCookie,
      body: {
        title: 'Soneto de prueba', versionName: 'borrador', content: 'Primer texto',
        settings: { rhymeMode: 'consonante', stressPattern: [6, 10], nested: { sinalefa: true } },
        colorIndex: 3,
      },
    });
    assert.equal(firstPoem.response.status, 201);
    const poemId = firstPoem.payload.poem.id;

    const revisionUpdate = await jsonRequest(baseUrl, `/api/poems/${poemId}`, {
      method: 'PUT', cookie: firstCookie,
      body: {
        versionName: 'revision', content: 'Segundo texto',
        settings: {
          poemFont: 'lora', poeticForm: 'soneto', syllablePattern: '11',
          stressPatterns: { 11: '6-10' },
          rhymeMode: 'asonante', stressPattern: [2, 6, 10],
          nested: { sinalefa: false },
        },
      },
    });
    assert.equal(revisionUpdate.response.status, 200);
    const finalUpdate = await jsonRequest(baseUrl, `/api/poems/${poemId}`, {
      method: 'PUT', cookie: firstCookie,
      body: { versionName: 'final', content: 'Texto definitivo' },
    });
    assert.equal(finalUpdate.response.status, 200);
    assert.equal(finalUpdate.payload.poem.versionName, 'final');
    assert.equal(finalUpdate.payload.poem.fontFamily, 'lora');
    assert.deepEqual(finalUpdate.payload.poem.settings, {
      poemFont: 'lora', poeticForm: 'soneto', syllablePattern: '11',
      stressPatterns: { 11: '6-10' },
      rhymeMode: 'asonante', stressPattern: [2, 6, 10],
      nested: { sinalefa: false },
    });

    const secondPoem = await jsonRequest(baseUrl, '/api/poems', {
      method: 'POST', cookie: firstCookie,
      body: { title: 'Segundo poema', versionName: 'unica', content: 'Otro texto', settings: { form: 'libre' } },
    });
    assert.equal(secondPoem.response.status, 201);

    const disposablePoem = await jsonRequest(baseUrl, '/api/poems', {
      method: 'POST', cookie: firstCookie,
      body: { title: 'Poema eliminable', versionName: 'unica', content: 'Desaparece' },
    });
    const deletedPoem = await jsonRequest(baseUrl, `/api/poems/${disposablePoem.payload.poem.id}`, {
      method: 'DELETE', cookie: firstCookie,
    });
    assert.equal(deletedPoem.response.status, 200);

    const deletionState = await jsonRequest(baseUrl, '/api/trash', { cookie: firstCookie });
    assert.equal(deletionState.response.status, 200);
    assert.deepEqual(deletionState.payload.deletedPoemIds, [disposablePoem.payload.poem.id]);

    const staleReupload = await jsonRequest(baseUrl, '/api/poems', {
      method: 'POST', cookie: firstCookie,
      body: {
        title: 'Poema eliminable',
        versionName: 'copia antigua',
        content: 'Desaparece',
        sourcePoemId: disposablePoem.payload.poem.id,
      },
    });
    assert.equal(staleReupload.response.status, 409);
    assert.equal(staleReupload.payload.code, 'poem_deleted');

    const ownerList = await jsonRequest(baseUrl, '/api/poems', { cookie: firstCookie });
    assert.equal(ownerList.payload.poems.length, 2);
    const versionedPoem = ownerList.payload.poems.find((poem) => poem.id === poemId);
    assert.deepEqual(
      versionedPoem.versions.map((version) => ({
        version: version.version,
        versionName: version.versionName,
        content: version.content,
      })),
      [
        { version: 1, versionName: 'borrador', content: 'Primer texto' },
        { version: 2, versionName: 'revision', content: 'Segundo texto' },
        { version: 3, versionName: 'final', content: 'Texto definitivo' },
      ]
    );

    const applicationState = await jsonRequest(baseUrl, '/api/state', { cookie: firstCookie });
    assert.equal(applicationState.response.status, 200);
    assert.equal(applicationState.payload.state.schemaVersion, 1);
    assert.equal(applicationState.payload.state.poems.length, 2);
    assert.deepEqual(applicationState.payload.state.deletedPoemIds, [disposablePoem.payload.poem.id]);
    assert.equal(
      applicationState.payload.state.poems.find((poem) => poem.id === poemId).versions.length,
      3,
    );

    const otherUserList = await jsonRequest(baseUrl, '/api/poems', { cookie: secondCookie });
    assert.deepEqual(otherUserList.payload.poems, []);
    const forbiddenUpdate = await jsonRequest(baseUrl, `/api/poems/${poemId}`, {
      method: 'PUT', cookie: secondCookie, body: { content: 'No permitido' },
    });
    assert.equal(forbiddenUpdate.response.status, 404);

    const forbiddenDelete = await jsonRequest(baseUrl, `/api/poems/${poemId}?version=2`, {
      method: 'DELETE', cookie: secondCookie,
    });
    assert.equal(forbiddenDelete.response.status, 404);
    const deletedVersion = await jsonRequest(baseUrl, `/api/poems/${poemId}?version=2`, {
      method: 'DELETE', cookie: firstCookie,
    });
    assert.equal(deletedVersion.response.status, 200);
    assert.equal(deletedVersion.payload.poem.versionName, 'final');
    assert.equal(deletedVersion.payload.poem.content, 'Texto definitivo');

    const trash = await jsonRequest(baseUrl, '/api/trash', { cookie: firstCookie });
    assert.equal(trash.response.status, 200);
    assert.equal(trash.payload.trash.length, 2);
    const deletedRevision = trash.payload.trash.find((entry) => entry.title === 'Soneto de prueba');
    assert.equal(deletedRevision.versions[0].versionName, 'revision');
    const deletedWholePoem = trash.payload.trash.find((entry) => entry.title === 'Poema eliminable');
    assert.equal(deletedWholePoem.versions[0].content, 'Desaparece');
    const otherUserTrash = await jsonRequest(baseUrl, '/api/trash', { cookie: secondCookie });
    assert.deepEqual(otherUserTrash.payload.trash, []);

    const emptiedTrash = await jsonRequest(baseUrl, '/api/trash', {
      method: 'DELETE', cookie: firstCookie,
    });
    assert.equal(emptiedTrash.response.status, 200);
    const emptyTrash = await jsonRequest(baseUrl, '/api/trash', { cookie: firstCookie });
    assert.deepEqual(emptyTrash.payload.trash, []);
    assert.deepEqual(emptyTrash.payload.deletedPoemIds, [disposablePoem.payload.poem.id]);

    const staleReuploadAfterEmptyingTrash = await jsonRequest(baseUrl, '/api/poems', {
      method: 'POST', cookie: firstCookie,
      body: {
        title: 'Poema eliminable',
        versionName: 'otra copia antigua',
        content: 'Desaparece',
        sourcePoemId: disposablePoem.payload.poem.id,
      },
    });
    assert.equal(staleReuploadAfterEmptyingTrash.response.status, 409);

    const stats = await jsonRequest(baseUrl, '/api/admin/stats', { cookie: firstCookie });
    assert.deepEqual(stats.payload.stats, {
      userCount: 2,
      poemCount: 2,
      adminCount: 1,
      payingUserCount: 0,
      revenue: [],
    });
    const adminUsers = await jsonRequest(baseUrl, '/api/admin/users', { cookie: firstCookie });
    assert.equal(adminUsers.payload.users.length, 2);
    assert.equal(adminUsers.payload.users.find((user) => user.username === 'primera').poemCount, 2);
    const adminPoems = await jsonRequest(baseUrl, '/api/admin/poems', { cookie: firstCookie });
    assert.equal(adminPoems.payload.poems.length, 2);
    assert.equal(adminPoems.payload.poems[0].owner.username, 'primera');

    const secondUser = adminUsers.payload.users.find((user) => user.username === 'segunda');
    const markedAsPaying = await jsonRequest(baseUrl, `/api/admin/users/${secondUser.id}`, {
      method: 'PATCH', cookie: firstCookie,
      body: {
        role: 'user',
        status: 'active',
        paying: true,
        personalizedMessage: 'Gracias, segunda, por sostener cada verso.',
      },
    });
    assert.equal(markedAsPaying.response.status, 200);

    const supporterGreeting = await jsonRequest(baseUrl, '/api/supporters', { cookie: secondCookie });
    assert.equal(supporterGreeting.payload.supporter.message, 'Gracias, segunda, por sostener cada verso.');

    const adminSupporters = await jsonRequest(baseUrl, '/api/admin/supporters', { cookie: firstCookie });
    assert.equal(adminSupporters.payload.supporters.length, 1);
    assert.equal(adminSupporters.payload.supporters[0].user.username, 'segunda');

    const payingStats = await jsonRequest(baseUrl, '/api/admin/stats', { cookie: firstCookie });
    assert.equal(payingStats.payload.stats.payingUserCount, 1);

    const promoted = await jsonRequest(baseUrl, `/api/admin/users/${secondUser.id}`, {
      method: 'PATCH', cookie: firstCookie, body: { role: 'admin', status: 'active' },
    });
    assert.equal(promoted.response.status, 200);
    assert.equal(promoted.payload.user.role, 'admin');

    const sameTitleNewPoem = await jsonRequest(baseUrl, '/api/poems', {
      method: 'POST', cookie: firstCookie,
      body: { title: 'Poema eliminable', versionName: 'nuevo', content: 'Un poema diferente' },
    });
    assert.equal(sameTitleNewPoem.response.status, 201);
    assert.notEqual(sameTitleNewPoem.payload.poem.id, disposablePoem.payload.poem.id);
    const removeSameTitleNewPoem = await jsonRequest(
      baseUrl,
      `/api/poems/${sameTitleNewPoem.payload.poem.id}`,
      { method: 'DELETE', cookie: firstCookie },
    );
    assert.equal(removeSameTitleNewPoem.response.status, 200);
  } finally {
    if (server) stopProcess(server);
  }

  try {
    const output = runWrangler([
      'd1', 'execute', 'escandidor-db', '--local', '--persist-to', persistence, '--json',
      '--command', `SELECT p.name, p.configurations, p.font_family, COUNT(pv.id) AS version_count,
        GROUP_CONCAT(pv.name || ':' || pv.content, '|') AS versions
        FROM poems p JOIN poem_versions pv ON pv.poem_id = p.id
        GROUP BY p.id ORDER BY p.id;`,
    ]);
    const result = JSON.parse(output);
    const rows = result[0].results;
    assert.equal(rows.length, 2);
    assert.equal(rows[0].name, 'Soneto de prueba');
    assert.equal(rows[0].version_count, 2);
    assert.match(rows[0].versions, /borrador:Primer texto/);
    assert.doesNotMatch(rows[0].versions, /revision:Segundo texto/);
    assert.match(rows[0].versions, /final:Texto definitivo/);
    assert.equal(rows[0].font_family, 'lora');
    assert.deepEqual(JSON.parse(rows[0].configurations), {
      poemFont: 'lora', poeticForm: 'soneto', syllablePattern: '11',
      stressPatterns: { 11: '6-10' },
      rhymeMode: 'asonante', stressPattern: [2, 6, 10],
      nested: { sinalefa: false },
    });
    assert.equal(rows[1].name, 'Segundo poema');
    assert.equal(rows[1].version_count, 1);
    assert.equal(rows[1].font_family, 'atkinson');
    assert.deepEqual(JSON.parse(rows[1].configurations), { form: 'libre', poemFont: 'atkinson' });
  } finally {
    rmSync(persistence, { recursive: true, force: true });
  }
});