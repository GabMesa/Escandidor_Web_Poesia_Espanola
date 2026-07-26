// functions/_lib/helpers.js
// -----------------------------------------------------------------------
// Utilidades compartidas por todas las Pages Functions de /api/*.
// Este archivo NO exporta onRequest* asi que Cloudflare Pages no lo trata
// como una ruta; solo se importa desde los archivos de functions/api/**.
// -----------------------------------------------------------------------

export const SESSION_COOKIE_NAME = 'escandidor_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias
const PBKDF2_ITERATIONS = 100000;

// ---------------------------------------------------------------------
// Respuestas
// ---------------------------------------------------------------------

export function jsonResponse(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function errorResponse(message, status = 400, extra = {}) {
  return jsonResponse({ ok: false, error: message, ...extra }, { status });
}

export async function safeJson(request) {
  try {
    return await request.json();
  } catch (_) {
    return {};
  }
}

// ---------------------------------------------------------------------
// Crypto: hash de contrasenas (PBKDF2) y tokens de sesion
// ---------------------------------------------------------------------

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

export function randomToken(bytesLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(bytesLength));
  return bytesToHex(bytes);
}

export async function hashPassword(password, saltHex) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    256
  );
  return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt) };
}

export async function verifyPassword(password, saltHex, expectedHashHex) {
  const { hash } = await hashPassword(password, saltHex);
  if (hash.length !== expectedHashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ expectedHashHex.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------------
// Cookies de sesion
// ---------------------------------------------------------------------

export function parseCookies(request) {
  const header = request.headers.get('Cookie') || '';
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  });
  return out;
}

export function setSessionCookie(headers, token, secure) {
  const attrs = [
    `${SESSION_COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (secure) attrs.push('Secure');
  headers.append('Set-Cookie', attrs.join('; '));
}

export function clearSessionCookie(headers, secure) {
  const attrs = [`${SESSION_COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) attrs.push('Secure');
  headers.append('Set-Cookie', attrs.join('; '));
}

export async function createSession(env, userId) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await env.escandidor_db
    .prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, userId, expiresAt)
    .run();
  return token;
}

// ---------------------------------------------------------------------
// Sesion / autorizacion
// ---------------------------------------------------------------------

export async function getSessionUser(request, env) {
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;

  const row = await env.escandidor_db
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    )
    .bind(token)
    .first();

  if (!row || row.status === 'disabled') return null;
  return row;
}

export async function requireUser(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return { error: errorResponse('No autenticado.', 401) };
  return { user };
}

export async function requireAdmin(request, env) {
  const { user, error } = await requireUser(request, env);
  if (error) return { error };
  if (user.role !== 'admin') return { error: errorResponse('Se requieren permisos de administrador.', 403) };
  return { user };
}

// ---------------------------------------------------------------------
// Validacion / serializacion
// ---------------------------------------------------------------------

export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function serializePoem(row) {
  if (!row) return null;
  let settings = {};
  try {
    settings = JSON.parse(row.settings_json || '{}');
  } catch (_) {
    settings = {};
  }
  return {
    id: row.id,
    title: row.title,
    versionName: row.version_name,
    content: row.content,
    settings,
    colorIndex: row.color_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function isSecureRequest(request) {
  return new URL(request.url).protocol === 'https:';
}
