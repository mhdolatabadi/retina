import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createRetinaEventGate,registerRetinaRun,activeRetinaRuns,onlyRetinaEvents} from '../src/retina-scope.js';
import {readHormouzPrices,calculateHormouzTariff,validateHormouzPrices} from '../src/hormouz-pricing.js';
import {prometheusText} from '../src/prometheus-export.js';
import {createPrometheusServer} from '../src/prometheus-server.js';
import {appendTelemetry,eventsFile} from '../src/telemetry-store.js';
const tmp=()=>mkdtempSync(path.join(os.tmpdir(),'retina-scope-'));
const tokens={inputTokens:100,outputTokens:40,reasoningTokens:10,cacheReadTokens:0,cacheWriteTokens:0};
function started(workspace,agent='coder',providerID='hormoz'){
  return {type:'session.step.started',location:{directory:workspace},
    data:{sessionID:'ses1',assistantMessageID:'msg1',agent,model:{providerID,id:'coder'}}};
}
test('no run marker means no telemetry; unrelated workspaces, agents and providers are rejected',()=>{
  const root=tmp();
  try{
    const workspace='/home/retina/work';
    const id=registerRetinaRun(root,workspace);
    const gate=createRetinaEventGate({runId:id,workspace,registeredRuns:activeRetinaRuns(root)});
    assert.equal(createRetinaEventGate({runId:undefined,workspace,registeredRuns:activeRetinaRuns(root)}).admit(started(workspace)),false);
    assert.equal(gate.admit(started('/home/work/corporate')),false);
    assert.equal(gate.admit(started(workspace,'build')),false);
    assert.equal(gate.admit(started(workspace,'coder','corporate-internal')),false);
    assert.equal(gate.admit({...started(workspace),location:undefined}),false);
    assert.equal(gate.admit(started(workspace)),true);
    assert.equal(gate.admit({type:'session.step.ended',location:{directory:workspace},data:{sessionID:'ses1',assistantMessageID:'msg1'}}),true);
    assert.equal(gate.admit({type:'session.step.ended',location:{directory:workspace},data:{sessionID:'foreign',assistantMessageID:'other'}}),false);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('legacy rows and unrelated OpenCode run IDs are excluded from reports',()=>{
  const root=tmp();
  try{
    const id=registerRetinaRun(root,'/home/retina');
    const rows=[{kind:'ended',inputTokens:999},{retinaRunId:'foreign',inputTokens:999},{retinaRunId:id,inputTokens:50}];
    assert.deepEqual(onlyRetinaEvents(rows,activeRetinaRuns(root)).map(x=>x.inputTokens),[50]);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('published discounted Hormouz tariff is used, never OpenCode guess',()=>{
  const pricing=readHormouzPrices(new URL('..',import.meta.url).pathname);
  assert.equal(pricing.models['anthropic/claude-sonnet-5.5'].input,1.2);
  assert.equal(pricing.models['anthropic/claude-sonnet-5.5'].output,6);
  const row={upstreamModel:'anthropic/claude-sonnet-5.5',inputTokens:1000000,outputTokens:500000,reasoningTokens:100000,cacheReadTokens:0,cacheWriteTokens:0,cost:99};
  assert.equal(calculateHormouzTariff(row,pricing).usd,4.8);
  assert.equal(calculateHormouzTariff({...row,cacheReadTokens:1},pricing).reason,'CACHE_RATE_UNAVAILABLE');
  assert.equal(calculateHormouzTariff({...row,outputTokens:null},pricing).reason,'MISSING_USAGE');
  assert.equal(calculateHormouzTariff({...row,upstreamModel:'corporate/private'},pricing).reason,'UNKNOWN_MODEL');
  assert.throws(()=>validateHormouzPrices({unit:'USD_PER_MILLION_TOKENS',models:{'x/y':{input:1,output:1,source:'https://not-hormouz.test'}}}),/Invalid/);
});
test('Prometheus exposes per-role token and tariff counters without duplicate completion',()=>{
  const prices=readHormouzPrices(new URL('..',import.meta.url).pathname);
  const base={retinaRunId:'test-run',sessionID:'ses1',messageID:'m1'};
  const rows=[
    {...base,kind:'started',agentId:'coder',provider:'hormoz',model:'coder',startedAt:'2026-11-22T12:00:00.000Z'},
    {...base,kind:'ended',...tokens,observedAt:'2026-11-22T12:00:03.000Z'}
  ];
  const result=prometheusText([...rows,rows[1]],{ses1:{issueKey:'IRIS-44',taskType:'BUG_FIX'}},{coder:'anthropic/claude-sonnet-5.5'},prices);
  assert.match(result,/retina_tokens_total\{role="coder",model="anthropic\/claude-sonnet-5.5",task_type="BUG_FIX",issue="IRIS-44",kind="output"\} 40/);
  assert.match(result,/retina_model_requests_total\{role="coder".*status="SUCCESS"\} 1/);
  assert.match(result,/retina_hormouz_tariff_usd_total\{role="coder".*\} 0.00042/);
});
test('Prometheus HTTP exporter excludes existing foreign OpenCode events',async()=>{
  const root=tmp();
  const config=readFileSync(new URL('../opencode.json',import.meta.url),'utf8');
  const prices=readFileSync(new URL('../pricing/hormouz.json',import.meta.url),'utf8');
  mkdirSync(path.join(root,'pricing'),{recursive:true});
  writeFileSync(path.join(root,'opencode.json'),config);
  writeFileSync(path.join(root,'pricing','hormouz.json'),prices);
  const id=registerRetinaRun(root,root);
  for(const row of [
    {sessionID:'corporate',messageID:'x',kind:'started',agentId:'build'},
    {sessionID:'corporate',messageID:'x',kind:'ended',...tokens},
    {retinaRunId:id,sessionID:'ses1',messageID:'m1',kind:'started',agentId:'coder',provider:'hormoz',model:'coder'},
    {retinaRunId:id,sessionID:'ses1',messageID:'m1',kind:'ended',...tokens}
  ]) appendTelemetry(eventsFile(root),row);
  const srv=createPrometheusServer({projectRoot:root});
  try{
    srv.listen(0,'127.0.0.1');await once(srv,'listening');
    const response=await fetch('http://127.0.0.1:'+srv.address().port+'/metrics');
    assert.equal(response.status,200);
    const body=await response.text();
    assert.match(body,/retina_model_requests_total\{role="coder".*\} 1/);
    assert.doesNotMatch(body,/corporate|role="build"/);
  } finally {
    await new Promise(resolve=>srv.close(resolve));
    rmSync(root,{recursive:true,force:true});
  }
});
test('Grafana dashboards contain role token and cost comparisons',()=>{
  const json=JSON.parse(readFileSync(new URL('../ops/grafana/provisioning/dashboards/retina.json',import.meta.url),'utf8'));
  assert.equal(json.uid,'retina-usage');
  assert.ok(json.panels.some(x=>x.targets[0].expr.includes('sum by (role) (retina_tokens_total)')));
  assert.ok(json.panels.some(x=>x.targets[0].expr.includes('sum by (role) (retina_hormouz_tariff_usd_total)')));
});
