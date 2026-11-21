#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { usageReport, taskTypeReport } from './observability.js';

const argv = process.argv.slice(2);
const arg = name => { const index = argv.indexOf('--' + name); return index < 0 ? null : argv[index + 1]; };

async function main() {
  if (argv.includes('--help')) {
    process.stdout.write('Usage: node src/report.js --state PATH [--group-by issue|taskType|stage|model|agent|orchestrator] [--issue KEY] [--task-type TYPE] [--stage NAME] [--report tasks]\n');
    return;
  }
  const filename = arg('state');
  if (!filename || filename.startsWith('--')) throw new Error('--state PATH is required');
  const state = JSON.parse(await readFile(filename, 'utf8'));
  if (!Array.isArray(state.usage)) throw new Error('State must contain a usage array');
  const filters = {};
  for (const [flag, dimension] of [
    ['issue', 'issue'], ['task-type', 'taskType'], ['stage', 'stage'],
    ['model', 'model'], ['agent', 'agent'], ['orchestrator', 'orchestrator']
  ]) {
    const value = arg(flag);
    if (value !== null) filters[dimension] = value;
  }
  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const usage = state.usage.map(item => {
    const task = tasks.find(t => t.issueKey === item.issueKey);
    return {
      ...item, taskType: item.taskType ?? task?.taskType ?? null,
      storyPoints: item.storyPoints ?? task?.storyPoints ?? null,
      risk: item.risk ?? task?.risk ?? null
    };
  });
  const matches = (row, dimension, value) => String(row[{
    issue: 'issueKey', taskType: 'taskType', stage: 'stage', model: 'model',
    agent: 'agentId', orchestrator: 'orchestratorId'
  }[dimension]] ?? 'UNKNOWN') === value;
  const selected = usage.filter(row => Object.entries(filters).every(([key, value]) => matches(row, key, value)));
  const report = arg('report') === 'tasks'
    ? taskTypeReport(selected, tasks)
    : usageReport(selected, { groupBy: arg('group-by') ?? 'taskType' });
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

main().catch(error => { process.stderr.write('Retina telemetry: ' + error.message + '\n'); process.exitCode = 1; });
