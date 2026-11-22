# Retina

Retina is an agentic software-development orchestration project. Its planned workflow connects Jira issues, OpenCode workers backed by OpenRouter, and Gerrit review.

> Status: bootstrap in progress. Token analytics are implemented as a read-only Node.js module and CLI. Jira, Gerrit, model execution, and automated review are **not connected yet**.

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
