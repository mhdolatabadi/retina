import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

const ROLE_NAMES = new Set([
  'discovery', 'project-manager', 'orchestrator', 'coder', 'reviewer-1', 'reviewer-2'
]);
const REVIEW_ROLES = new Set(['reviewer-1', 'reviewer-2']);
const DECISION_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,79}$/;
const MAX_SOURCE_BYTES = 250_000;
const MAX_DECISIONS = 24;

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim() || value.length > 12_000) {
    throw new Error('Missing or invalid ' + field);
  }
  return value.trim();
}

export function validateDecision(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Decision must be a JSON object');
  }
  if (!DECISION_ID.test(record.id ?? '')) throw new Error('Invalid decision id');
  if (!['proposed', 'approved', 'rejected'].includes(record.status)) {
    throw new Error('Decision status must be proposed, approved, or rejected');
  }
  for (const field of ['scope', 'decision', 'rationale']) requireText(record[field], field);
  if (record.supersedes !== undefined && (!Array.isArray(record.supersedes) ||
      record.supersedes.some(id => !DECISION_ID.test(id) || id === record.id))) {
    throw new Error('Invalid supersedes in ' + record.id);
  }
  if (record.status === 'approved') {
    if (!record.approval || typeof record.approval !== 'object') {
      throw new Error('Approved decision needs human approval metadata');
    }
    for (const field of ['by', 'evidence', 'date']) {
      requireText(record.approval[field], 'approval.' + field);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.approval.date) ||
        Number.isNaN(Date.parse(record.approval.date))) {
      throw new Error('Invalid approval date in ' + record.id);
    }
  }
  // Metadata documents the claimed approval; it is not an authentication proof.
  return record;
}

export function selectApprovedDecisions(documents, requestedIds) {
  if (!Array.isArray(requestedIds) || requestedIds.length > MAX_DECISIONS ||
      requestedIds.some(id => !DECISION_ID.test(id))) {
    throw new Error('Select at most 24 explicit decision IDs');
  }
  if (new Set(requestedIds).size !== requestedIds.length) {
    throw new Error('Duplicate decision ID requested');
  }
  const records = new Map();
  for (const raw of documents) {
    const record = validateDecision(raw);
    if (records.has(record.id)) throw new Error('Duplicate decision ID: ' + record.id);
    records.set(record.id, record);
  }
  const superseded = new Set(
    [...records.values()]
      .filter(item => item.status === 'approved')
      .flatMap(item => item.supersedes ?? [])
  );
  return requestedIds.map(id => {
    const item = records.get(id);
    if (!item || item.status !== 'approved') {
      throw new Error('Decision is missing or not human-approved: ' + id);
    }
    if (superseded.has(id)) throw new Error('Decision has been superseded: ' + id);
    return {
      id: item.id, scope: item.scope, decision: item.decision,
      rationale: item.rationale, approval: {
        by: item.approval.by, evidence: item.approval.evidence, date: item.approval.date
      }
    };
  });
}

export function readProjectFile(workspace, relativePath) {
  const base = realpathSync(workspace);
  if (typeof relativePath !== 'string' || !relativePath ||
      path.isAbsolute(relativePath)) {
    throw new Error('File must be a workspace-relative path');
  }
  const resolved = realpathSync(path.resolve(base, relativePath));
  if (resolved === base || !resolved.startsWith(base + path.sep)) {
    throw new Error('File escapes the project workspace: ' + relativePath);
  }
  if (!statSync(resolved).isFile() || statSync(resolved).size > MAX_SOURCE_BYTES) {
    throw new Error('File must be regular and at most 250 KB: ' + relativePath);
  }
  return {
    path: path.relative(base, resolved).split(path.sep).join('/'),
    content: readFileSync(resolved, 'utf8')
  };
}

export function readDecisionLedger(workspace) {
  const root = realpathSync(workspace);
  const directory = path.join(root, 'docs', 'retina', 'decisions');
  let names;
  try {
    names = readdirSync(directory).filter(name => name.endsWith('.json')).sort();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return names.map(name => {
    const file = readProjectFile(root, path.join('docs', 'retina', 'decisions', name));
    const item = validateDecision(JSON.parse(file.content));
    if (name !== item.id + '.json') {
      throw new Error('Decision filename must match its ID: ' + name);
    }
    return item;
  });
}

function fingerprint(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function buildRoleContext({ role, artifact, references = [], decisions = [] }) {
  if (!ROLE_NAMES.has(role)) throw new Error('Unknown Retina role: ' + role);
  if (!artifact || !artifact.path || typeof artifact.content !== 'string') {
    throw new Error('A self-contained source artifact is required');
  }
  if (!Array.isArray(references) || references.length > 12) {
    throw new Error('At most 12 explicitly selected references are allowed');
  }
  if (references.some(ref => !ref?.path || typeof ref.content !== 'string')) {
    throw new Error('References must be readable workspace files');
  }
  if (references.some(ref => ref.path === artifact.path) ||
      new Set(references.map(ref => ref.path)).size !== references.length) {
    throw new Error('Duplicate artifact/reference path');
  }
  // Caller must use selectApprovedDecisions; fail closed against draft records.
  if (decisions.some(item => !item?.approval?.evidence || !item?.approval?.by)) {
    throw new Error('Only explicitly approved decisions may enter the context packet');
  }
  const reviewer = REVIEW_ROLES.has(role);
  const artifactInfo = {
    path: artifact.path,
    sha256: fingerprint(artifact.content),
    content: artifact.content
  };
  return {
    schemaVersion: 1,
    role,
    contextMode: reviewer ? 'cold-review' : 'focused-authoring',
    artifact: artifactInfo,
    approvedDecisions: decisions,
    referenceFiles: references.map(ref => ({
      path: ref.path, sha256: fingerprint(ref.content)
    })),
    reviewIsolation: reviewer
      ? { verified: false, reason: 'A file handoff does not prove fresh-session isolation. Verify via the actual Paperclip/Codex run.' }
      : null,
    instructions: reviewer ? [
      'Review the artifact from first principles. Restate its intended behavior before evaluating it.',
      'Use only this artifact, approved decisions, and explicitly provided reference files as evidence.',
      'Do not ingest author conversations, private rationalizations, or other reviewer verdicts.',
      'Test assumptions, negative cases, failure handling, trade-offs, and implementation readiness in proportion to risk.',
      'Report actionable findings with severity and document/patch locations. If context is insufficient, ask rather than invent.',
      'A different agent name or session ID alone does not prove context isolation; disclose any unverified isolation.',
      'Your design findings are not Gerrit votes or human approval.'
    ] : [
      'Load only the evidence needed for the task and preserve the approved decision rationale.',
      'Identify assumptions separately from confirmed requirements; escalate product or architecture decisions to a human.',
      'Keep the artifact self-contained for a reader who has not seen the author conversation.',
      'Scale verification effort to risk; do not impose an extra review ceremony on trivial changes.'
    ]
  };
}
