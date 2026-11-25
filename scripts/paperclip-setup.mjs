#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRoleModelOverrides } from '../src/role-models.js';
import { buildPaperclipPlans, preparePaperclipInstructions } from '../src/paperclip-plans.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const get = name => {
  const idx = args.indexOf('--' + name);
  return idx < 0 ? null : args[idx + 1];
};
const apply = args.includes('--apply');
const company = get('company-id');
const ceo = get('ceo-id');
const runtime = get('runtime') || 'codex';
const codexModel = get('codex-model') || 'gpt-6.1-sol';

function runCommand(argv, {json = false} = {}) {
  const result = spawnSync('paperclipai', argv, {encoding: 'utf8', shell: false, maxBuffer: 4 * 1024 * 1024});
  if (result.error) throw new Error('Could not execute paperclipai CLI: ' + result.error.message);
  if (result.status !== 0) throw new Error('paperclipai ' + argv[0] + ' failed: ' + (result.stderr || result.stdout).slice(0,1500));
  if (json) {
    try { return JSON.parse(result.stdout); }
    catch { throw new Error('Could not parse paperclipai agent list JSON; no agents created'); }
  }
  return result.stdout;
}
function agentList(json) {
  const candidates = [
    json, json?.agents, json?.result, json?.result?.agents,
    json?.data, json?.data?.agents
  ];
  const rows = candidates.find(Array.isArray);
  if (!rows || !rows.every(a => typeof a?.name === 'string')) {
    throw new Error('Unsupported paperclipai agent list JSON shape; no agents created');
  }
  return rows;
}
function main() {
  if (args.includes('--help')) {
    console.log('Usage: node scripts/paperclip-setup.mjs [--runtime codex|hormouz] [--codex-model MODEL] --company-id ID --ceo-id EXISTING_CEO_ID [--apply]');
    console.log('Default: Codex with ChatGPT subscription; authenticate in Paperclip Connectors > OpenAI.');
    console.log('Default is dry-run. --apply creates six new agents via the authenticated Paperclip CLI.');
    return;
  }
  if (apply && (!company || !ceo)) throw new Error('--apply needs --company-id and --ceo-id');
  const base=JSON.parse(readFileSync(path.join(root,'opencode.json'),'utf8'));
  const overrides=runtime === 'hormouz'
    ? readRoleModelOverrides(path.join(root,'.retina','role-models.json')) : {};
  const plans=buildPaperclipPlans({base,overrides,root,ceoId:ceo || 'EXISTING-CEO-ID',runtime,codexModel});
  console.log('Selected runtime: ' + runtime + (runtime === 'codex' ? ' (ChatGPT subscription; no OpenAI API key)' : ' (Hormouz key required)'));
  for(const row of plans) console.log(row.payload.name + ' -> ' + row.payload.adapterConfig.model + ' (' + row.upstreamModel + ')');
  if (!apply) {
    console.log('\nDRY RUN ONLY: no Paperclip agents or files were created.');
    console.log('Pass --company-id and --ceo-id, then --apply to create agents under your existing CEO.');
    if (runtime === 'codex') console.log('Sign in first at Paperclip > Connectors > OpenAI > Subscription.');
    return;
  }
  // Fail before writing even one agent if the CLI fails or a matching name exists.
  const existing=agentList(runCommand(['agent','list','--company-id',company,'--json'],{json:true}));
  for(const agent of plans) if(existing.some(row=>row.name.toLowerCase()===agent.payload.name.toLowerCase())) {
    throw new Error(agent.payload.name + ' already exists; refusing duplicate creation. Reconfigure it in Paperclip instead.');
  }
  const ceoRecord=existing.find(row=>row.id===ceo);
  if (!ceoRecord) throw new Error('CEO ID not found in this company; no agents created');
  if (ceoRecord.role !== 'ceo') throw new Error('Given --ceo-id does not refer to a CEO agent');
  const directory=path.join(root,'.retina','paperclip','instructions');
  mkdirSync(directory,{recursive:true,mode:0o700});
  const engineeringRules=readFileSync(path.join(root,'AGENTS.md'),'utf8');
  for(const plan of plans) {
    const source=readFileSync(path.join(root,'.opencode','agents',plan.role+'.md'),'utf8');
    writeFileSync(path.join(directory,plan.role+'.md'),
      preparePaperclipInstructions(source,plan.role,engineeringRules),{mode:0o600});
  }
  for(const plan of plans) {
    console.log('Creating ' + plan.payload.name + '...');
    runCommand([
      'agent','create','--company-id',company,'--runner','legacy',
      '--payload-json',JSON.stringify(plan.payload)
    ]);
  }
  console.log('Created six agents with scheduled heartbeats disabled in requested config. Verify adapter and subscription connection in Paperclip.');
  console.log('Assign a small test task before enabling scheduled heartbeats.');
}
try {main();}
catch(error){console.error('Retina Paperclip setup:',error.message);process.exitCode=1;}
