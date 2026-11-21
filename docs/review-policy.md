# Gerrit review workflow policy

Formal code review is a team workflow, not a coding instruction in AGENTS.md.

- The implementing agent must pass required quality checks and self-verify before announcing readiness.
- Reviewer 1 and Reviewer 2 must be independent executions, not the implementing agent.
- Reviewer 1 reviews the Gerrit patch set and casts Code-Review +1 only when satisfied.
- Reviewer 2 conducts an independent review and may cast Code-Review +2 only after a valid +1 from Reviewer 1.
- Findings use short, actionable inline comments attached to real Gerrit code locations.
- A -1 indicates changes are requested; whether it technically blocks submission depends on Gerrit configuration. Retina must enforce the approved no-unresolved-blockers policy.
- Review state and votes must be validated for the applicable patch set; changes to the patch set may require renewed approvals.
- All actions stay traceable in Gerrit and use distinct, appropriately permissioned accounts.
- Submission is gated by Gerrit submit requirements and orchestrator policy; a model's self-assessment is never a formal vote.

Actual Gerrit configuration, accounts, and submit requirements remain to be set up.
