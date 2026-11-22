#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRoleModelOverrides, buildRoleModelConfig } from '../src/role-models.js';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const cwd = process.env.RETINA_WORKSPACE?.trim() || project;

try {
  const base = JSON.parse(readFileSync(path.join(project, 'opencode.json'), 'utf8'));
  const directory = path.join(project, '.retina');
  const overrides = readRoleModelOverrides(path.join(directory, 'role-models.json'));
  const config = buildRoleModelConfig(base, overrides);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const runtimePath = path.join(directory, 'opencode.runtime.json');
  writeFileSync(runtimePath, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  const child = spawn('opencode', args.length ? args : ['--standalone'], {
    cwd, shell: false, stdio: 'inherit',
    env: {
      ...process.env,
      OPENCODE_CONFIG: runtimePath,
      OPENCODE_CONFIG_DIR: path.join(project, '.opencode')
    }
  });
  child.once('error', error => {
    console.error('OpenCode could not start:', error.message);
    process.exitCode = 1;
  });
  child.once('close', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
} catch (error) {
  console.error('Retina configuration failed:', error.message);
  process.exitCode = 1;
}
