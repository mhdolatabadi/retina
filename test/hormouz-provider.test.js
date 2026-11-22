import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../opencode.json', import.meta.url), 'utf8'));
const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');

test('Hormouz provider uses supplied OpenAI-compatible endpoint and model', () => {
  assert.equal(config.model, 'hormoz/sonnet');
  const provider = config.providers.hormoz;
  assert.equal(provider.package, '@opencode/ai/providers/openai-compatible');
  assert.equal(provider.settings.baseURL, 'https://api.hormouz.net/v1');
  assert.equal(provider.models.sonnet.modelID, 'anthropic/claude-sonnet-5.5');
  assert.equal(provider.name, 'Hormoz AI');
});

test('provider authenticates via an environment variable without committing secrets', () => {
  assert.deepEqual(config.providers.hormoz.env, ['HORMOZ_API_KEY']);
  assert.match(envExample, /^HORMOZ_API_KEY=$/m);
  assert.doesNotMatch(JSON.stringify(config), /ng-[A-Za-z0-9]{12,}/);
  assert.doesNotMatch(envExample, /^HORMOZ_BASE_URL=|^HORMOZ_MODEL_ID=/m);
});
