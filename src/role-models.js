import { readFileSync } from 'node:fs';

export const RETINA_ROLES = Object.freeze([
  'discovery', 'project-manager', 'orchestrator',
  'coder', 'reviewer-1', 'reviewer-2'
]);

const ROLE_SET = new Set(RETINA_ROLES);
const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,199}$/;

export function validateRole(role) {
  if (!ROLE_SET.has(role)) {
    throw new Error('Unknown agent role: ' + role);
  }
  return role;
}

export function validateUpstreamModel(modelId) {
  if (typeof modelId !== 'string' || !MODEL_ID_PATTERN.test(modelId)) {
    throw new Error('Invalid upstream model ID. Use the exact Hormouz model identifier (no spaces).');
  }
  return modelId;
}

export function validateOverrides(overrides) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new Error('Role model overrides must be an object');
  }
  for (const [role, value] of Object.entries(overrides)) {
    validateRole(role);
    validateUpstreamModel(value);
  }
  return overrides;
}

export function readRoleModelOverrides(filename) {
  try {
    return validateOverrides(JSON.parse(readFileSync(filename, 'utf8')));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

export function buildRoleModelConfig(base, overrides = {}) {
  validateOverrides(overrides);
  const result = structuredClone(base);
  const models = result.providers?.hormoz?.models;
  if (!models || !models.sonnet) throw new Error('Retina Hormouz model catalog is missing');
  for (const role of RETINA_ROLES) {
    if (!models[role]) throw new Error('Missing OpenCode model alias: hormoz/' + role);
    const modelId = overrides[role] ?? models[role].modelID;
    models[role].modelID = validateUpstreamModel(modelId);
  }
  return result;
}

export function listRoleModels(config) {
  const models = config.providers?.hormoz?.models;
  if (!models) throw new Error('Retina Hormouz provider is missing');
  return RETINA_ROLES.map(role => ({
    role,
    opencodeModel: 'hormoz/' + role,
    upstreamModel: validateUpstreamModel(models[role]?.modelID)
  }));
}
