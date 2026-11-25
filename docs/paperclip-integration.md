# Run Retina inside Paperclip

Paperclip is the **sole manager** of agent scheduling, budgets, tasks, and run lifecycle. Retina supplies specialized role prompts, model routing and development standards. Do not create a second CEO or Orchestrator service.

## Roles

- Keep your existing Paperclip **CEO**. This agent receives your instructions and delegates tasks.
- Add six specialist Paperclip agents: Retina Discovery, Retina Project Manager, Retina Orchestrator, Retina Coder, Retina Reviewer 1, Retina Reviewer 2.
- Retina Orchestrator handles a task's technical progress, not a second scheduler. Paperclip still assigns and wakes agents.
- Jira controls approved acceptance criteria and Story Points where integrated; Gerrit controls actual patch-set votes and merge. These integrations are not automatically installed by this setup.
- Humans approve product decisions, architecture changes and high-risk merges.

## Prerequisites

1. A running **local Paperclip** installation and an authenticated `paperclipai` CLI on the same Mac as the OpenCode runtime.
2. Existing company ID and CEO agent ID: `paperclipai agent list --company-id COMPANY_ID --json` (or the Paperclip URLs).
3. An existing Retina checkout. Keep the key on the **Paperclip server process environment or secure per-agent secret binding** as `HORMOZ_API_KEY`; the Retina `.env` file is NOT read automatically by Paperclip.
4. Current Paperclip releases need Node.js 24+; the Retina scripts themselves support Node.js 22+.

## Preview the setup

    cd retina
    git pull origin master
    npm test
    npm run paperclip

Dry-run creates no Paperclip agents and no instruction files. Model defaults come from Retina `opencode.json`. To change an agent model first, run:

    npm run models -- set coder PROVIDER/MODEL-ID
    npm run paperclip

Use a model ID actually supported by Hormouz. No unverified model names are imposed by the installer.

## Add the six roles beneath your existing CEO

    npm run paperclip -- --company-id COMPANY_ID --ceo-id CEO_AGENT_ID --apply

The installer checks that the given CEO is present and has role `ceo`, and refuses an exact matching agent name to prevent accidental duplicates. It then generates ignored instruction files under `.retina/paperclip/instructions/` and calls the authenticated `paperclipai agent create` command for each role. Apply once; running it again intentionally stops on duplicates. Importing roles does not create another CEO or another Paperclip company.

The installer explicitly uses `--runner legacy` to select `opencode_local` on macOS. This is important: Paperclip's documented `PAPERCLIP_OPENCODE_PROVIDERS` custom-provider override and `instructionsFilePath` are legacy-only options. The OpenCode Runner uses a separate runtime/connection configuration.

Each worker receives:
- Its own selectable OpenCode alias `hormoz/ROLE`, mapped by `modelID` to the exact upstream Hormouz model.
- `PAPERCLIP_OPENCODE_PROVIDERS` containing the official `@ai-sdk/openai-compatible` custom-provider shape with the endpoint `https://api.hormouz.net/v1`.
- A credential reference `{env:HORMOZ_API_KEY}`: the API key value is never embedded in the exported config.
- An auxiliary model alias `hormoz/sonnet` and `OPENCODE_ALLOW_ALL_MODELS=true` for gateway-only model identifiers.
- Its existing Retina role instructions, and the shared Retina engineering rules for Coder and Reviewers.
- Scheduled heartbeats disabled by default, until you test the setup and enable them.

**Security:** Paperclip currently applies custom-provider overrides in this legacy configuration only when `dangerouslySkipPermissions=true`. That enables unattended tool and shell actions. Use a dedicated, constrained project checkout, configure per-agent budgets and Paperclip permissions, and do not give this setup sensitive company workspaces or credentials until you have validated its isolation.

## After creation

1. Open Paperclip → Agents → each Retina role → Harness / Runtime.
2. Check the working machine, OpenCode (Legacy), per-role model, and the `HORMOZ_API_KEY` secret available to that agent.
3. Run **Test your agent** for each role. The test requires a valid key and real provider response.
4. Configure a Paperclip **Project workspace** pointing to the actual application repository to be developed, not to the Retina control repository unless that is intentional.
5. In your current CEO's Identity/AGENTS.md, append the following policy, keeping all existing Paperclip instructions:

> Delegate requirement clarification to Retina Discovery, implementation planning to Retina Project Manager, single-task technical coordination to Retina Orchestrator, code changes to Retina Coder and independent reviews to Retina Reviewer 1 and Reviewer 2. Keep Paperclip as the sole task and run orchestrator. Do not claim unverified Jira/Gerrit actions. Ask the human for product, architecture, requirements or risk decisions.

6. Assign a small harmless task through Paperclip and confirm it reaches the appropriate role. Enable any scheduled heartbeats only after verification.

## About Grafana and costs

Paperclip owns Paperclip-launched Agent runs and offers run-level usage and accounting. The previous standalone Retina Grafana event collector only counts executions made via `npm run local:opencode`. It does **not** automatically account for Paperclip-launched workers. Do not run both schedulers on the same task or assume the old Grafana totals include Paperclip.

Bridging Paperclip's run data and its provider billing into Retina Grafana is separate work; actual settled Hormouz cost requires provider billing receipts, not an estimated generic model rate.

## Troubleshooting

- Model unavailable: verify `PAPERCLIP_OPENCODE_PROVIDERS` and your exact Hormouz `modelID`; run `Test your agent`.
- 401/403: set `HORMOZ_API_KEY` in Paperclip's runtime, not just Retina `.env`.
- Wrong checkout: set the **Paperclip Project workspace**; the agent `cwd` field is deprecated.
- Existing agent: the installer refuses duplicates. Edit the existing agent instead.
- No Jira/Gerrit action: connect and authorize those services separately.

Reference: https://docs.paperclip.ing/reference/adapters/opencode/
Reference: https://docs.paperclip.ing/reference/cli/agent/
Reference: https://opencode.ai/docs/models
