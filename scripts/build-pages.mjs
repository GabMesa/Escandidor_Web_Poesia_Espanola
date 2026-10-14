import { cp, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = process.cwd();
const out = resolve(root, '.wrangler/pages-release');
await mkdir(out, { recursive: true });
const files = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isFile() &&
  (/\.(?:html|css|js|ico|png|svg|webmanifest)$/.test(entry.name) || ['_redirects', '_headers', '_routes.json', 'robots.txt', 'sitemap.xml', 'THIRD-PARTY-LICENSES.md', 'FLEXOKI-LICENSE.txt'].includes(entry.name)));
for (const file of files) await cp(resolve(root, file.name), resolve(out, file.name));
for (const directory of ['taller', 'assets', 'vendor', 'opendyslexic-0.92', 'licenses']) {
  await cp(resolve(root, directory), resolve(out, directory), {
    recursive: true, filter: path => !/\.(?:md|sql|py|mjs)$/i.test(path)
  });
}
console.log(`Public assets prepared: ${out}. Local databases, QA, prototypes and tools excluded.`);
