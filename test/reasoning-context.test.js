import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateDecision, selectApprovedDecisions, readProjectFile,
  readDecisionLedger, buildRoleContext
} from '../src/reasoning-context.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const approved = (id, extra = {}) => ({
  id, status:'approved', scope:'checkout: retries',
  decision:'Retry only on retryable network errors',
  rationale:'Avoid duplicate charges',
  approval:{ by:'product owner', evidence:'https://example.org/reviews/123', date:'2026-11-25' },
  ...extra
});

test('only explicitly selected and traceable human-approved decisions enter role context', () => {
  const records = [
    approved('DEC-100'),
    {id:'DEC-200',status:'proposed',scope:'optional behavior',
      decision:'Try infinite retries',rationale:'experiment'},
    approved('DEC-300',{supersedes:['DEC-090']}),
    approved('DEC-090')
  ];
  assert.deepEqual(selectApprovedDecisions(records,['DEC-100']).map(x=>x.id),['DEC-100']);
  assert.throws(()=>selectApprovedDecisions(records,['DEC-200']),/not human-approved/);
  assert.throws(()=>selectApprovedDecisions(records,['DEC-090']),/superseded/);
  assert.throws(()=>selectApprovedDecisions(records,['MISSING']),/missing or not/);
  assert.throws(()=>selectApprovedDecisions(records,['DEC-100','DEC-100']),/Duplicate/);
  assert.throws(()=>validateDecision({...approved('DEC-100'),approval:{by:'agent',evidence:'',date:'2026-11-25'}}),/approval.evidence/);
  assert.throws(()=>validateDecision({...approved('DEC-100'),status:'approved',approval:null}),/human approval/);
});

test('review packets contain only artifact, chosen approvals, explicit refs and an unverified-isolation warning', () => {
  const choices=selectApprovedDecisions([approved('DEC-100')],['DEC-100']);
  const artifact={path:'docs/designs/checkout.md',content:'# Checkout\nRetries are capped at 3.'};
  const references=[{path:'src/checkout.js',content:'export const retryMax = 3;'}];
  const review=buildRoleContext({role:'reviewer-1',artifact,references,decisions:choices});
  assert.equal(review.contextMode,'cold-review');
  assert.equal(review.reviewIsolation.verified,false);
  assert.equal(review.approvedDecisions.length,1);
  assert.equal(review.referenceFiles.length,1);
  assert.equal(review.referenceFiles[0].content,undefined);
  assert.equal(review.artifact.sha256.length,64);
  assert.match(review.instructions.join(' '),/author conversations/);
  assert.ok(!JSON.stringify(review).includes('a private rationale from a chat'));
  const author=buildRoleContext({role:'discovery',artifact,decisions:choices});
  assert.equal(author.contextMode,'focused-authoring');
  assert.equal(author.reviewIsolation,null);
  assert.throws(()=>buildRoleContext({role:'reviewer-1',artifact,
    decisions:[{id:'DEC-200',status:'proposed'}]}),/explicitly approved/);
  assert.throws(()=>buildRoleContext({role:'reviewer-1',artifact,references:[artifact]}),/Duplicate/);
});

test('project memory is product-local, filename-checked and symlinks cannot escape workspace', () => {
  const workspace=mkdtempSync(path.join(tmpdir(),'retina-product-context-'));
  const outside=mkdtempSync(path.join(tmpdir(),'retina-external-secret-'));
  try {
    const decisionDir=path.join(workspace,'docs','retina','decisions');
    mkdirSync(decisionDir,{recursive:true});
    writeFileSync(path.join(decisionDir,'DEC-100.json'),JSON.stringify(approved('DEC-100')));
    mkdirSync(path.join(workspace,'docs','designs'));
    writeFileSync(path.join(workspace,'docs','designs','spec.md'),'# Checkout\n');
    writeFileSync(path.join(outside,'private.md'),'secret');
    symlinkSync(path.join(outside,'private.md'),path.join(workspace,'leak.md'));
    assert.equal(readDecisionLedger(workspace).length,1);
    assert.equal(readProjectFile(workspace,'docs/designs/spec.md').content,'# Checkout\n');
    assert.throws(()=>readProjectFile(workspace,'../bad.md'));
    assert.throws(()=>readProjectFile(workspace,'leak.md'),/escapes/);
    writeFileSync(path.join(decisionDir,'wrong.json'),JSON.stringify(approved('DEC-200')));
    assert.throws(()=>readDecisionLedger(workspace),/filename must match/);
  } finally {
    rmSync(workspace,{recursive:true,force:true});
    rmSync(outside,{recursive:true,force:true});
  }
});

test('CLI creates local non-overwriting cold-review packet without launching Paperclip', () => {
  const workspace=mkdtempSync(path.join(tmpdir(),'retina-context-cli-'));
  try {
    mkdirSync(path.join(workspace,'docs','retina','decisions'),{recursive:true});
    mkdirSync(path.join(workspace,'docs','designs'),{recursive:true});
    writeFileSync(path.join(workspace,'docs','retina','decisions','DEC-100.json'),
      JSON.stringify(approved('DEC-100')));
    writeFileSync(path.join(workspace,'docs','designs','feature.md'),
      '# Feature\nBehavior is defined and testable.');
    const argv=[path.join(root,'scripts','context.mjs'),'pack',
      '--workspace',workspace,'--role','reviewer-2','--artifact','docs/designs/feature.md',
      '--decision','DEC-100'];
    const result=spawnSync(process.execPath,argv,{cwd:root,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    assert.match(result.stdout,/is NOT verified/);
    const file=result.stdout.match(/Created focused context packet: (.+)\n/)[1];
    const packet=JSON.parse(readFileSync(file,'utf8'));
    assert.equal(packet.contextMode,'cold-review');
    assert.equal(packet.approvedDecisions[0].id,'DEC-100');
    assert.equal(packet.reviewIsolation.verified,false);
    const repeated=spawnSync(process.execPath,argv,{cwd:root,encoding:'utf8'});
    assert.notEqual(repeated.status,0);
    assert.match(repeated.stderr,/EEXIST/);
  } finally {
    rmSync(workspace,{recursive:true,force:true});
  }
});

test('all six Paperclip role prompts encode relevant memory and unbiased review behavior', () => {
  const roles=['discovery','project-manager','orchestrator','coder','reviewer-1','reviewer-2'];
  for(const role of roles){
    const text=readFileSync(path.join(root,'paperclip','agents',role,'AGENTS.md'),'utf8');
    assert.match(text,/Retina reasoning discipline/);
    assert.match(text,/human-approved decisions/);
    assert.match(text,/context isolation/);
    assert.match(text,/Paperclip/);
  }
  for(const role of ['reviewer-1','reviewer-2']){
    const text=readFileSync(path.join(root,'paperclip','agents',role,'AGENTS.md'),'utf8');
    assert.match(text,/design/i);
    assert.match(text,/code/i);
  }
});
