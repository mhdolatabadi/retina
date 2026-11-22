#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { RETINA_ROLES, validateRole, validateUpstreamModel, readRoleModelOverrides, buildRoleModelConfig, listRoleModels } from '../src/role-models.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = JSON.parse(readFileSync(path.join(root, 'opencode.json'), 'utf8'));
const filename = path.join(root, '.retina', 'role-models.json');

function persist(data) {
  const directory = path.dirname(filename);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const tmp = filename + '.' + process.pid + '.tmp';
  try {
    writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    renameSync(tmp, filename);
  } catch (error) {
    try { unlinkSync(tmp); } catch {}
    throw error;
  }
}

function run(argv) {
  const [command = 'list', role, modelId] = argv;
  const overrides = readRoleModelOverrides(filename);
  switch (command) {
    case 'set':
      validateRole(role);
      validateUpstreamModel(modelId);
      overrides[role] = modelId;
      persist(overrides);
      break;
    case 'reset':
      validateRole(role);
      delete overrides[role];
      persist(overrides);
      break;
    case 'reset-all':
      persist({});
      break;
    case 'list':
      if (role !== undefined) throw new Error('Usage: npm run models -- list');
      break;
    default:
      throw new Error('Usage: npm run models -- [list | set ROLE MODEL_ID | reset ROLE | reset-all]');
  }
  const resolved = buildRoleModelConfig(base, overrides);
  for (const entry of listRoleModels(resolved)) {
    process.stdout.write(entry.role.padEnd(16) + ' -> ' + entry.upstreamModel + (Object.hasOwn(overrides, entry.role) ? ' (local override)' : ' (default)') + '\n');
  }
  process.stdout.write('\nModel IDs are not checked against Hormouz availability until a real request is made.\n');
}
try { run(process.argv.slice(2)); } catch (error) {
  process.stderr.write('Retina models: ' + error.message + '\n');
  process.exitCode = 1;
}
