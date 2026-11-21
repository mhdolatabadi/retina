# Retina architecture (initial scope)

## Boundaries

- **Jira** is the source of truth for task descriptions, accepted requirements, human-approved Story Points, priority, and business status.
- **Gerrit** owns patch sets, inline review discussions, code-review votes, and submit decisions.
- **Retina control plane** owns scheduler state, orchestrator identity, execution attempts, handoffs, retries, recovery, and metering records.
- **OpenCode** runs specialized agents in isolated workspaces; **OpenRouter** supplies the model endpoint.
- **Humans** own product and architectural decisions. Agents may make routine local coding choices within explicit existing conventions.

Do not put external Jira or Gerrit credentials, internal endpoints, customer code, or sensitive issue details in this repository.

## Task lifecycle

1. Discover prioritized Jira issues.
2. Assess issue readiness. If requirements are unclear, post precise questions in Jira and move to clarification.
3. Ask an agent for a Story Point proposal if needed. A TPMA or other authorized human must approve the estimate before execution.
4. Atomically claim eligible issues and assign a single execution owner.
5. Launch an implementation agent after the issue is Ready.
6. Verify tests, project Checkstyle, scope, and implementation self-assessment.
7. Upload Gerrit change and run two independent sequential reviews: first +1, then +2, using permitted distinct reviewer accounts.
8. Fix problems in new patch sets; re-review the effective patch set.
9. Mark Jira Done only after Gerrit reports a merged change and any task-specific completion conditions are satisfied.

## Orchestrator eligibility

Retina can create multiple task orchestrators. An orchestrator may retain several previously assigned issues, but cannot assign a **new** one while any owned issue is Doing or In Review. At most one issue can be Doing per orchestrator. This is enforced atomically by the future persistence and scheduling layer; the Java policy in this scaffold is only the pure decision rule.

Issues in Needs Clarification or Blocked don't occupy the active slot. In Review **does** block new assignment.

## Durability

Persist issue and Gerrit identifiers, current patch set, agent-run IDs, per-step state, retries, and orchestration leases. Recover incomplete runs after a restart without duplicate claims, reviews, or submissions.

## Observability, not optimization

Capture each provider/model invocation's input and output tokens, optional cached and reasoning tokens, source of measurement, agent, issue, orchestrator, stage, attempt, duration, and outcome. Optional counters may be subsets of totals and must not be blindly added together.

The first version records and displays usage; no token budgets, adaptive routing, context optimization, or automated token-based scheduling.

## Status

This document records approved direction. Adapters, persistence, and workflow gates have **not yet been implemented**.
