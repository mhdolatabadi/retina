# Retina specialists inside Paperclip — ChatGPT Plus default

Paperclip retains the **existing CEO**, scheduling, task assignment and spending/usage visibility. Retina contributes its six specialist agent roles and engineering rules. It does not create another CEO or scheduler.

## Connect ChatGPT Plus to Paperclip

1. Install Codex CLI on the host running Paperclip: `npm install -g @openai/codex`. Current Paperclip versions require Node.js 24+ and Python 3 for subscription login.
2. Open **Paperclip → Connectors → OpenAI → Subscription**. Sign in via the one-time device code in the browser, then click **Connect**. This uses your ChatGPT Plus Codex entitlement. It is not an OpenAI API key.
3. In the saved OpenAI connector, give the Retina agents permission to use that connection (personal default or an explicitly selected compatible connection). Make sure there is a responsible human user for runs.
4. Check **Usage → Check usage**. All workers using the same Plus account share its limits; no API per-token charge is imposed on subscription runs, but they consume quota.

## Preview only (default: Codex)

    cd retina
    git pull origin master
    npm test
    npm run paperclip

The preview has no side effects. It uses the `codex_local` **Legacy** adapter with ACP engine, default `gpt-6.1-sol`, an existing Retina role-specific instructions path, and `dangerouslyBypassApprovalsAndSandbox: false`. No Hormouz/OpenAI API key is added to the payload.

To select another model that your CLI and Plus plan support, use `npm run paperclip -- --codex-model MODEL_ID` and the same flag when installing.

## Create six specialists under the existing Paperclip CEO

Find the existing identifiers in Paperclip and run:

    paperclipai agent list --company-id COMPANY_ID --json
    npm run paperclip -- --company-id COMPANY_ID --ceo-id CEO_AGENT_ID --apply

This registers **Retina Discovery, Retina Project Manager, Retina Orchestrator, Retina Coder, Retina Reviewer 1 and Retina Reviewer 2**. The installer refuses duplicate names and verifies the existing CEO belongs to the selected company. It writes instructions into the ignored `.retina/paperclip/instructions` directory. Scheduled heartbeats are requested off until the first live tests. The installer uses `--runner legacy` so classic `instructionsFilePath` works; macOS would otherwise default to the experimental Paperclip Runner.

After creating the roles, open **Agents → Harness / Runtime** for each one, ensure the subscription connection is selected, and run **Test your agent**. Configure a Paperclip Project workspace pointing at the actual application repository, then assign a small harmless test task. Keep the existing CEO and append the following delegation policy to its instructions:

> Use Retina Discovery for human-approved requirements, Retina PM for planning, Retina Orchestrator for single-task technical coordination, Retina Coder for implementation, and the two Retina Reviewers for independent code review. Paperclip is the only assignment and scheduling authority. Jira and Gerrit operations require verified integrations. Humans decide product scope, architecture and high-risk merges.

## Previously imported Hormouz agents

If the six Retina roles were already created using the earlier installer, **do not run `--apply` again**. The script rejects duplicate roles. Instead open each existing agent's **Harness / Runtime**, switch its adapter to Codex, choose the saved ChatGPT subscription connection and a supported model, and preserve the role's original instructions and Reports-to link. Run the environment test for every role. This repository does not remotely migrate your installed Paperclip agents or sign in to your ChatGPT account.

## Optional fallback to Hormouz

    npm run paperclip -- --runtime hormouz
    npm run paperclip -- --runtime hormouz --company-id COMPANY_ID --ceo-id CEO_AGENT_ID --apply

This uses the previous OpenCode legacy adapter and requires a separately configured `HORMOZ_API_KEY`. A role model can be set with `npm run models -- set coder PROVIDER/MODEL_ID`. The Hormouz path enables unattended OpenCode tools; keep it in a trusted, isolated workspace.

## Costs, monitoring and safeguards

Paperclip is now the source of truth for its agent runs, usage and quota. ChatGPT Plus is quota-based rather than a metered API account: dollar cost shown as zero for included Codex runs must not be interpreted as zero usage. Paperclip's **OpenAI connector → Usage → Check usage** shows provider limits and resets.

Retina's old Grafana exporter tracks standalone OpenCode wrapper runs only and does **not** see Paperclip-managed Codex sessions. You do not need it for the initial Paperclip setup.

Retina does not automatically connect Jira or Gerrit. Keep task review/approval and project workspace permissions appropriately constrained.

Sources:
- https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan
- https://docs.paperclip.ing/connectors/openai/
- https://docs.paperclip.ing/reference/adapters/codex/
- https://docs.paperclip.ing/reference/cli/agent/
