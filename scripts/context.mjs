#!/usr/bin/env node
import { mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  readProjectFile, readDecisionLedger, selectApprovedDecisions, buildRoleContext
} from '../src/reasoning-context.js';

const args = process.argv.slice(2);
const command = args[0] || 'help';
const option = name => {
  const index = args.indexOf('--' + name);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error('--' + name + ' requires a value');
  return value;
};
const values = name => {
  const result = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--' + name) {
      if (!args[index + 1] || args[index + 1].startsWith('--')) {
        throw new Error('--' + name + ' requires a value');
      }
      result.push(args[index + 1]);
      index++;
    }
  }
  return result;
};

function main() {
  if (command === 'help' || args.includes('--help')) {
    console.log('Retina: focused project memory and reviewer handoff');
    console.log('  npm run context -- decisions --workspace /absolute/product/path');
    console.log('  npm run context -- pack --workspace /absolute/product/path --role reviewer-1');
    console.log('     --artifact docs/designs/feature.md [--decision DEC-101] [--reference src/module.js]');
    console.log('Packets are local-only; send a reviewer packet to a separate Paperclip reviewer run.');
    return;
  }
  if (!['decisions', 'pack'].includes(command)) throw new Error('Unknown command: ' + command);
  const inputWorkspace = option('workspace');
  if (!inputWorkspace || !path.isAbsolute(inputWorkspace)) {
    throw new Error('--workspace must be the absolute path of the target product checkout');
  }
  const workspace = realpathSync(inputWorkspace);
  const ledger = readDecisionLedger(workspace);
  if (command === 'decisions') {
    for (const item of ledger) {
      console.log(item.id + ' [' + item.status + '] ' + item.scope);
    }
    if (!ledger.length) console.log('No project decisions in docs/retina/decisions/');
    return;
  }
  const role = option('role');
  const artifactPath = option('artifact');
  if (!role || !artifactPath) throw new Error('pack requires --role and --artifact');
  const decisions = selectApprovedDecisions(ledger, values('decision'));
  const artifact = readProjectFile(workspace, artifactPath);
  const refs = values('reference').map(filename => readProjectFile(workspace, filename));
  const packet = buildRoleContext({role, artifact, references: refs, decisions});
  const slug = path.basename(artifact.path).replace(/[^A-Za-z0-9._-]/g, '_');
  const digest = createHash('sha256').update(
    JSON.stringify({role,artifact:packet.artifact.sha256,decisions:decisions.map(item=>item.id)})
  ).digest('hex').slice(0,12);
  const outputDirectory = path.join(workspace, '.retina', 'handoffs');
  mkdirSync(outputDirectory, {recursive:true, mode:0o700});
  // Never silently overwrite a previous handoff; approval/review evidence is auditable.
  const file = path.join(outputDirectory, role + '-' + slug + '-' + digest + '.json');
  writeFileSync(file, JSON.stringify(packet, null, 2) + '\n', {flag:'wx', mode:0o600});
  console.log('Created focused context packet: ' + file);
  if (packet.contextMode === 'cold-review') {
    console.log('Assign this artifact to a fresh Paperclip reviewer run. Context isolation is NOT verified by packet generation.');
  } else {
    console.log('Only explicitly selected approved decisions were included; all other project history remains unloaded.');
  }
}
try { main(); }
catch (error) { console.error('Retina context:', error.message); process.exitCode = 1; }
