import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RETINA_ROLES, validateUpstreamModel, buildRoleModelConfig, listRoleModels, validateOverrides } from '../src/role-models.js';

const config = JSON.parse(readFileSync(new URL('../opencode.json', import.meta.url), 'utf8'));
test('every Retina agent has an explicit model selector and a provider alias', () => {
  for (const role of RETINA_ROLES) {
    const source = readFileSync(new URL('../.opencode/agents/' + role + '.md', import.meta.url), 'utf8');
    assert.match(source, new RegExp('^model: hormoz/' + role + '$', 'm'));
    assert.equal(config.providers.hormoz.models[role].modelID, 'anthropic/claude-sonnet-5.5');
  }
});
test('role-specific upstream models are independent and leave the base config unchanged', () => {
  const overrides = { coder: 'openai/gpt-example', 'reviewer-2': 'google/gemini-example' };
  const effective = buildRoleModelConfig(config, overrides);
  assert.equal(effective.providers.hormoz.models.coder.modelID, 'openai/gpt-example');
  assert.equal(effective.providers.hormoz.models['reviewer-2'].modelID, 'google/gemini-example');
  assert.equal(effective.providers.hormoz.models.discovery.modelID, 'anthropic/claude-sonnet-5.5');
  assert.equal(config.providers.hormoz.models.coder.modelID, 'anthropic/claude-sonnet-5.5');
});
test('model IDs are validated and invalid roles cannot silently override another role', () => {
  assert.equal(validateUpstreamModel('anthropic/claude-sonnet-5.5'), 'anthropic/claude-sonnet-5.5');
  assert.throws(() => validateOverrides({'reviewer-3':'x/y'}), /Unknown agent/);
  assert.throws(() => buildRoleModelConfig(config,{coder:'invalid model id'}), /Invalid upstream/);
  assert.throws(() => buildRoleModelConfig(config,{coder:''}), /Invalid upstream/);
});
test('model reporting includes real upstream ID, not only the OpenCode role alias', () => {
  const effective = buildRoleModelConfig(config,{discovery:'anthropic/claude-example'});
  const rows = listRoleModels(effective);
  assert.equal(rows.length,6);
  assert.deepEqual(rows.find(row => row.role==='discovery'),{
    role:'discovery',opencodeModel:'hormoz/discovery',upstreamModel:'anthropic/claude-example'
  });
});
