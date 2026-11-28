import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/_middleware.js';

function makeContext(url, nextResponse = new Response('ok', { status: 200 })) {
  return {
    request: new Request(url),
    next: async () => nextResponse,
  };
}

test('redirects direct visits to legacy /escandidor paths permanently to /taller/', async () => {
  for (const path of ['/escandidor', '/escandidor/', '/escandidor.html']) {
    const response = await onRequest(makeContext(`https://poesia.mimesa.dev${path}`));
    assert.equal(response.status, 301, path);
    assert.equal(response.headers.get('location'), 'https://poesia.mimesa.dev/taller/');
  }

  const withError = await onRequest(makeContext('https://poesia.mimesa.dev/escandidor?auth_error=test'));
  assert.equal(withError.status, 301);
  assert.equal(withError.headers.get('location'), 'https://poesia.mimesa.dev/taller/?auth_error=test');
});

test('allows embedded iframe editor requests with noindex header', async () => {
  const response = await onRequest(makeContext('https://poesia.mimesa.dev/escandidor.html?taller=1&real=1'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
});

test('marks legacy pages.dev hosts as noindex without breaking access', async () => {
  const home = await onRequest(makeContext('https://mesa-de-poesia.pages.dev/'));
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('x-robots-tag'), 'noindex, follow');

  const preview = await onRequest(makeContext('https://abc123.mesa-de-poesia.pages.dev/taller/'));
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get('x-robots-tag'), 'noindex, follow');

  const customDomain = await onRequest(makeContext('https://poesia.mimesa.dev/taller/'));
  assert.equal(customDomain.status, 200);
  assert.equal(customDomain.headers.get('x-robots-tag'), null);
});
