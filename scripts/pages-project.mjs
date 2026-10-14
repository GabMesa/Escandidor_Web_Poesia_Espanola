import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
const account = 'ce1fd624d201e9f273bb808ccc2174bb';
const project = 'mesa-de-poesia';
const config = await readFile(join(process.env.APPDATA, 'xdg.config/.wrangler/config/default.toml'), 'utf8');
const token = config.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
if (!token) throw Error('No se encontró la sesión de Cloudflare.');
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${project}`;
const update = process.argv.includes('--set-build');
const response = await fetch(endpoint, {
  method: update ? 'PATCH' : 'GET',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  ...(update ? { body: JSON.stringify({ build_config: { build_command: 'npm run build', destination_dir: '.wrangler/pages-release', root_dir: '' } }) } : {})
});
const result = await response.json();
if (!response.ok || !result.success) throw Error(JSON.stringify(result.errors));
const value = result.result;
console.log(JSON.stringify({ name: value.name, productionBranch: value.production_branch,
  build: { command: value.build_config?.build_command, output: value.build_config?.destination_dir }, source: value.source?.type,
  production: { d1: value.deployment_configs?.production?.d1_databases,
    secretNames: Object.keys(value.deployment_configs?.production?.env_vars || {}) }
}, null, 2));
