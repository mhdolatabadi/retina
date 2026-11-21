# Requirements-driven testing

- Every meaningful behavior change requires automated verification.
- Use appropriate **unit, integration, contract, end-to-end, acceptance, smoke, performance, and load** tests according to requirements and risk.
- Prefer the lowest and fastest test level that can reliably detect a defect. Do not enforce arbitrary test-count percentages.
- Test actual behavior and dependencies; do not use mocks or predetermined fake dependency responses.
- Every bug fix requires regression coverage, preferably demonstrated failing before the fix.
- Avoid duplicate, flaky, low-value, or implementation-coupled tests. Test boundary cases and real failures when relevant.
- Never disable tests or weaken assertions to pass CI. Coverage percentages are diagnostic, not the goal.
- Execute required quality gates before delivery; expensive tests may run in separately defined stages but cannot be silently skipped.
