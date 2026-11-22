import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import { normalizeOpenCodeEvent } from '../src/opencode-event-adapter.js';
import { appendTelemetry, readTelemetry, readBindings, updateBindings, validateBinding, eventsFile, bindingsFile } from '../src/telemetry-store.js';
import { dashboardReport } from '../src/live-telemetry.js';
import { createDashboardServer } from '../src/dashboard-server.js';

const sessionID='ses_example', assistantMessageID='msg_100';
const event = (type,data={}) => ({type,data:{sessionID,assistantMessageID,...data}});
const at = '2026-11-21T12:00:00.000Z';
const from = time => Date.parse('2026-11-21T12:00:'+time+'Z');
function sampled(){
  return [
    normalizeOpenCodeEvent(event('session.step.started',{started:Date.parse(at),agent:'coder',model:{providerID:'hormoz',id:'coder'}}),from('00.000')),
    normalizeOpenCodeEvent(event('session.step.first-token'),from('01.000')),
    normalizeOpenCodeEvent(event('session.step.streamed'),from('03.000')),
    normalizeOpenCodeEvent(event('session.step.ended',{tokens:{input:100,output:60,reasoning:20,cache:{read:40,write:10}},cost:0.01}),from('04.000'))
  ];
}
test('OpenCode v2 events preserve numeric billing and timing, never content',()=>{
  const row=normalizeOpenCodeEvent(event('session.step.ended',{
    tokens:{input:200,output:10,reasoning:5,cache:{read:25,write:8}},
    cost:0.02, text:'SECRET TRANSCRIPT',messages:[{content:'SECRET'}]
  }));
  assert.equal(row.inputTokens,200);
  assert.equal(row.cacheReadTokens,25);
  assert.equal(row.reasoningTokens,5);
  assert.ok(!JSON.stringify(row).includes('SECRET'));
  assert.equal(normalizeOpenCodeEvent(event('session.text.ended',{text:'SECRET'})),null);
});
test('real OpenCode step event aggregate: measured total, first token and generation speed',()=>{
  const r=dashboardReport(sampled(),{}, {coder:'anthropic/claude-sonnet-5.5'}, {groupBy:'model'});
  assert.equal(r.overview.tokens.total,230);
  assert.equal(r.overview.generationTokensPerSecond,40);
  assert.equal(r.overview.tokensPerActiveMinute,3450);
  assert.equal(r.overview.ttftMeanMs,1000);
  assert.equal(r.overview.requests,1);
  assert.equal(r.groups[0].name,'anthropic/claude-sonnet-5.5');
  assert.equal(r.overview.costUSD,0.01);
  assert.equal(r.sessions[0].issueKey,'UNATTRIBUTED');
});
test('duplicate terminal delivery never double counts',()=>{
  const list=sampled();
  const r=dashboardReport([...list,list.at(-1)]);
  assert.equal(r.overview.requests,1);
  assert.equal(r.overview.tokens.total,230);
});
test('session binding attributes historical data retroactively without adding fake task usage',()=>{
  const bound={ses_example:validateBinding('ses_example','IRIS-123','BUG_FIX','3','R2')};
  const r=dashboardReport(sampled(),bound,{}, {groupBy:'taskType',filters:{issue:'IRIS-123'}});
  assert.equal(r.groups[0].name,'BUG_FIX');
  assert.equal(r.overview.uniqueTasks,1);
  assert.equal(r.overview.averageTokensPerMeasuredTask,230);
  assert.equal(r.sessions[0].issueKey,'IRIS-123');
  assert.throws(()=>validateBinding('ses_example','IRIS-1','BUG_FIX','NaN'),/Story Points/);
});
test('missing provider usage must not be invented',()=>{
  const list=sampled();
  list.at(-1).cacheWriteTokens=null;
  const r=dashboardReport(list);
  assert.equal(r.overview.missingUsage,1);
  assert.equal(r.overview.tokens.total,null);
  assert.equal(r.overview.generationTokensPerSecond,null);
});
test('unknown time-to-first-token remains absent',()=>{
  const list=sampled().filter(e=>e.kind!=='first-token');
  const r=dashboardReport(list);
  assert.equal(r.overview.ttftMeanMs,null);
  assert.equal(r.overview.generationTokensPerSecond,null);
});
test('failures and in-flight steps are distinguished',()=>{
  const started=sampled()[0];
  const failed=normalizeOpenCodeEvent(event('session.step.failed',{}));
  const r=dashboardReport([started,failed]);
  assert.equal(r.overview.failed,1);
  assert.equal(r.overview.missingUsage,1);
});
test('telemetry persists as sanitized append-only NDJSON; bindings are local',()=>{
  const root=mkdtempSync(path.join(os.tmpdir(),'retina-telemetry-'));
  try{
    const file=eventsFile(root);
    for(const row of sampled()) appendTelemetry(file,row);
    assert.equal(readTelemetry(file).length,4);
    const bindings={ses_example:validateBinding('ses_example','IRIS-9','FEATURE',5,'R1')};
    updateBindings(bindingsFile(root),bindings);
    assert.deepEqual(readBindings(bindingsFile(root)),bindings);
    assert.ok(!readFileSync(file,'utf8').includes('Bearer'));
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('dashboard serves real aggregated data on loopback and rejects unsafe hosts/methods', async()=>{
  const root=mkdtempSync(path.join(os.tmpdir(),'retina-dashboard-'));
  const srv=createDashboardServer({projectRoot:root,port:0});
  try{
    for(const row of sampled()) appendTelemetry(eventsFile(root),row);
    updateBindings(bindingsFile(root),{ses_example:validateBinding('ses_example','IRIS-1','BUG_FIX',3)});
    await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+srv.address().port;
    const res=await fetch(base+'/api/report?groupBy=issue');
    assert.equal(res.status,200);
    const report=await res.json();
    assert.equal(report.groups[0].name,'IRIS-1');
    assert.equal(report.overview.tokens.total,230);
    assert.equal((await fetch(base+'/')).status,200);
    assert.equal((await fetch(base+'/dashboard.css')).status,200);
    assert.equal((await fetch(base+'/dashboard.js')).status,200);
    assert.equal((await fetch(base+'/api/report?groupBy=__proto__')).status,400);
    assert.equal((await fetch(base+'/api/report',{method:'POST'})).status,405);
    const hostileStatus=await new Promise((resolve,reject)=>{
      http.get(base+'/api/report',{headers:{host:'attacker.example'}},response=>{response.resume();resolve(response.statusCode);}).on('error',reject);
    });
    assert.equal(hostileStatus,403);
  }finally{
    await new Promise(resolve=>srv.close(resolve));
    rmSync(root,{recursive:true,force:true});
  }
});
test('OpenCode v2 plugin has valid JS syntax',()=>{
  const result=spawnSync(process.execPath,['--check',new URL('../.opencode/plugins/retina-telemetry/index.js',import.meta.url).pathname],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});
