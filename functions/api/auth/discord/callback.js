import {
  createSession,
  isSecureRequest,
  parseCookies,
  randomToken,
  setSessionCookie,
} from '../../../_lib/helpers.js';

const OAUTH_STATE_COOKIE = 'escandidor_oauth_state';

function redirectHome(request, error) {
  const url = new URL('/', request.url);
  if (error) url.searchParams.set('auth_error', error);
  return url.toString();
}

function clearStateCookie(headers, secure) {
  const cookie = [`${OAUTH_STATE_COOKIE}=`, 'Path=/api/auth/discord', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) cookie.push('Secure');
  headers.append('Set-Cookie', cookie.join('; '));
}

async function uniqueUsername(env, preferred) {
  const base = preferred.replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 32) || 'poeta';
  let candidate = base;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const exists = await env.escandidor_db.prepare('SELECT id FROM users WHERE username = ?').bind(candidate).first();
    if (!exists) return candidate;
    candidate = `${base.slice(0, 24)}-${randomToken(3)}`;
  }
  return `poeta-${randomToken(6)}`;
}

export async function resolveDiscordUser(env, profile) {
  const email = profile.email.trim().toLowerCase();
  let user = await env.escandidor_db
    .prepare('SELECT * FROM users WHERE discord_id = ?')
    .bind(profile.id)
    .first();
  if (user) return user;

  user = await env.escandidor_db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first();
  if (user) {
    if (user.discord_id && user.discord_id !== profile.id) {
      throw new Error('Este correo ya esta vinculado a otra cuenta de Discord.');
    }
    const linked = await env.escandidor_db
      .prepare(
        `UPDATE users SET discord_id = ?, updated_at = datetime('now')
         WHERE id = ? AND discord_id IS NULL RETURNING *`
      )
      .bind(profile.id, user.id)
      .first();
    if (linked) return linked;

    const concurrentLink = await env.escandidor_db
      .prepare('SELECT * FROM users WHERE discord_id = ?')
      .bind(profile.id)
      .first();
    if (concurrentLink) return concurrentLink;
    throw new Error('No se pudo vincular la cuenta de Discord.');
  }

  const username = await uniqueUsername(env, profile.global_name || profile.username || 'poeta');
  try {
    return await env.escandidor_db
      .prepare(
        `INSERT INTO users (username, email, discord_id, role)
         VALUES (?, ?, ?, ?) RETURNING *`
      )
      .bind(username, email, profile.id, 'user')
      .first();
  } catch (error) {
    const concurrentUser = await env.escandidor_db
      .prepare('SELECT * FROM users WHERE discord_id = ?')
      .bind(profile.id)
      .first();
    if (concurrentUser) return concurrentUser;
    throw error;
  }
}

export async function onRequestGet({ request, env }) {
  const secure = isSecureRequest(request);
  const headers = new Headers();
  clearStateCookie(headers, secure);

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const expectedState = parseCookies(request)[OAUTH_STATE_COOKIE];
    if (!code || !state || !expectedState || state !== expectedState) {
      throw new Error('No se pudo validar el acceso con Discord.');
    }

    const redirectUri = new URL('/api/auth/discord/callback', request.url).toString();
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenResponse.ok) throw new Error('Discord rechazo el codigo de acceso.');
    const token = await tokenResponse.json();

    const profileResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!profileResponse.ok) throw new Error('No se pudo obtener tu perfil de Discord.');
    const profile = await profileResponse.json();
    if (!profile.id || !profile.email || !profile.verified) {
      throw new Error('Discord debe proporcionar un correo verificado.');
    }

    const user = await resolveDiscordUser(env, profile);

    if (user && user.status === 'disabled') throw new Error('Esta cuenta esta deshabilitada.');

    const sessionToken = await createSession(env, user.id);
    setSessionCookie(headers, sessionToken, secure);
    headers.set('Location', redirectHome(request));
    return new Response(null, { status: 302, headers });
  } catch (error) {
    headers.set('Location', redirectHome(request, error.message));
    return new Response(null, { status: 302, headers });
  }
}