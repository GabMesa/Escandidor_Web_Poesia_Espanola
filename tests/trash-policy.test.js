import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTrashPolicy, TRASH_MAX_BYTES, trashTimestamp } from '../trash-policy.js';
import { cleanupTrashForAllUsers } from '../workers/trash-cleanup.js';

const now = Date.parse('2026-10-13T12:00:00Z');
const entry = (id, age, size = 10) => ({ id, title: 'Poema', deletedAt: new Date(now - age * 86400000).toISOString(), versions: [{ content: 'é'.repeat(size) }] });

test('expires exactly at thirty days and keeps newer copies', () => {
  const result = applyTrashPolicy([entry(1, 30), entry(2, 29), entry(3, 31)], { now });
  assert.deepEqual(result.retained.map(item => item.id), [2]);
  assert.deepEqual(result.removed.map(item => item.id), [1, 3]);
});

test('disabled automatic expiration keeps old copies', () => {
  assert.equal(applyTrashPolicy([entry(1, 80)], { now, autoCleanup: false }).retained.length, 1);
});

test('space cap is enforced in UTF-8 bytes and removes oldest first even with expiration off', () => {
  const result = applyTrashPolicy([entry(1, 100, 150000), entry(2, 90, 150000)], { now, autoCleanup: false });
  assert.deepEqual(result.retained.map(item => item.id), [2]);
  assert.ok(result.usedBytes <= TRASH_MAX_BYTES);
  assert.equal(result.removed[0].id, 1);
});

test('count limit also removes oldest copies without mutating the original', () => {
  const entries = Array.from({ length: 12 }, (_, index) => entry(index, index));
  assert.equal(applyTrashPolicy(entries, { now }).retained.length, 10);
  assert.equal(entries.length, 12);
});

test('D1 timestamps without a zone are interpreted as UTC', () => {
  assert.equal(trashTimestamp('2026-10-13 12:00:00'), now);
});

test('scheduled cleanup includes accounts without an active browser session', async () => {
  const users = [];
  const env = { escandidor_db: { prepare() { return { async all() { return { results: [{ user_id: 1 }, { user_id: 2 }] }; } }; } } };
  await cleanupTrashForAllUsers(env, async (_env, id) => users.push(id));
  assert.deepEqual(users, [1, 2]);
});
