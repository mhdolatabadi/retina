import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let valid = true;
const apiKey = process.env.HORMOZ_API_KEY?.trim();
console.log('HORMOZ_API_KEY: ' + (apiKey ? 'configured' : 'MISSING'));
valid &&= Boolean(apiKey);
try {
  const config = JSON.parse(readFileSync(path.join(root, 'opencode.json'), 'utf8'));
  const provider = config.providers?.hormoz;
  const model = provider?.models?.sonnet;
  if (
    config.model !== 'hormoz/sonnet' ||
    provider?.package !== '@opencode/ai/providers/openai-compatible' ||
    provider?.settings?.baseURL !== 'https://api.hormouz.net/v1' ||
    !provider?.env?.includes('HORMOZ_API_KEY') ||
    model?.modelID !== 'anthropic/claude-sonnet-5.5'
  ) throw new Error('Hormouz provider config does not match the supplied API example');
  console.log('Hormouz provider/model: configured');
} catch (error) {
  console.error('Invalid OpenCode configuration: ' + error.message);
  valid = false;
}
for (const command of ['node', 'opencode']) {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8' });
  const found = !result.error && result.status === 0;
  console.log(command + ': ' + (found ? 'installed' : 'MISSING'));
  valid &&= found;
}
if (valid) console.log('Local checks passed. Live API connectivity and tool calling have NOT been verified.');
process.exitCode = valid ? 0 : 1;
