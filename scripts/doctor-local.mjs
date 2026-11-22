import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { RETINA_ROLES, readRoleModelOverrides, buildRoleModelConfig, listRoleModels } from '../src/role-models.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let valid = true;
const apiKey = process.env.HORMOZ_API_KEY?.trim();
console.log('HORMOZ_API_KEY: ' + (apiKey ? 'configured' : 'MISSING'));
valid &&= Boolean(apiKey);

try {
  const config = JSON.parse(readFileSync(path.join(root, 'opencode.json'), 'utf8'));
  const provider = config.providers?.hormoz;
  if (
    config.model !== 'hormoz/sonnet' ||
    provider?.package !== '@opencode/ai/providers/openai-compatible' ||
    provider?.settings?.baseURL !== 'https://api.hormouz.net/v1' ||
    !provider?.env?.includes('HORMOZ_API_KEY')
  ) throw new Error('Hormouz provider configuration is inconsistent');
  const overrides = readRoleModelOverrides(path.join(root, '.retina', 'role-models.json'));
  const resolved = buildRoleModelConfig(config, overrides);
  for (const { role, upstreamModel } of listRoleModels(resolved)) {
    const agent = readFileSync(path.join(root, '.opencode', 'agents', role + '.md'), 'utf8');
    if (!agent.includes('\nmodel: hormoz/' + role + '\n')) {
      throw new Error('Missing role-model binding for ' + role);
    }
    console.log(role + ': ' + upstreamModel);
  }
  if (RETINA_ROLES.length !== 6) throw new Error('Unexpected role configuration');
  console.log('Hormouz provider and per-role model routing: configured');
} catch (error) {
  console.error('Invalid OpenCode configuration:', error.message);
  valid = false;
}

for (const command of ['node', 'opencode']) {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8' });
  const found = !result.error && result.status === 0;
  console.log(command + ': ' + (found ? 'installed' : 'MISSING'));
  valid &&= found;
}
if (valid) console.log('Local checks passed. Live API connectivity, model availability and tool calling are NOT verified.');
process.exitCode = valid ? 0 : 1;
