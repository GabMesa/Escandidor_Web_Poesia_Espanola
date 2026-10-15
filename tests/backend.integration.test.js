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
      '--binding', `PLICA_ENCRYPTION_KEY=${Buffer.alloc(32,7).toString('base64')}`,
    ], { cwd: root, stdio: 'ignore', windowsHide: true });
    await waitForServer(baseUrl, server);

    const landing = await fetch(baseUrl);
    assert.equal(landing.status, 200);
    const landingHtml = await landing.text();
    assert.match(landingHtml, /id="intro-title"/);
    assert.match(landingHtml, /href="escandidor.html"/);
    assert.match(landingHtml, /href="apoyar.html"/);
    assert.doesNotMatch(landingHtml, /src="app.js"/);
    assert.equal((await fetch(`${baseUrl}/pagina-inexistente`)).status, 404);
    const editor = await fetch(`${baseUrl}/escandidor`);
    assert.equal(editor.status, 200);
    assert.match(await editor.text(), /id="poemInput"/);
    const legacyLanding = await fetch(`${baseUrl}/landing.html`, { redirect: 'manual' });
    assert.equal(legacyLanding.status, 301);
    assert.equal(new URL(legacyLanding.headers.get('location'), baseUrl).pathname, '/');


    const firstRegistration = await jsonRequest(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { username: 'primera', email: 'primera@example.test', password: 'Password123!' },
    });
    assert.equal(firstRegistration.response.status, 200);
    assert.equal(firstRegistration.payload.user.role, 'user');
    let firstCookie = cookieFrom(firstRegistration.response);
    const workshop=await jsonRequest(baseUrl,'/api/workshop',{cookie:firstCookie});
    const appearance={color:'#205EA6',scope:'workshop',newPoems:true,since:'2026-10-15T12:00:00Z'};
    const workshopData={...workshop.payload.data,preferences:{...workshop.payload.data.preferences,appearance}};
    const savedAppearance=await jsonRequest(baseUrl,'/api/workshop',{method:'PUT',cookie:firstCookie,body:{revision:workshop.payload.revision,data:workshopData}});
    assert.equal(savedAppearance.response.status,200,JSON.stringify(savedAppearance.payload));
    assert.deepEqual((await jsonRequest(baseUrl,'/api/workshop',{cookie:firstCookie})).payload.data.preferences.appearance,appearance);
    assert.equal((await jsonRequest(baseUrl, '/api/contests/import', { method: 'POST', body: { url: 'https://example.com/' } })).response.status, 401);
    assert.equal((await jsonRequest(baseUrl, '/api/contests/import', { method: 'POST', cookie: firstCookie, body: { url: 'http://127.0.0.1/' } })).response.status, 422);

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

    // Seed the pre-0015 format, then restore the retirement guard before exercising backfill.
    runWrangler(['d1','execute','escandidor-db','--local','--persist-to',persistence,'--command',`
      DROP TRIGGER plicas_retired_insert;
      INSERT INTO user_contest_plicas(user_id,contest_key,full_name,updated_at)
        SELECT id,'reciente','Perfil reciente','2026-10-13' FROM users WHERE username='primera';
      INSERT INTO user_contest_plicas(user_id,contest_key,full_name,email,updated_at)
        SELECT id,'anterior','Perfil anterior','migration@example.test','2026-10-01' FROM users WHERE username='primera';
      CREATE TRIGGER plicas_retired_insert BEFORE INSERT ON user_contest_plicas
        BEGIN SELECT RAISE(ABORT,'Perfil retirado'); END;
    `]);
    const migratedPlica=await jsonRequest(baseUrl,'/api/plicas',{cookie:firstCookie});
    assert.equal(migratedPlica.response.status,200);
    assert.equal(migratedPlica.payload.plica.fullName,'Perfil reciente');
    assert.equal(migratedPlica.payload.plica.email,'migration@example.test');
    const legacyCount=runWrangler(['d1','execute','escandidor-db','--local','--persist-to',persistence,
      '--command','SELECT COUNT(*) AS legacy_count FROM user_contest_plicas','--json']);
    assert.match(legacyCount,/"legacy_count":\s*0/);

    const anonymousPlica = await jsonRequest(baseUrl, '/api/plicas?contestId=concurso-prueba');
    assert.equal(anonymousPlica.response.status, 401);
    const plica = {fullName:'Autora de prueba',identityDocument:'ID de prueba',includeAi:true,
      aiStatement:'Declaración editable de prueba.',signatureDate:'2026-10-13'};
    const savedPlica = await jsonRequest(baseUrl, '/api/plicas', {method:'PUT',cookie:firstCookie,
      body:{contestId:'concurso-prueba',plica}});
    assert.equal(savedPlica.response.status,200);
    const loadedPlica = await jsonRequest(baseUrl, '/api/plicas?contestId=concurso-prueba',{cookie:firstCookie});
    assert.equal(loadedPlica.payload.plica.fullName,plica.fullName);
    assert.equal(loadedPlica.payload.plica.aiStatement,plica.aiStatement);
    assert.equal(loadedPlica.payload.plica.includeAi,true);
    const otherPlica = await jsonRequest(baseUrl, '/api/plicas?contestId=concurso-prueba',{cookie:secondCookie});
    assert.equal(otherPlica.payload.plica,null);
    const anotherContest = await jsonRequest(baseUrl, '/api/plicas?contestId=otro-concurso',{cookie:firstCookie});
    assert.equal(anotherContest.payload.plica.fullName,plica.fullName);
    assert.equal(loadedPlica.response.headers.get('cache-control'),'no-store');
    const storedPlica = runWrangler(['d1','execute','escandidor-db','--local','--persist-to',persistence,
      '--command','SELECT encrypted_sensitive,include_ai,ai_statement,signature_date FROM user_plica_profiles','--json']);
    assert.doesNotMatch(storedPlica,/Autora de prueba|ID de prueba/);
    assert.match(storedPlica,/Declaraci/);
    runWrangler(['d1','execute','escandidor-db','--local','--persist-to',persistence,
      '--command',"UPDATE user_plica_profiles SET encrypted_sensitive='{}'"]);
    const corruptedPlica=await jsonRequest(baseUrl,'/api/plicas',{cookie:firstCookie});
    assert.equal(corruptedPlica.response.status,503);
    assert.doesNotMatch(JSON.stringify(corruptedPlica.payload),/Autora|ID de prueba/);
    assert.equal((await jsonRequest(baseUrl,'/api/plicas',{method:'PUT',cookie:firstCookie,body:{plica}})).response.status,200);
    const invalidPlica = await jsonRequest(baseUrl,'/api/plicas',{method:'PUT',cookie:firstCookie,
      body:{contestId:'concurso-prueba',plica:{includeAi:true,aiStatement:''}}});
    assert.equal(invalidPlica.response.status,400);

    runWrangler([
      'd1', 'execute', 'escandidor-db', '--local', '--persist-to', persistence,
      '--command', "UPDATE users SET role = 'admin' WHERE username = 'primera';",
    ]);

    for (const body of [
      { title: '', content: 'Un verso' },
      { title: ' SIN TÍTULO ', content: 'Un verso' },
      { title: 'Sin titulo', content: 'Un verso' },
      { title: 'Poema válido', content: ' \n\t\u00a0' },
      { title: 'Poema válido' },
    ]) {
      const rejected = await jsonRequest(baseUrl, '/api/poems', { method: 'POST', cookie: firstCookie, body });
      assert.equal(rejected.response.status, 400);
    }

    const initialTrash = await jsonRequest(baseUrl, '/api/trash', { cookie: firstCookie });
    assert.equal(initialTrash.payload.policy.autoCleanup, true);
    assert.equal(initialTrash.payload.policy.maxBytes, 524288);
    const disableCleanup = await jsonRequest(baseUrl, '/api/trash', { method: 'PATCH', cookie: firstCookie, body: { autoCleanup: false } });
    assert.equal(disableCleanup.response.status, 200);
    assert.equal(disableCleanup.payload.policy.autoCleanup, false);
    assert.equal((await jsonRequest(baseUrl, '/api/trash', { cookie: secondCookie })).payload.policy.autoCleanup, true);
    // Seed old and oversized trash copies without touching active poem histories.
    runWrangler(['d1', 'execute', 'escandidor-db', '--local', '--persist-to', persistence, '--command', `
      INSERT INTO deleted_poems(user_id,poem_id,title,versions_json,deleted_at) VALUES
      (${firstRegistration.payload.user.id},90001,'Vieja','[{"content":"Conservar si está desactivado"}]',datetime('now','-31 days'));
    `]);
    assert.ok((await jsonRequest(baseUrl, '/api/trash', { cookie: firstCookie })).payload.trash.some(entry => entry.poemId === 90001));
    const enableCleanup = await jsonRequest(baseUrl, '/api/trash', { method: 'PATCH', cookie: firstCookie, body: { autoCleanup: true } });
    assert.equal(enableCleanup.response.status, 200);
    const expiredTrash = await jsonRequest(baseUrl, '/api/trash', { cookie: firstCookie });
    assert.equal(expiredTrash.payload.trash.some(entry => entry.poemId === 90001), false);
    assert.ok(expiredTrash.payload.deletedPoemIds.includes(90001));
    // Remove this synthetic tombstone to keep the original fixture assertions unchanged.
    runWrangler(['d1', 'execute', 'escandidor-db', '--local', '--persist-to', persistence, '--command', `DELETE FROM deleted_poems WHERE user_id=${firstRegistration.payload.user.id} AND poem_id=90001`]);

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

    const repeated = await jsonRequest(baseUrl, `/api/poems/${poemId}`, {
      method: 'PUT', cookie: firstCookie,
      body: { versionName: 'borrador', content: 'Primer texto' },
    });
    assert.equal(repeated.response.status, 200);
    assert.equal(repeated.payload.poem.version, 1);
    for (const body of [{ title: 'Sin título' }, { title: '' }, { content: ' \n\t\u00a0' }]) {
      const rejected = await jsonRequest(baseUrl, `/api/poems/${poemId}`, { method: 'PUT', cookie: firstCookie, body });
      assert.equal(rejected.response.status, 400);
    }

    const revisionUpdate = await jsonRequest(baseUrl, `/api/poems/${poemId}`, {
      method: 'PUT', cookie: firstCookie,
      body: {
        versionName: 'revision', content: 'Segundo texto',
        settings: {
          poemFont: 'lora', poeticForm: 'soneto', syllablePattern: '11',
          stressPatterns: { 11: '6-10' },
          hemistichPatterns: { 11: ['5', '7'] },
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
      hemistichPatterns: { 11: ['5', '7'] },
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

    const restoredRevision = await jsonRequest(baseUrl, '/api/trash', {
      method: 'POST', cookie: firstCookie, body: { trashId: deletedRevision.id },
    });
    assert.equal(restoredRevision.response.status, 200);
    assert.equal(restoredRevision.payload.poemId, poemId);
    const listAfterRestore = await jsonRequest(baseUrl, '/api/poems', { cookie: firstCookie });
    const poemAfterRestore = listAfterRestore.payload.poems.find((poem) => poem.id === poemId);
    assert.equal(poemAfterRestore.versions.at(-1).content, 'Segundo texto');
    const trashAfterRestore = await jsonRequest(baseUrl, '/api/trash', { cookie: firstCookie });
    assert.equal(trashAfterRestore.payload.trash.length, 1);

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

    const unauthenticatedAccountDeletion = await jsonRequest(baseUrl, '/api/auth/account', {
      method: 'DELETE',
    });
    assert.equal(unauthenticatedAccountDeletion.response.status, 401);

    const accountDeletion = await jsonRequest(baseUrl, '/api/auth/account', {
      method: 'DELETE', cookie: secondCookie,
    });
    assert.equal(accountDeletion.response.status, 200);
    assert.match(accountDeletion.response.headers.get('set-cookie') || '', /Max-Age=0/);

    const deletedAccountSession = await jsonRequest(baseUrl, '/api/auth/me', { cookie: secondCookie });
    assert.equal(deletedAccountSession.payload.user, null);
    const usersAfterSelfDeletion = await jsonRequest(baseUrl, '/api/admin/users', { cookie: firstCookie });
    assert.equal(usersAfterSelfDeletion.payload.users.some((user) => user.id === secondUser.id), false);
    const supportersAfterSelfDeletion = await jsonRequest(baseUrl, '/api/admin/supporters', { cookie: firstCookie });
    assert.equal(supportersAfterSelfDeletion.payload.supporters[0].user, null);

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
    const syncPayload = { title:'Sincronización entre dispositivos',content:'Autoguardado 43',versionName:'v43',
      settings:{poemFont:'lora',rhymeScheme:'abba'},sync:{id:'device-a-43',versionNumber:43,kind:'autosave',savedAt:'2026-10-15T02:00:00Z'} };
    const syncedPoem = await jsonRequest(baseUrl,'/api/poems',{method:'POST',cookie:firstCookie,body:syncPayload});
    assert.equal(syncedPoem.response.status,201);
    const syncId = syncedPoem.payload.poem.id;
    const duplicatePost = await jsonRequest(baseUrl,'/api/poems',{method:'POST',cookie:firstCookie,body:syncPayload});
    assert.equal(duplicatePost.payload.poem.id,syncId);
    const simultaneousImports=await Promise.all(Array.from({length:8},(_,index)=>jsonRequest(baseUrl,'/api/poems',{
      method:'POST',cookie:firstCookie,body:{...syncPayload,title:index%2?'Importación simultánea':' IMPORTACIÓN   SIMULTÁNEA ',sync:{...syncPayload.sync,id:'simultaneous-import-'+index},content:'Verso importado '+index}
    })));
    for(const response of simultaneousImports)assert.ok(response.response.ok,JSON.stringify(response.payload));
    assert.equal(new Set(simultaneousImports.map(r=>r.payload.poem.id)).size,1);
    const importedId=simultaneousImports[0].payload.poem.id;
    const importedHistory=(await jsonRequest(baseUrl,'/api/poems',{cookie:firstCookie})).payload.poems.find(p=>p.id===importedId);
    assert.equal(importedHistory.versions.length,8);
    await jsonRequest(baseUrl,`/api/poems/${importedId}`,{method:'DELETE',cookie:firstCookie});
    const concurrent = await Promise.all(['a','b'].map(device=>jsonRequest(baseUrl,`/api/poems/${syncId}`,{
      method:'PUT',cookie:firstCookie,body:{...syncPayload,content:`Cambio del dispositivo ${device}`,settings:{poemFont:'atkinson'},
        sync:{...syncPayload.sync,id:`device-${device}-44`,versionNumber:44}}})));
    for(const result of concurrent)assert.equal(result.response.status,200,JSON.stringify(result.payload));
    const retry = await jsonRequest(baseUrl,`/api/poems/${syncId}`,{method:'PUT',cookie:firstCookie,body:{...syncPayload,
      content:'Cambio del dispositivo a',settings:{poemFont:'atkinson'},sync:{...syncPayload.sync,id:'device-a-44',versionNumber:44}}});
    assert.equal(retry.payload.syncedVersion,concurrent[0].payload.syncedVersion);
    const syncedList = await jsonRequest(baseUrl,'/api/poems',{cookie:firstCookie});
    const history = syncedList.payload.poems.find(p=>p.id===syncId).versions;
    assert.equal(history.length,3);
    assert.equal(history[0].sync.versionNumber,43);
    assert.equal(history[0].sync.kind,'autosave');
    assert.equal(history[0].sync.settings.poemFont,'lora');
    assert.equal(history[1].sync.settings.poemFont,'atkinson');
    assert.equal((await jsonRequest(baseUrl,`/api/poems/${syncId}`,{method:'DELETE',cookie:firstCookie})).response.status,200);

    const compressionPayload=n=>({title:'Compresión entre dispositivos',content:n%2?'Una estrofa original.':'Otra estrofa distinta.',versionName:'v'+n,
      settings:{poemFont:n===5?'atkinson':'lora'},sync:{id:'compression-'+n,kind:'manual',versionNumber:n,savedAt:'2026-10-15T03:00:00Z'}});
    const compressionPoem=await jsonRequest(baseUrl,'/api/poems',{method:'POST',cookie:firstCookie,body:compressionPayload(1)});
    const compressionId=compressionPoem.payload.poem.id;
    for(let n=2;n<=6;n++)assert.equal((await jsonRequest(baseUrl,`/api/poems/${compressionId}`,{method:'PUT',cookie:firstCookie,body:compressionPayload(n)})).response.status,200);
    const previewCompression=await jsonRequest(baseUrl,`/api/poems/${compressionId}/compress`,{method:'POST',cookie:firstCookie,body:{dryRun:true}});
    assert.equal(previewCompression.response.status,200,JSON.stringify(previewCompression.payload));
    assert.equal(previewCompression.payload.before,6);assert.equal(previewCompression.payload.after,3);
    const compressed=await jsonRequest(baseUrl,`/api/poems/${compressionId}/compress`,{method:'POST',cookie:firstCookie,body:{}});
    assert.equal(compressed.response.status,200,JSON.stringify(compressed.payload));assert.equal(compressed.payload.removed,3);assert.equal(compressed.payload.removedVersions.length,3);
    const againCompressed=await jsonRequest(baseUrl,`/api/poems/${compressionId}/compress`,{method:'POST',cookie:firstCookie,body:{}});
    assert.equal(againCompressed.payload.removed,0);
    for(const [path,method,body] of [[`/api/poems/${compressionId}`,'PUT',compressionPayload(1)],['/api/poems','POST',compressionPayload(1)]]){
      const replay=await jsonRequest(baseUrl,path,{method,cookie:firstCookie,body});assert.equal(replay.response.status,200,JSON.stringify(replay.payload));assert.equal(replay.payload.compressed,true);assert.equal(replay.payload.syncedVersion,3);
    }
    const replayBatch=await jsonRequest(baseUrl,`/api/poems/${compressionId}/versions`,{method:'POST',cookie:firstCookie,body:{versions:[compressionPayload(1),compressionPayload(2)]}});
    assert.equal(replayBatch.response.status,200,JSON.stringify(replayBatch.payload));assert.equal(replayBatch.payload.uploaded.length,2);
    const legacyAlias=await jsonRequest(baseUrl,`/api/poems/${compressionId}`,{method:'PUT',cookie:firstCookie,body:{...compressionPayload(1),sync:{...compressionPayload(1).sync,id:'legacy-local-alias',cloudVersion:1}}});
    assert.equal(legacyAlias.response.status,200,JSON.stringify(legacyAlias.payload));assert.equal(legacyAlias.payload.compressed,true);assert.equal(legacyAlias.payload.syncedVersion,3);
    const changedRetired=await jsonRequest(baseUrl,`/api/poems/${compressionId}`,{method:'PUT',cookie:firstCookie,body:{...compressionPayload(1),content:'Una modificación nueva en una copia vieja.'}});
    assert.equal(changedRetired.response.status,409);
    const compressedHistory=(await jsonRequest(baseUrl,'/api/poems',{cookie:firstCookie})).payload.poems.find(p=>p.id===compressionId);
    assert.equal(compressedHistory.versions.length,3);assert.equal(compressedHistory.content,compressionPayload(6).content);
    const isolationUser=await jsonRequest(baseUrl,'/api/auth/register',{method:'POST',body:{username:'compression-other',email:'compression-other@example.test',password:'Password123!'}});
    assert.equal((await jsonRequest(baseUrl,`/api/poems/${compressionId}/compress`,{method:'POST',cookie:cookieFrom(isolationUser.response),body:{}})).response.status,404);
    const compressedTrash=await jsonRequest(baseUrl,'/api/trash',{cookie:firstCookie});assert.ok(compressedTrash.payload.compressedVersions.some(v=>v.poemId===compressionId&&v.clientId==='compression-1'));
    assert.equal((await jsonRequest(baseUrl,`/api/poems/${compressionId}`,{method:'DELETE',cookie:firstCookie})).response.status,200);

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
    assert.equal(rows[0].version_count, 3);
    assert.match(rows[0].versions, /borrador:Primer texto/);
    assert.match(rows[0].versions, /revision:Segundo texto/);
    assert.match(rows[0].versions, /final:Texto definitivo/);
    assert.equal(rows[0].font_family, 'lora');
    assert.deepEqual(JSON.parse(rows[0].configurations), {
      poemFont: 'lora', poeticForm: 'soneto', syllablePattern: '11',
      stressPatterns: { 11: '6-10' },
      hemistichPatterns: { 11: ['5', '7'] },
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
