# Retina

Retina is a multi-layer agentic software-development ecosystem. Humans own requirements and architectural decisions; agents execute approved work.

## Technology choices

- **Control plane:** Java 21, Spring Boot, PostgreSQL (persistence planned)
- **Agent runtime:** OpenCode
- **Model gateway:** OpenRouter
- **Work items:** Jira, including human-approved Story Points
- **Code review:** Gerrit, with two independent review agents

## Current state

This is a **foundation scaffold**, not a working Jira-to-Gerrit automation. Implemented so far:

- Bootable Spring application with an Actuator health endpoint
- Pure Java policy for orchestrator assignment eligibility
- Runtime interface for future OpenCode integration
- Token-usage value object and unit tests
- Architecture, workflow, and engineering guidance

**Not implemented:** Jira/Gerrit integrations, OpenCode runtime adapter, PostgreSQL persistence, scheduler, review workflow, telemetry ingestion, and UI. Do not claim automatic delivery works yet.

## Run locally

Prerequisites: Java 21 and Maven 3.9+.

```sh
mvn test
mvn spring-boot:run
curl http://localhost:8080/actuator/health
```

OpenCode and OpenRouter can be configured locally; credentials must be supplied by the operator and must never be committed. See `docs/architecture.md` and `docs/roadmap.md`.

## Engineering principles

Instructions for coding agents are in `AGENTS.md`, with focused details under `rules/`. Task management, review voting, and workflow orchestration are **system policies**, documented under `docs/`, not agent coding instructions.

## Safety of this repository

Never commit API keys, Jira/Gerrit URLs or credentials, private issue contents, customer code, or production data. Confirm repository visibility before uploading organization-specific configuration.
