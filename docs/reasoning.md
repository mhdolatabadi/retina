# Native context and independent critique in Retina

Retina uses two complementary working modes **within its six existing roles**: durable human-approved project knowledge for authoring, and intentionally limited evidence for independent review. These are context-management practices, **not additional agents, a plugin, a new Paperclip lifecycle, or a mandatory seven-step ceremony**.

## Roles and authority

| Existing role | Long-lived context | Independent judgment |
| --- | --- | --- |
| Discovery | Understand goals, accepted decisions, reasons and trade-offs | Test if the spec can stand alone; request substantive design critique |
| Project Manager | Use confirmed spec and dependencies | Check if tasks are cold-readable; escalate requirement ambiguity |
| Orchestrator | Know approved scope and actual task status | Delegate bounded evidence packets to existing Reviewer agents in distinct Paperclip runs |
| Coder | Know approved contract and applicable coding conventions | Self-check code/spec/test drift; do not pre-sell a patch to reviewers |
| Reviewer 1 | Load applicable rules and approved constraints | Independently reconstruct requirements, critique design or code from artifact |
| Reviewer 2 | Load independently required constraints | Stress-test alternatives, failure modes, security and implementation readiness |

Paperclip's existing CEO stays the one manager. There is no new EGM / Goldfish agent and no separate scheduler. A reviewer can perform a design review and later a code review in different runs; a design review is **not** a Gerrit +1 or +2.

## Decision memory belongs to the product repository

Within the **target project** checkout (not Retina's public control repository), store a durable, reviewable record at `docs/retina/decisions/<id>.json`. For example:

```json
{
  "id": "DEC-104",
  "status": "approved",
  "scope": "checkout retries",
  "decision": "Retry only transient network failures and cap attempts at three",
  "rationale": "Avoid duplicate charges while recovering intermittent errors",
  "approval": {
    "by": "product owner",
    "evidence": "https://example.org/approved-design-review/104",
    "date": "2026-11-25"
  }
}
```

**Example only.** An Agent may draft a decision, but must use `status: proposed` until the responsible human explicitly approves it. The approval metadata is a provenance claim, **not a verifiable digital signature**: the human should review changes to the decision ledger in the same PR/design approval flow. For rejected options use `status: rejected`; to replace a prior decision, approve a new record with `supersedes: ["DEC-OLD"]`. The context builder refuses requests for unapproved or superseded decisions.

Use approved, *relevant* records by ID, not a dump of every memory and past conversation. When no past decisions are relevant, there can be zero selected records.

## Routine work

Discovery works with the human and writes a self-contained spec: scope, goals/non-goals, relevant decisions, examples, edge cases and unanswered questions. PM converts approved specs into tasks with AC/DoD. Coder implements and tests. Reviewers inspect the current artifact, constraints and necessary code. For routine bug fixes, continue directly through the existing PM↔Coder and Coder↔Reviewer loops.

For meaningful uncertainty or risk, the existing Orchestrator asks the **Paperclip CEO** to delegate a design critique to an existing Reviewer **before implementation**. The reviewer should receive the document, selected approved decision records, and only necessary references — not the author conversation or Reviewer 1's prior verdict. Findings go back through PM/Discovery; only a human can change an accepted product/architecture/security decision.

## Context packet helper (optional, no new agent)

From the **Retina control repository checkout** (where `npm run context` exists):

```sh
npm run context -- decisions --workspace /absolute/path/to/product
npm run context -- pack --workspace /absolute/path/to/product \
  --role reviewer-1 --artifact docs/designs/checkout.md \
  --decision DEC-104 --reference src/checkout.js
```

The second command writes a private, non-overwriting JSON packet under the **product** `.retina/handoffs/` directory (add `.retina/` to that project's `.gitignore`). The packet contains the source artifact and its hash, only the explicitly chosen approved decisions, the paths and hashes of reference files, review instructions, and `reviewIsolation.verified: false`. The reference files are **not** dumped into the packet; the reviewer must open and check them from the assigned workspace. Each file must be inside the checkout and at most 250 KB; absolute paths and escaping symlinks are rejected.

To author with relevant project memory rather than to review, pass `--role discovery`, `--role project-manager`, or `--role coder` and the appropriate artifact. Packets can be handed to Paperclip in the assigned task context. The command **does not** create a Paperclip run, send data to a provider, certify human approval, or establish isolated context.

## Independence is an execution property

Only a **new Reviewer run with controlled inputs** can offer conversational independence; it is not proven merely because a JSON packet was built or a different Agent name is used. Verify actual Paperclip/Codex run state, exposed memory/tool access and any host-injected AGENTS.md. In particular, Codex may inject host/project instructions into supposedly fresh reviewers. If full isolation cannot be verified, describe the review as *separate but isolation unverified*, not as a clean Goldfish review.

Reviewer outcomes should include artifact SHA, relevant decision IDs, severity-ranked findings with evidence locations, reviewer run/agent identity, and an explicit note about isolation confidence. These are review evidence, not votes or human approval.

## Drift and costs

During authoring, planning, testing and review, explicitly compare **accepted spec ↔ implementation ↔ tests ↔ docs**. Raise substantive intent changes for human resolution rather than modifying the spec to justify unexpected code. Re-evaluate the design only when drift or risk warrants it.

Full multi-reviewer procedures are intentionally *not* mandatory for low-risk defects. Codex Plus usage is shared across all Paperclip agents and fresh-review calls consume the same plan quota. Use an incremental and risk-based strategy.

## Scope of this implementation

- Completed in code: Git-backed role instructions for both Paperclip and OpenCode, decision validation and selection, bounded project-context packets, local-only CLI, tests for provenance and path isolation.
- Not automatically implemented: Paperclip assignment APIs and fresh-review execution, continuous spec/code drift scanner, cryptographic human approval checking, proof of Codex host-level context isolation. These require real provider/runtime access and should not be reported as operational until live integration tests pass.

EGM conceptual source: https://github.com/google/elephant-goldfish-model; this implementation adopts the **principles** in Retina's existing roles, not the external plugin code or workflows.
