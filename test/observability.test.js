import test from 'node:test';
import assert from 'node:assert/strict';
import { usageMetrics, usageReport, taskTypeReport } from '../src/observability.js';

const entries = [
  { issueKey:'J-1', taskType:'Bug', stage:'CODING', agentId:'coder', model:'gpt',
    inputTokens:1200, outputTokens:300, cachedTokens:200, reasoningTokens:100,
    startedAt:'2026-11-21T10:00:00Z', durationMs:30000, storyPoints:2 },
  { issueKey:'J-1', taskType:'Bug', stage:'REVIEW', agentId:'reviewer',
    model:'claude', inputTokens:400, outputTokens:100,
    startedAt:'2026-11-21T10:02:00Z', durationMs:20000, storyPoints:2 },
  { issueKey:'J-2', taskType:'Feature', stage:'CODING', agentId:'coder',
    model:'claude', inputTokens:4000, outputTokens:2000,
    startedAt:'2026-11-21T10:00:00Z', durationMs:100000, generationDurationMs:50000, storyPoints:5 }
];

test('report tokens and rates for an individual Jira issue', () => {
  const report = usageReport(entries, { groupBy:'issue', filters:{issue:'J-1'} });
  assert.equal(report.overall.tokenCounts.total, 2000);
  assert.equal(report.overall.tokenCounts.cached, 200);
  assert.equal(report.overall.tokenCounts.reasoning, 100);
  assert.equal(report.overall.rates.totalTokensPerActiveMinute, 2400);
  assert.equal(report.overall.rates.outputTokensPerActiveSecond, 8);
  assert.equal(report.overall.rates.totalTokensPerWallMinute, 857.14);
});

test('aggregate task types and human-approved story points', () => {
  const report = taskTypeReport(entries, [
    {issueKey:'J-1',taskType:'Bug',storyPoints:2,state:'DONE'},
    {issueKey:'J-2',taskType:'Feature',storyPoints:5,state:'DONE'}
  ]);
  assert.equal(report.tasks.find(t=>t.issueKey==='J-1').tokensPerStoryPoint,1000);
  assert.equal(report.byTaskType.find(t=>t.taskType==='Bug').averageTokensPerMeasuredTask,2000);
  assert.equal(report.byTaskType.find(t=>t.taskType==='Feature').averageTokensPerStoryPoint,1200);
  assert.equal(report.byTaskType.find(t=>t.taskType==='Bug').rates.totalTokensPerActiveMinute,2400);
});

test('do not double count cached or reasoning tokens', () => {
  const metrics = usageMetrics([entries[0]]);
  assert.equal(metrics.tokenCounts.total,1500);
});

test('do not report generation speed or first token latency without measured timing', () => {
  assert.equal(usageMetrics([entries[0]]).rates.outputTokensPerGenerationSecond,null);
  assert.equal(usageMetrics([entries[0]]).timing.timeToFirstTokenMsMean,null);
  assert.equal(usageMetrics([entries[2]]).rates.outputTokensPerGenerationSecond,40);
});

test('keep partial usage incomplete rather than misreporting zeros', () => {
  const metrics = usageMetrics([{...entries[0],inputTokens:null}, entries[1]]);
  assert.equal(metrics.completeness.missingTokenMeasurements,1);
  assert.equal(metrics.tokenCounts.total,null);
  assert.equal(metrics.rates.totalTokensPerActiveMinute,null);
});

test('provide independent groupings by model and stage', () => {
  const result = usageReport(entries,{groupBy:'stage',filters:{model:'claude'}});
  assert.deepEqual(result.groups.map(g=>g.value),['CODING','REVIEW']);
  assert.equal(result.overall.tokenCounts.total,6500);
  assert.throws(()=>usageReport(entries,{groupBy:'__proto__'}),/Unsupported/);
});

test('distinguish concurrency wall throughput from sum of active time', () => {
  const two = [{...entries[0],durationMs:1000,inputTokens:30,outputTokens:30},
    {...entries[1],startedAt:entries[0].startedAt,durationMs:1000,inputTokens:30,outputTokens:30}];
  assert.equal(usageMetrics(two).rates.totalTokensPerActiveMinute,3600);
  assert.equal(usageMetrics(two).rates.totalTokensPerWallMinute,7200);
});
