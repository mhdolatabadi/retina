# Token observability (v0.1)

Retina observes token usage and throughput; it does **not** limit budgets, optimize token usage, or change models or scheduling.

## Dimensions

Group or filter by Jira issue, task type, model, agent, orchestrator, stage, status, risk and approved Story Points. Each invocation records input/output tokens and, where provided, cached/reasoning tokens, duration, generation duration and time to first token. Unknown values stay unknown rather than being fabricated.

## Rates

- **Total tokens / active minute:** (input + output) / sum of invocation durations, in minutes. Includes model wait and tool execution within those invocations.
- **Output tokens / active second:** output tokens / sum of invocation durations, in seconds; **not** pure decoding speed.
- **Total tokens / wall minute:** tokens / elapsed time from first run start to last run end, including gaps and overlapping invocations.
- **Output tokens / generation second:** output / measured generation time, available **only** when actual generation duration is recorded.
- **Time to first token:** available only from measured provider/runtime timings.
- **Tokens / Story Point:** observed task tokens divided by its human-approved Story Point estimate. Descriptive only, not a productivity score.

Cached and reasoning counters may be subsets of input/output; never add them again. Reports include telemetry completeness and avoid misleading rates when any required input is missing.

## Use

Requires Node.js 22 or newer; no dependencies.

```sh
npm test
node src/report.js --state path/to/state.json --group-by issue --issue PROJ-123
node src/report.js --state path/to/state.json --group-by taskType
node src/report.js --state path/to/state.json --group-by stage --task-type Bug
node src/report.js --state path/to/state.json --group-by model
node src/report.js --state path/to/state.json --report tasks
```

State format: `{ "usage": [ { "issueKey":"PROJ-123", "taskType":"Bug", "storyPoints":3, "agentId":"coder", "stage":"IMPLEMENTATION", "model":"...", "inputTokens":100, "outputTokens":20, "durationMs":1500, "startedAt":"2026-11-21T10:00:00Z" } ], "tasks": [] }`.

This code provides **read-only analytics on recorded measurements**. End-to-end live OpenCode/OpenRouter ingestion and a visual dashboard are not part of this PR. Do not commit runtime state, prompts, provider secrets, or private customer data.
