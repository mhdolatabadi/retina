# Java style and readability

- Follow the project's actual custom Google-based Checkstyle configuration where one is provided. Never bypass violations.
- Prefer descriptive names, simple control flow, and small cohesive responsibilities.
- Javadoc is mandatory for public classes and should describe their useful contract.
- Other comments or Javadoc belong only where non-obvious logic, decisions, or invariants genuinely require explanation.
- Do not restate obvious behavior in comments.
- Test method names must communicate behavior. Use `@DisplayName` only when it adds clarity.
- Preserve established local conventions whenever an explicit rule does not resolve the style.
