# Retina

Retina is an agentic software-development orchestration project. Its planned workflow connects Jira issues, OpenCode workers backed by OpenRouter, and Gerrit review.

> Status: bootstrap in progress. Jira, Gerrit, model execution, and automated review are **not connected yet**.

## Principles

- Humans own product requirements and architectural decisions.
- Agents execute specified work and request clarification instead of guessing.
- Jira owns task requirements and Story Points; Gerrit owns code review and votes.
- Execution must be durable and traceable; token usage is observed, not optimized, in the first version.

See `docs/architecture.md` and `docs/roadmap.md` in the bootstrap branch for the planned design. No credentials belong in this repository.
