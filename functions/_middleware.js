const LEGACY_EDITOR_PATHS = new Set(['/escandidor', '/escandidor/', '/escandidor.html']);
const CURATED_HTML_REDIRECTS = new Map([
  ['/recursos.html', '/recursos'],
  ['/formas-poeticas.html', '/formas-poeticas'],
  ['/concursos-de-poesia.html', '/concursos-de-poesia'],
]);

function isPagesDevHost(hostname) {
  return hostname === 'mesa-de-poesia.pages.dev' || hostname.endsWith('.mesa-de-poesia.pages.dev');
}

function withRobotsHeader(response, value) {
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const { pathname, searchParams, hostname } = url;

  if (CURATED_HTML_REDIRECTS.has(pathname)) {
    const destination = new URL(CURATED_HTML_REDIRECTS.get(pathname), url.origin);
    const headers = new Headers({ Location: destination.toString() });
    if (isPagesDevHost(hostname)) headers.set('X-Robots-Tag', 'noindex, follow');
    return new Response(null, { status: 301, headers });
  }

  if (LEGACY_EDITOR_PATHS.has(pathname) && searchParams.get('taller') !== '1') {
    const destination = new URL('/taller/', url.origin);
    for (const [key, value] of searchParams.entries()) {
      if (key !== 'taller' && key !== 'real') destination.searchParams.append(key, value);
    }
    const headers = new Headers({ Location: destination.toString() });
    if (isPagesDevHost(hostname)) headers.set('X-Robots-Tag', 'noindex, follow');
    return new Response(null, { status: 301, headers });
  }

  const response = await context.next();

  if (LEGACY_EDITOR_PATHS.has(pathname) && searchParams.get('taller') === '1') {
    return withRobotsHeader(response, 'noindex, nofollow');
  }

  if (isPagesDevHost(hostname)) {
    return withRobotsHeader(response, 'noindex, follow');
  }

  return response;
}
