import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { readBindings, updateBindings } from './telemetry-store.js';

export const RETINA_AGENT_ROLES = Object.freeze([
  'discovery', 'project-manager', 'orchestrator', 'coder', 'reviewer-1', 'reviewer-2'
]);
const roles = new Set(RETINA_AGENT_ROLES);
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const validPath = value => typeof value === 'string' && path.isAbsolute(value);

export const runRegistryFile = root => path.join(root, '.retina', 'telemetry', 'retina-runs.json');

export function registerRetinaRun(root, workspace, id = randomUUID()) {
  if (!uuid.test(id)) throw new Error('Invalid Retina run ID');
  if (!validPath(workspace)) throw new Error('Retina workspace must be an absolute path');
  const filename = runRegistryFile(root);
  const existing = readBindings(filename);
  existing[id] = { workspace: path.resolve(workspace), createdAt: new Date().toISOString(), origin: 'retina-launcher' };
  updateBindings(filename, existing);
  return id;
}

export function activeRetinaRuns(root) {
  if (!existsSync(runRegistryFile(root))) return {};
  const entries = readBindings(runRegistryFile(root));
  return Object.fromEntries(Object.entries(entries).filter(([id, info]) =>
    uuid.test(id) && info?.origin === 'retina-launcher' && validPath(info.workspace)
  ));
}

/**
 * Fail-closed event admission. All three checks must pass:
 * 1) a dedicated Retina launch ID already registered by the local launcher,
 * 2) the OpenCode event location matches that launch's workspace,
 * 3) model steps use a Retina agent role and the Hormouz provider.
 *
 * A message must first pass step.started. Subsequent events are accepted only
 * for that message. Global OpenCode subscriptions cannot grant ownership.
 */
export function createRetinaEventGate({ runId, workspace, registeredRuns }) {
  const known = registeredRuns?.[runId];
  if (!uuid.test(runId ?? '') || !validPath(workspace) ||
      !known || path.resolve(known.workspace) !== path.resolve(workspace)) {
    return { admit: () => false, reason: 'not-a-registered-retina-launch' };
  }
  const accepted = new Set();
  const normalizedWorkspace = path.resolve(workspace);
  return {
    reason: null,
    admit(event) {
      if (!event?.type?.startsWith('session.step.') || !event?.data?.sessionID ||
          !event?.data?.assistantMessageID || !validPath(event.location?.directory) ||
          path.resolve(event.location.directory) !== normalizedWorkspace) return false;
      const id = event.data.sessionID + '|' + event.data.assistantMessageID;
      if (event.type === 'session.step.started') {
        if (!roles.has(event.data.agent) || event.data.model?.providerID !== 'hormoz') return false;
        accepted.add(id);
        return true;
      }
      return accepted.has(id);
    }
  };
}

export function onlyRetinaEvents(events, registeredRuns) {
  const allowed = new Set(Object.keys(registeredRuns));
  return events.filter(row => typeof row.retinaRunId === 'string' && allowed.has(row.retinaRunId));
}
