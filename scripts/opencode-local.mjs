#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const cwd = process.env.RETINA_WORKSPACE?.trim() || project;
const child = spawn('opencode', args.length ? args : ['--standalone'], {
  cwd, shell: false, stdio: 'inherit',
  env: { ...process.env, OPENCODE_CONFIG: path.join(project, 'opencode.json'), OPENCODE_CONFIG_DIR: path.join(project, '.opencode') }
});
child.once('error', e => { console.error('OpenCode could not start:', e.message); process.exitCode = 1; });
child.once('close', (code, signal) => { if (signal) process.kill(process.pid, signal); else process.exitCode = code ?? 1; });
