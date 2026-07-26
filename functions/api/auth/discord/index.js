import { errorResponse, randomToken, isSecureRequest } from '../../../_lib/helpers.js';

const OAUTH_STATE_COOKIE = 'escandidor_oauth_state';

export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return errorResponse('El acceso con Discord aun no esta configurado.', 503);
  }

  const state = randomToken(24);
  const redirectUri = new URL('/api/auth/discord/callback', request.url).toString();
  const authorizeUrl = new URL('https://discord.com/oauth2/authorize');
  authorizeUrl.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', 'identify email');
  authorizeUrl.searchParams.set('state', state);

  const cookie = [
    `${OAUTH_STATE_COOKIE}=${state}`,
    'Path=/api/auth/discord',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=600',
  ];
  if (isSecureRequest(request)) cookie.push('Secure');

  return new Response(null, {
    status: 302,
    headers: { Location: authorizeUrl.toString(), 'Set-Cookie': cookie.join('; ') },
  });
}