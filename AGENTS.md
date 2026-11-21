# Agent instructions

Treat context as limited: search for relevant code before reading whole files. Load specialized guidance only for the current task.

- Follow the project's established implementation style; compare a few representative examples before writing similar code. See `rules/codebase-consistency.md`.
- Implement only the specified behavior, in the simplest correct way. Do not autonomously decide architecture, invent requirements, add speculative features, or refactor unrelated code. See `rules/implementation.md`.
- When material behavior, acceptance criteria, scope, or architecture are unclear, ask the authorized human instead of guessing. Use an interactive clarification approach such as `/grillme` when available. See `rules/clarification.md`.
- Test every behavior change appropriately, using real implementations and dependencies, with regression tests for fixed bugs. See `rules/testing.md`.
- Follow the repository's configured Checkstyle and prioritize human readability. Public classes require meaningful Javadoc; avoid redundant comments and `@DisplayName`. See `rules/code-style.md`.
- Before marking implementation ready, perform a critical self-check to the quality standard you would expect for a +2 review. Fix known shortcomings before handoff. Never cast a formal review vote on your own change.

Review voting, task assignment, and Jira/Gerrit workflow policies are maintained outside this file.
