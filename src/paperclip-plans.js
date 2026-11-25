import path from 'node:path';
import { RETINA_ROLES, buildRoleModelConfig, validateUpstreamModel } from './role-models.js';

export const PAPERCLIP_AGENT_NAMES = Object.freeze({
  'discovery': 'Retina Discovery',
  'project-manager': 'Retina Project Manager',
  'orchestrator': 'Retina Orchestrator',
  'coder': 'Retina Coder',
  'reviewer-1': 'Retina Reviewer 1',
  'reviewer-2': 'Retina Reviewer 2'
});

export function buildPaperclipProvider(base, overrides = {}) {
  const config = buildRoleModelConfig(base, overrides);
  const source = config.providers.hormoz;
  const models = {};
  for (const [alias, info] of Object.entries(source.models)) {
    models[alias] = {
      name: info.name || alias,
      modelID: validateUpstreamModel(info.modelID)
    };
  }
  return {
    hormoz: {
      npm: '@ai-sdk/openai-compatible',
      name: 'Hormouz AI',
      options: {
        baseURL: 'https://api.hormouz.net/v1',
        apiKey: '{env:HORMOZ_API_KEY}'
      },
      models
    }
  };
}

export function buildPaperclipPlans({
  base, overrides = {}, root, ceoId,
  roleBudgets = {}
}) {
  if (!path.isAbsolute(root)) throw new Error('Retina root must be an absolute directory');
  if (typeof ceoId !== 'string' || !ceoId.trim()) throw new Error('Existing Paperclip CEO ID is required');
  const provider = buildPaperclipProvider(base, overrides);
  return RETINA_ROLES.map(role => {
    const budget = roleBudgets[role];
    if (budget !== undefined && (!Number.isInteger(budget) || budget < 0)) {
      throw new Error('Invalid monthly budget in cents for ' + role);
    }
    const payload = {
      name: PAPERCLIP_AGENT_NAMES[role],
      role: role === 'coder' ? 'engineer' : 'general',
      title: role === 'project-manager' ? 'Requirements-backed delivery planning' : 'Retina ' + role,
      reportsTo: ceoId,
      adapterType: 'opencode_local',
      adapterConfig: {
        model: 'hormoz/' + role,
        instructionsFilePath: path.join(root, '.retina', 'paperclip', 'instructions', role + '.md'),
        // Legacy OpenCode adapter merges this provider into an ephemeral config.
        // There are no API keys in the payload: the host resolves HORMOZ_API_KEY.
        env: {
          PAPERCLIP_OPENCODE_PROVIDERS: JSON.stringify(provider),
          PAPERCLIP_OPENCODE_SMALL_MODEL: 'hormoz/sonnet',
          OPENCODE_ALLOW_ALL_MODELS: 'true'
        },
        // Required by the gateway-override behavior of Paperclip's legacy adapter.
        dangerouslySkipPermissions: true
      },
      runtimeConfig: { heartbeat: { enabled: false, wakeOnDemand: true } },
      permissions: { canCreateAgents: false, canCreateSkills: false }
    };
    if (budget !== undefined) payload.budgetMonthlyCents = budget;
    return {role, payload, upstreamModel: provider.hormoz.models[role].modelID};
  });
}

export function preparePaperclipInstructions(agentSource, role, engineeringRules = '') {
  const frontMatter = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;
  const text = agentSource.replace(frontMatter, '').trim();
  if (!text) throw new Error('Missing Retina instructions for ' + role);
  return [
    '# Retina ' + role + ' (Paperclip)',
    '',
    'You are a Retina specialist managed by Paperclip. Follow the current Paperclip task, workspace and reporting hierarchy.',
    'Never create an independent scheduler or a second task-orchestration authority. Paperclip owns agent assignments and runs.',
    'Do not claim that Jira, Gerrit, CI or review votes were updated unless an actual authorized integration confirms it.',
    'Humans must approve changes to requirements, product scope, architecture and high-risk merges.',
    'Use the assigned Paperclip project workspace as the product repository; do not edit the Retina control repository by default.',
    'If a required tool, credential or access grant is missing, report a concrete blocker instead of inventing an action.',
    '',
    '## Role instructions',
    '',
    text,
    '',
    ...(engineeringRules && (role === 'coder' || role.startsWith('reviewer-'))
      ? ['## Common Retina engineering rules', '', engineeringRules.trim(), ''] : [])
  ].join('\n');
}
