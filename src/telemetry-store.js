import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';

export const dataDirectory = (root) => path.join(root, '.retina');
export const eventsFile = (root) => path.join(dataDirectory(root), 'telemetry', 'events.ndjson');
export const bindingsFile = (root) => path.join(dataDirectory(root), 'session-tasks.json');

export function appendTelemetry(filename, entry) {
  mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  appendFileSync(filename, JSON.stringify(entry) + '\n', { encoding: 'utf8', mode: 0o600 });
}

export function readTelemetry(filename) {
  if (!existsSync(filename)) return [];
  const size = Buffer.byteLength(readFileSync(filename, 'utf8'));
  if (size > 100 * 1024 * 1024) throw Error('Telemetry file exceeds 100MB; archive or rotate it first');
  const lines = readFileSync(filename, 'utf8').split('\n');
  const entries = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (e && typeof e === 'object' && e.sessionID && e.messageID && e.kind) entries.push(e);
    } catch { /* A partially appended tail is ignored until the next read. */ }
  }
  return entries;
}

export function readBindings(filename) {
  if (!existsSync(filename)) return {};
  const data = JSON.parse(readFileSync(filename, 'utf8'));
  if (!data || Array.isArray(data) || typeof data !== 'object') throw Error('Invalid session bindings');
  return data;
}

export function updateBindings(filename, bindings) {
  mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temporary = filename + '.' + process.pid + '.tmp';
  try {
    writeFileSync(temporary, JSON.stringify(bindings, null, 2) + '\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    renameSync(temporary, filename);
  } catch (error) {
    try { unlinkSync(temporary); } catch {}
    throw error;
  }
}

export function validateBinding(session, issue, taskType, points, risk = null) {
  const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
  if (!ID.test(session) || !ID.test(issue) || !ID.test(taskType)) throw Error('Invalid session, Jira issue or task type');
  const parsed = Number(points);
  if (points === undefined || points === '' || !Number.isFinite(parsed) || parsed < 0 || parsed > 100) throw Error('Story Points must be a number from 0 to 100');
  if (risk !== null && !['R1','R2','R3','R4'].includes(risk)) throw Error('Risk must be R1, R2, R3 or R4');
  return { issueKey: issue, taskType, storyPoints: parsed, risk };
}
