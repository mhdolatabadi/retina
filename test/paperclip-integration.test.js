import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { RETINA_ROLES } from '../src/role-models.js';
import { buildPaperclipProvider, buildPaperclipPlans, preparePaperclipInstructions } from '../src/paperclip-plans.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=JSON.parse(readFileSync(path.join(root,'opencode.json'),'utf8'));

test('custom Paperclip gateway preserves role-specific Hormouz modelID and never embeds API key',()=>{
  const provider=buildPaperclipProvider(base,{coder:'example/economical-model'});
  assert.equal(provider.hormoz.npm,'@ai-sdk/openai-compatible');
  assert.equal(provider.hormoz.options.baseURL,'https://api.hormouz.net/v1');
  assert.equal(provider.hormoz.options.apiKey,'{env:HORMOZ_API_KEY}');
  assert.equal(provider.hormoz.models.coder.modelID,'example/economical-model');
  assert.equal(provider.hormoz.models['reviewer-1'].modelID,base.providers.hormoz.models['reviewer-1'].modelID);
  assert.ok(!JSON.stringify(provider).includes('ng-actual'));
});

test('default Paperclip runtime runs six roles under existing CEO using Codex subscription',()=>{
  const plans=buildPaperclipPlans({base,root,ceoId:'ceo-123'});
  assert.equal(plans.length,RETINA_ROLES.length);
  assert.equal(new Set(plans.map(x=>x.payload.name)).size,6);
  for(const item of plans) {
    const p=item.payload;
    assert.equal(p.reportsTo,'ceo-123');
    assert.equal(p.adapterType,'codex_local');
    assert.equal(p.adapterConfig.model,'gpt-6.1-sol');
    assert.equal(p.adapterConfig.engine,'acp');
    assert.equal(p.adapterConfig.dangerouslyBypassApprovalsAndSandbox,false);
    assert.equal(p.adapterConfig.env,undefined);
    assert.ok(!JSON.stringify(p).includes('OPENAI_API_KEY'));
    assert.ok(p.adapterConfig.instructionsFilePath.endsWith('/'+item.role+'.md'));
    assert.equal(p.runtimeConfig.heartbeat.enabled,false);
    assert.equal(p.permissions.canCreateAgents,false);
  }
});

test('explicit Hormouz fallback retains independent role model mappings',()=>{
  const plans=buildPaperclipPlans({base,root,ceoId:'ceo-123',runtime:'hormouz',
    overrides:{coder:'example/economical-model'}});
  for(const item of plans){
    const p=item.payload;
    assert.equal(p.adapterType,'opencode_local');
    assert.equal(p.adapterConfig.model,'hormoz/'+item.role);
    assert.equal(p.adapterConfig.env.OPENCODE_ALLOW_ALL_MODELS,'true');
  }
  const coder=plans.find(x=>x.role==='coder');
  const config=JSON.parse(coder.payload.adapterConfig.env.PAPERCLIP_OPENCODE_PROVIDERS);
  assert.equal(config.hormoz.models.coder.modelID,'example/economical-model');
});

test('Codex model override is accepted and invalid runtime rejected',()=>{
  const plans=buildPaperclipPlans({base,root,ceoId:'ceo-123',codexModel:'gpt-6-sol'});
  assert.ok(plans.every(x=>x.payload.adapterConfig.model==='gpt-6-sol'));
  assert.throws(()=>buildPaperclipPlans({base,root,ceoId:'ceo-123',runtime:'bogus'}),/Runtime must/);
  assert.throws(()=>buildPaperclipPlans({base,root,ceoId:'ceo-123',codexModel:'a bad model'}),/Invalid upstream model ID/);
});

test('role instruction files reuse existing Retina policy without OpenCode frontmatter',()=>{
  const role=readFileSync(path.join(root,'.opencode','agents','coder.md'),'utf8');
  const rules=readFileSync(path.join(root,'AGENTS.md'),'utf8');
  const source=preparePaperclipInstructions(role,'coder',rules);
  assert.match(source,/Paperclip task, workspace and reporting hierarchy/);
  assert.match(source,/regression tests for fixed defects/i);
  assert.match(source,/Implement exactly the approved task/i);
  assert.doesNotMatch(source,/^---/);
  const d=preparePaperclipInstructions(
    readFileSync(path.join(root,'.opencode','agents','discovery.md'),'utf8'),
    'discovery', 'TEST_SECRET_NEVER_EMBED');
  assert.ok(!d.includes('TEST_SECRET_NEVER_EMBED'));
});

test('Paperclip bootstrap defaults to read-only dry run',()=>{
  const r=spawnSync(process.execPath,[path.join(root,'scripts','paperclip-setup.mjs')],{
    encoding:'utf8',env:{...process.env,PATH:''}
  });
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/DRY RUN ONLY/);
  assert.match(r.stdout,/Retina Discovery/);
  assert.match(r.stdout,/ChatGPT subscription/);
  assert.doesNotMatch(r.stdout,/Hormouz key required/);
});

test('cannot create Paperclip agents without explicit company and existing CEO identifiers',()=>{
  const r=spawnSync(process.execPath,[path.join(root,'scripts','paperclip-setup.mjs'),'--apply'],{
    encoding:'utf8',env:{...process.env,PATH:''}
  });
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/needs --company-id and --ceo-id/);
});
