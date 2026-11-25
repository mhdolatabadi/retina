# Retina

Retina is an agentic software-development orchestration project. Its planned workflow connects Jira issues, OpenCode workers backed by OpenRouter, and Gerrit review.

> Status: bootstrap in progress. Token analytics include an OpenCode v2 event collector, local read-only dashboard and CLI reports. Jira, Gerrit and unattended orchestration are **not connected yet**.

## Principles

- Humans own product requirements and architectural decisions.
- Agents execute specified work and request clarification instead of guessing.
- Jira owns task requirements and Story Points; Gerrit owns code review and votes.
- Execution must be durable and traceable; token usage is observed, not optimized, in the first version.

See `docs/architecture.md` and `docs/roadmap.md` in the bootstrap branch for the planned design. No credentials belong in this repository.

## Token observability

This branch adds a standalone read-only token observability module with reports by Jira task, type, Story Point, model, stage, agent, and orchestrator, including observed time-normalized token rates. It requires Node.js 22+ and no service or API key to analyze recorded usage.

```sh
npm test
node src/report.js --state /path/to/state.json --group-by taskType
node src/report.js --state /path/to/state.json --report tasks
```

See [token observability](docs/token-observability.md). Live provider ingestion and the complete Jira-to-Gerrit runner are separate integration work.

## Local OpenCode setup (Hormoz AI)

See [local setup](docs/local-setup.md). OpenCode custom provider and Discovery/Project Manager/Orchestrator/Coder/Reviewer roles are configured. The Hormouz endpoint and model ID are preconfigured from the provided API example; only a local `HORMOZ_API_KEY` is required. Authenticated connectivity has not yet been tested. This is not yet an unattended Jira-to-Gerrit delivery service.

## Role-specific models

Each Retina Agent has its own Hormouz model alias. Configure upstream models locally with `npm run models -- list` and `npm run models -- set coder PROVIDER/MODEL-ID`. Preferences stay in ignored `.retina/role-models.json`, and the local wrapper resolves them at startup. See [local setup](docs/local-setup.md). Until a role is configured, it uses `anthropic/claude-sonnet-5.5`. No automatic model selection, cost routing, or upstream availability check is implied.

## Live Observability dashboard

In one terminal run `npm run dashboard`, and open http://127.0.0.1:4318. In another terminal run `npm run local:opencode`. OpenCode v2 automatically records sanitized model-step usage and measured timing in `.retina/telemetry/events.ndjson`. Bind a session to a Jira task with `npm run task -- bind SESSION_ID IRIS-123 BUG_FIX 3 R2`. See [Live Observability](docs/live-observability.md). A real authenticated Hormouz call must still be tested on your computer.

## Grafana Observability (recommended)

Run-scoped telemetry now excludes unrelated corporate OpenCode sessions. The primary monitoring stack is provisioned Grafana + Prometheus, with token usage and Hormouz tariff-cost charts by agent role, model, Jira issue and task type. Add GRAFANA_ADMIN_PASSWORD to ignored .env and run: docker compose -f compose.grafana.yml up -d. Open http://127.0.0.1:3000. More: [Grafana Observability](docs/grafana-observability.md). Tariff costs are not settled bills; missing cache prices are not invented.

## Use Retina inside Paperclip (ChatGPT Plus by default)

Retina's six specialist agents can run under an **existing Paperclip CEO** with the official **Codex + ChatGPT subscription** connection (no Hormouz or OpenAI API key). In Paperclip, choose **Connectors → OpenAI → Subscription** and complete the browser login. Preview with `npm run paperclip` and apply with `npm run paperclip -- --company-id COMPANY_ID --ceo-id CEO_AGENT_ID --apply`. If you already imported the six roles using Hormouz, change their runtime in Paperclip instead of creating duplicates. For optional legacy Hormouz, select `--runtime hormouz`. Details: [Paperclip integration](docs/paperclip-integration.md).

## Keep Paperclip Agent changes in Retina

Each Retina specialist's canonical instructions are now in **`paperclip/agents/<role>/AGENTS.md`**, tracked by Git. To make changes from the Paperclip **Identity** UI edit the same files, link them once:

    npm run paperclip:sync -- link --company-id COMPANY_ID --apply --prefer-retina

Use `--prefer-paperclip` instead when you want to import customized Paperclip instructions. After changing agents, run `npm run paperclip:save` to pull portable settings (model, title, budget), and `npm run paperclip:publish` to commit and push the six role directories. Run `npm run paperclip:apply -- --apply` to send safe Git settings updates back to Paperclip with revision guards. **Inspect tracked files before pushing: this repository is public.**

See [Paperclip Git-backed synchronization](docs/paperclip-git-sync.md) for required local access, ownership boundaries, conflicts and security limitations.
