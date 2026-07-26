import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDiscordUser } from '../functions/api/auth/discord/callback.js';

class DiscordMemoryDb {
  constructor(users = []) {
    this.users = users.map((user) => ({
      role: 'user',
      status: 'active',
      discord_id: null,
      ...user,
    }));
  }

  prepare(sql) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    let bindings = [];
    return {
      bind: (...values) => {
        bindings = values;
        return this.prepareBound(normalized, bindings);
      },
      first: () => this.execute(normalized, bindings),
    };
  }

  prepareBound(sql, bindings) {
    return { first: () => this.execute(sql, bindings) };
  }

  execute(sql, bindings) {
    if (sql.includes('WHERE discord_id = ?')) {
      return this.users.find((user) => user.discord_id === bindings[0]) || null;
    }
    if (sql.includes('WHERE email = ?')) {
      return this.users.find((user) => user.email === bindings[0]) || null;
    }
    if (sql.includes('WHERE username = ?')) {
      return this.users.find((user) => user.username === bindings[0]) || null;
    }
    if (sql.startsWith('SELECT COUNT(*)')) return { count: this.users.length };
    if (sql.startsWith('UPDATE users SET discord_id')) {
      const user = this.users.find((candidate) => candidate.id === bindings[1]);
      if (!user || user.discord_id) return null;
      user.discord_id = bindings[0];
      return user;
    }
    if (sql.startsWith('INSERT INTO users')) {
      const [username, email, discordId, role] = bindings;
      if (this.users.some((user) => user.email === email || user.discord_id === discordId)) {
        throw new Error('UNIQUE constraint failed');
      }
      const user = {
        id: this.users.length + 1,
        username,
        email,
        discord_id: discordId,
        role,
        status: 'active',
      };
      this.users.push(user);
      return user;
    }
    throw new Error(`SQL no contemplado en el test: ${sql}`);
  }
}

const profile = {
  id: 'discord-123',
  email: 'poeta@example.test',
  verified: true,
  username: 'poeta',
  global_name: 'Poeta',
};

test('reuses one user for repeated Discord logins', async () => {
  const db = new DiscordMemoryDb();
  const env = { escandidor_db: db };

  const first = await resolveDiscordUser(env, profile);
  const second = await resolveDiscordUser(env, profile);

  assert.equal(first.id, second.id);
  assert.equal(db.users.length, 1);
  assert.equal(db.users[0].discord_id, profile.id);
});

test('reuses the Discord identity even when its verified email changes', async () => {
  const db = new DiscordMemoryDb();
  const env = { escandidor_db: db };
  const first = await resolveDiscordUser(env, profile);

  const second = await resolveDiscordUser(env, {
    ...profile,
    email: 'correo-nuevo@example.test',
  });

  assert.equal(second.id, first.id);
  assert.equal(db.users.length, 1);
});

test('links Discord to an existing basic account with the same verified email', async () => {
  const db = new DiscordMemoryDb([{
    id: 7,
    username: 'poeta-local',
    email: profile.email,
    password_hash: 'hash',
    password_salt: 'salt',
  }]);

  const user = await resolveDiscordUser({ escandidor_db: db }, profile);

  assert.equal(user.id, 7);
  assert.equal(user.discord_id, profile.id);
  assert.equal(db.users.length, 1);
});

test('does not link an email already owned by another Discord identity', async () => {
  const db = new DiscordMemoryDb([{
    id: 3,
    username: 'otra-persona',
    email: profile.email,
    discord_id: 'discord-other',
  }]);

  await assert.rejects(
    () => resolveDiscordUser({ escandidor_db: db }, profile),
    /otra cuenta de Discord/
  );
  assert.equal(db.users.length, 1);
});