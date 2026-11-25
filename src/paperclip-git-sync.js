import path from 'node:path';
import { RETINA_ROLES } from './role-models.js';
import { PAPERCLIP_AGENT_NAMES } from './paperclip-plans.js';

const ROLES = new Set(RETINA_ROLES);
const REDACTED = /(\*\*\*REDACTED\*\*\*|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{20,})/i;
const MODEL = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,199}$/;

export function roleDirectory(root, role) {
  if (!ROLES.has(role)) throw new Error('Unknown Retina role: ' + role);
  return path.join(root, 'paperclip', 'agents', role);
}

export function instructionPath(root, role) {
  return path.join(roleDirectory(root, role), 'AGENTS.md');
}

export function selectPaperclipAgents(listResponse, storedIds = {}) {
  const payloads = [listResponse, listResponse?.agents, listResponse?.result,
    listResponse?.result?.agents, listResponse?.data, listResponse?.data?.agents];
  const rows = payloads.find(Array.isArray);
  if (!rows || !rows.every(row => row && typeof row.id === 'string' && typeof row.name === 'string')) {
    throw new Error('Unknown Paperclip agent list JSON shape');
  }
  const resolved = {};
  const claimed = new Set();
  for (const role of RETINA_ROLES) {
    const byId = storedIds[role]
      ? rows.filter(agent => agent.id === storedIds[role]) : [];
    const byName = rows.filter(agent => agent.name === PAPERCLIP_AGENT_NAMES[role]);
    const matches = byId.length ? byId : byName;
    if (matches.length !== 1) throw new Error(
      role + ': expected exactly one matching active Paperclip agent; found ' + matches.length);
    const agent = matches[0];
    if (claimed.has(agent.id)) throw new Error('One Paperclip agent cannot serve two Retina roles');
    claimed.add(agent.id);
    resolved[role] = agent;
  }
  return resolved;
}

export function unpackConfiguration(response) {
  const candidates = [response, response?.agent, response?.configuration,
    response?.data, response?.data?.agent, response?.result, response?.result?.agent];
  const config = candidates.find(candidate =>
    candidate && typeof candidate === 'object' && typeof candidate.adapterType === 'string');
  if (!config) throw new Error('Paperclip configuration response has no agent adapterType');
  const revision = response?.configurationRevision ?? response?.data?.configurationRevision ??
    response?.result?.configurationRevision ?? config.configurationRevision ?? null;
  return { config, revision };
}

export function snapshotAgent(role, config) {
  if (!ROLES.has(role)) throw new Error('Unknown Retina role');
  const candidate = {
    schemaVersion: 1,
    retinaRole: role,
    name: config.name,
    title: config.title ?? '',
    capabilities: config.capabilities ?? '',
    adapterType: config.adapterType,
    model: config.adapterConfig?.model ?? null,
    heartbeatEnabled: Boolean(config.runtimeConfig?.heartbeat?.enabled),
    budgetMonthlyCents: config.budgetMonthlyCents ?? 0
  };
  return validateSnapshot(candidate);
}

export function validateSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid settings JSON');
  const required = ['schemaVersion', 'retinaRole', 'name', 'title', 'capabilities',
    'adapterType', 'model', 'heartbeatEnabled', 'budgetMonthlyCents'];
  if (Object.keys(value).some(k => !required.includes(k)) ||
      required.some(k => !Object.hasOwn(value, k))) {
    throw new Error('Unsupported or missing settings fields; refusing to round-trip secrets');
  }
  if (value.schemaVersion !== 1 || !ROLES.has(value.retinaRole)) throw new Error('Unknown snapshot version or role');
  for (const k of ['name','title','capabilities','adapterType']) {
    if (typeof value[k] !== 'string' || value[k].length > 16000) throw new Error('Invalid settings field: ' + k);
    if (REDACTED.test(value[k])) throw new Error('Potential credential in ' + k + '; refusing to save');
  }
  if (value.name.trim().length < 1 || !/^(codex_local|opencode_local|claude_local|paperclip_runner)$/.test(value.adapterType)) {
    throw new Error('Unknown agent name or unsupported adapter type');
  }
  if (value.model !== null && (typeof value.model !== 'string' || !MODEL.test(value.model))) {
    throw new Error('Invalid model identifier');
  }
  if (typeof value.heartbeatEnabled !== 'boolean' ||
      !Number.isSafeInteger(value.budgetMonthlyCents) || value.budgetMonthlyCents < 0) {
    throw new Error('Invalid heartbeat flag or budget');
  }
  return value;
}

export function makeConfigPatch(current, desired, revision) {
  const live = snapshotAgent(desired.retinaRole, current);
  validateSnapshot(desired);
  if (!revision || !/^[a-f0-9]{64}$/i.test(revision)) {
    throw new Error('Missing Paperclip configurationRevision; cannot safely apply');
  }
  // Harness migration is deliberately manual: it requires a connector/credential
  // change and should never be inferred from a stale Git snapshot.
  if (live.adapterType !== desired.adapterType) {
    throw new Error('Harness changed. Migrate the adapter in Paperclip, then save a new snapshot.');
  }
  const patch = { expectedConfigurationRevision: revision };
  for (const name of ['name','title','capabilities','budgetMonthlyCents']) {
    if (live[name] !== desired[name]) patch[name] = desired[name];
  }
  if (live.model !== desired.model) patch.adapterConfig = {model:desired.model};
  if (live.heartbeatEnabled !== desired.heartbeatEnabled) {
    patch.runtimeConfig = {heartbeat:{enabled:desired.heartbeatEnabled}};
  }
  return Object.keys(patch).length === 1 ? null : patch;
}

export function isExternalBundle(bundleResponse, expectedRoot) {
  const candidates = [bundleResponse, bundleResponse?.bundle,
    bundleResponse?.result, bundleResponse?.data, bundleResponse?.data?.bundle];
  const bundle = candidates.find(x => x && typeof x.mode === 'string');
  if (!bundle) throw new Error('Unknown Paperclip instructions bundle response');
  if (bundle.mode === 'external') {
    if (path.resolve(bundle.rootPath || '') !== path.resolve(expectedRoot)) {
      throw new Error('Agent already uses a different external instructions folder: ' +
        (bundle.rootPath || '(unknown)'));
    }
    return true;
  }
  if (bundle.mode !== 'managed') throw new Error('Unexpected instructions bundle mode: ' + bundle.mode);
  return false;
}
