import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync,readFileSync, mkdtempSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RETINA_ROLES } from '../src/role-models.js';
import { PAPERCLIP_AGENT_NAMES } from '../src/paperclip-plans.js';
import { roleDirectory, instructionPath, selectPaperclipAgents, unpackConfiguration,
  snapshotAgent, validateSnapshot, makeConfigPatch, isExternalBundle } from '../src/paperclip-git-sync.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const revision='a'.repeat(64);
function fakeAgent(role) {
  return {id:'agent-'+role,name:PAPERCLIP_AGENT_NAMES[role],title:'Role '+role,
    capabilities:'Do this task',adapterType:'codex_local',
    adapterConfig:{model:'gpt-6.1-sol',env:{OPENAI_API_KEY:'SECRET_NOT_TO_TRACK'}},
    runtimeConfig:{heartbeat:{enabled:false}},budgetMonthlyCents:12345};
}
test('all six Retina role instruction files are Git-tracked paths',()=>{
  for(const role of RETINA_ROLES){
    const filename=instructionPath(root,role);
    assert.ok(existsSync(filename),filename);
    assert.match(readFileSync(filename,'utf8'),/Paperclip owns all scheduling/);
    assert.match(filename,/paperclip\/agents\/.*\/AGENTS.md$/);
  }
});
test('safe Paperclip snapshots never expose credentials, machine paths or Paperclip IDs',()=>{
  const actual=snapshotAgent('coder',fakeAgent('coder'));
  assert.deepEqual(actual,{
    schemaVersion:1,retinaRole:'coder',name:'Retina Coder',title:'Role coder',
    capabilities:'Do this task',adapterType:'codex_local',model:'gpt-6.1-sol',
    heartbeatEnabled:false,budgetMonthlyCents:12345
  });
  assert.ok(!JSON.stringify(actual).includes('SECRET_NOT_TO_TRACK'));
  assert.ok(!JSON.stringify(actual).includes('agent-coder'));
  assert.throws(()=>validateSnapshot({...actual,secret:'abcd'}),/Unsupported or missing/);
  assert.throws(()=>validateSnapshot({...actual,capabilities:'sk-proj-abcdefghijklmnopqrstuvwxyz123456'}),/Potential credential/);
});
test('agent lookup uses durable local ID mapping across user renames',()=>{
  const rows=RETINA_ROLES.map(fakeAgent);
  rows[0].name='Custom Discovery';
  assert.throws(()=>selectPaperclipAgents({agents:rows}),/expected exactly one/);
  const found=selectPaperclipAgents({agents:rows},{discovery:'agent-discovery'});
  assert.equal(found.discovery.name,'Custom Discovery');
  assert.equal(found.coder.id,'agent-coder');
  assert.throws(()=>selectPaperclipAgents({agents:[...rows,rows[1]]},{discovery:'agent-discovery'}),/expected exactly one/);
});
test('guarded updates patch only safe fields and reject unrecognized harness migrations',()=>{
  const live=fakeAgent('coder');
  const desired={...snapshotAgent('coder',live),model:'gpt-6-sol',title:'Changed',
    heartbeatEnabled:true};
  assert.deepEqual(makeConfigPatch(live,desired,revision),{
    expectedConfigurationRevision:revision,title:'Changed',
    adapterConfig:{model:'gpt-6-sol'},runtimeConfig:{heartbeat:{enabled:true}}
  });
  assert.equal(makeConfigPatch(live,snapshotAgent('coder',live),revision),null);
  assert.throws(()=>makeConfigPatch(live,desired,null),/configurationRevision/);
  assert.throws(()=>makeConfigPatch(live,{...desired,adapterType:'opencode_local'},revision),/Harness changed/);
});
test('managed/external bundle detection is exact-path and fail-closed',()=>{
  assert.equal(isExternalBundle({bundle:{mode:'managed'}},roleDirectory(root,'coder')),false);
  assert.equal(isExternalBundle({bundle:{mode:'external',rootPath:roleDirectory(root,'coder')}},roleDirectory(root,'coder')),true);
  assert.throws(()=>isExternalBundle({bundle:{mode:'external',rootPath:'/wrong/other'}},roleDirectory(root,'coder')),/different external/);
});
test('Paperclip config revision and expected JSON shape are explicit',()=>{
  assert.equal(unpackConfiguration({configurationRevision:revision,agent:fakeAgent('coder')}).revision,revision);
  assert.throws(()=>unpackConfiguration({unexpected:'shape'}),/no agent adapterType/);
});

test('read-only status works against a mocked authenticated Paperclip CLI',()=>{
  const folder=mkdtempSync(path.join(tmpdir(),'retina-paperclip-test-'));
  const executable=path.join(folder,'paperclipai');
  const mock=[
    '#!/usr/bin/env node',
    'const path=require("node:path");',
    'const roles='+JSON.stringify(RETINA_ROLES)+';',
    'const names='+JSON.stringify(PAPERCLIP_AGENT_NAMES)+';',
    'const root='+JSON.stringify(root)+';',
    'const args=process.argv.slice(2);',
    'const out=obj=>process.stdout.write(JSON.stringify(obj));',
    'if(args[0]!=="agent")process.exit(12);',
    'if(args[1]==="list")out({agents:roles.map(r=>({id:"agent-"+r,name:names[r]}))});',
    'else if(args[1]==="configuration"){',
    '  const role=args[2].slice(6);',
    '  out({configurationRevision:"'+revision+'",agent:{name:names[role],title:"Member",',
    '    capabilities:"Perform work",adapterType:"codex_local",adapterConfig:{model:"gpt-6.1-sol"},',
    '    runtimeConfig:{heartbeat:{enabled:false}},budgetMonthlyCents:0}});',
    '}else if(args[1]==="instructions-bundle"){',
    '  const role=args[2].slice(6);',
    '  out({mode:"external",rootPath:path.join(root,"paperclip","agents",role)});',
    '}else process.exit(22);'
  ].join('\n')+'\n';
  try{
    writeFileSync(executable,mock,{mode:0o700});chmodSync(executable,0o700);
    const p=spawnSync(process.execPath,[path.join(root,'scripts','paperclip-sync.mjs'),
      'status','--company-id','mock-company'],{
        cwd:root,encoding:'utf8',env:{...process.env,RETINA_PAPERCLIP_CLI:executable}
      });
    assert.equal(p.status,0,p.stderr);
    assert.match(p.stdout,/coder: codex_local\/gpt-6.1-sol \[linked Git instructions\]/);
    assert.match(p.stdout,/No changes made/);
  }finally{rmSync(folder,{recursive:true,force:true});}
});
