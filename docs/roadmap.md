# Implementation roadmap

The smallest useful end-to-end milestone is **one real Jira issue through implementation, Gerrit review, merge, and Jira completion**, with audit and token records.

## 1. Foundations (this scaffold)

- Bootable Spring application, pure concurrency policy, runtime boundary, usage value object, test and CI setup
- Documentation separating agent coding guidance from workflow policies

## 2. Durable issue execution

- PostgreSQL schema for orchestrators, issue claims, run states, and attempts
- Atomic leases and restart recovery
- Jira issue discovery, readiness questions in comments, human approval of Story Points

## 3. OpenCode and OpenRouter

- Runtime adapter for OpenCode isolated sessions
- Per-role fixed model configuration supplied externally
- Per-invocation usage and run telemetry persisted without optimization

## 4. Gerrit and delivery

- Patch set upload, CI gate collection, sequential +1/+2 agents, fix loops
- Gerrit submit and Jira completion synchronization
- Integration tests against real isolated services and complete system smoke/acceptance testing

## 5. Scale and observe

- Multiple orchestrators, bounded workers, recovery drills, timeline and token reporting
- Evaluate delivery throughput and defect rates against a baseline

All future implementation must follow confirmed requirements. Don't fabricate Jira or Gerrit defaults, credentials, or policies.
