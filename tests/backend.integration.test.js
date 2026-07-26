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
    const firstCookie = cookieFrom(firstRegistration.response);

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
        settings: { rhymeMode: 'asonante', stressPattern: [2, 6, 10], nested: { sinalefa: false } },
      },
    });
    assert.equal(revisionUpdate.response.status, 200);
    const finalUpdate = await jsonRequest(baseUrl, `/api/poems/${poemId}`, {
      method: 'PUT', cookie: firstCookie,
      body: { versionName: 'final', content: 'Texto definitivo' },
    });
    assert.equal(finalUpdate.response.status, 200);
    assert.equal(finalUpdate.payload.poem.versionName, 'final');
    assert.deepEqual(finalUpdate.payload.poem.settings, {
      rhymeMode: 'asonante', stressPattern: [2, 6, 10], nested: { sinalefa: false },
    });

    const secondPoem = await jsonRequest(baseUrl, '/api/poems', {
      method: 'POST', cookie: firstCookie,
      body: { title: 'Segundo poema', versionName: 'unica', content: 'Otro texto', settings: { form: 'libre' } },
    });
    assert.equal(secondPoem.response.status, 201);

    const ownerList = await jsonRequest(baseUrl, '/api/poems', { cookie: firstCookie });
    assert.equal(ownerList.payload.poems.length, 2);

    const otherUserList = await jsonRequest(baseUrl, '/api/poems', { cookie: secondCookie });
    assert.deepEqual(otherUserList.payload.poems, []);
    const forbiddenUpdate = await jsonRequest(baseUrl, `/api/poems/${poemId}`, {
      method: 'PUT', cookie: secondCookie, body: { content: 'No permitido' },
    });
    assert.equal(forbiddenUpdate.response.status, 404);

    const stats = await jsonRequest(baseUrl, '/api/admin/stats', { cookie: firstCookie });
    assert.deepEqual(stats.payload.stats, { userCount: 2, poemCount: 2, adminCount: 1 });
    const adminUsers = await jsonRequest(baseUrl, '/api/admin/users', { cookie: firstCookie });
    assert.equal(adminUsers.payload.users.length, 2);
    assert.equal(adminUsers.payload.users.find((user) => user.username === 'primera').poemCount, 2);
    const adminPoems = await jsonRequest(baseUrl, '/api/admin/poems', { cookie: firstCookie });
    assert.equal(adminPoems.payload.poems.length, 2);
    assert.equal(adminPoems.payload.poems[0].owner.username, 'primera');

    const secondUser = adminUsers.payload.users.find((user) => user.username === 'segunda');
    const promoted = await jsonRequest(baseUrl, `/api/admin/users/${secondUser.id}`, {
      method: 'PATCH', cookie: firstCookie, body: { role: 'admin', status: 'active' },
    });
    assert.equal(promoted.response.status, 200);
    assert.equal(promoted.payload.user.role, 'admin');
  } finally {
    if (server) stopProcess(server);
  }

  try {
    const output = runWrangler([
      'd1', 'execute', 'escandidor-db', '--local', '--persist-to', persistence, '--json',
      '--command', `SELECT p.name, p.configurations, COUNT(pv.id) AS version_count,
        GROUP_CONCAT(pv.name || ':' || pv.content, '|') AS versions
        FROM poems p JOIN poem_versions pv ON pv.poem_id = p.id
        GROUP BY p.id ORDER BY p.id;`,
    ]);
    const result = JSON.parse(output);
    const rows = result[0].results;
    assert.equal(rows.length, 2);
    assert.equal(rows[0].name, 'Soneto de prueba');
    assert.equal(rows[0].version_count, 3);
    assert.match(rows[0].versions, /borrador:Primer texto/);
    assert.match(rows[0].versions, /revision:Segundo texto/);
    assert.match(rows[0].versions, /final:Texto definitivo/);
    assert.deepEqual(JSON.parse(rows[0].configurations), {
      rhymeMode: 'asonante', stressPattern: [2, 6, 10], nested: { sinalefa: false },
    });
    assert.equal(rows[1].name, 'Segundo poema');
    assert.equal(rows[1].version_count, 1);
    assert.deepEqual(JSON.parse(rows[1].configurations), { form: 'libre' });
  } finally {
    rmSync(persistence, { recursive: true, force: true });
  }
});