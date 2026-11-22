# Retina Live Observability — OpenCode v2

Retina records OpenCode v2 model-step events locally and displays them on an on-device dashboard. No prompts, generated output, source code or API keys are collected.

## Start locally

Requires Node.js 22+ and OpenCode v2 configured in this repository. The OpenCode 1 plugin format is not compatible.

Terminal A:

    cd retina
    git pull origin master
    npm test
    npm run dashboard

Visit http://127.0.0.1:4318 — the server binds to loopback only, with no cloud storage.

Terminal B:

    cd retina
    npm run local:doctor
    npm run local:opencode

The local wrapper sets OPENCODE_CONFIG_DIR to the Retina agent directory. The OpenCode v2 server plugin is loaded from .opencode/plugins/retina-telemetry/index.js and appends sanitized events to .retina/telemetry/events.ndjson.

**Verification:** make a real model call through OpenCode, then check for newly written entries in the NDJSON file and verify that the dashboard Requests counter increases. GitHub CI can test the parser and local dashboard, but an authenticated Hormouz session on your machine is required for live end-to-end validation.

## Jira task / task type attribution

For an existing session, copy its sessionID from the dashboard, then:

    npm run task -- bind ses_REAL_SESSION IRIS-123 BUG_FIX 3 R2
    npm run task -- list
    npm run task -- unbind ses_REAL_SESSION

Mappings reside in .retina/session-tasks.json and apply retroactively to the recorded steps for that session. This does not create or update any Jira issue. A session without a binding is displayed as UNATTRIBUTED; no task is guessed.

Alternatively, launch an OpenCode instance with process-scoped metadata:

    RETINA_ISSUE_KEY=IRIS-123 RETINA_TASK_TYPE=BUG_FIX RETINA_STORY_POINTS=3 npm run local:opencode

For multiple tasks running concurrently in one process, prefer per-session bindings. A session's explicit binding takes precedence over the process's metadata.

## What is measured

Dashboard refreshes every three seconds and offers filters for Jira issue, task type and time, with grouping by issue, task type, stage/agent, upstream model, orchestrator, risk and status.

- Total tokens = OpenCode v2 uncached input + visible output + reasoning + cache-read + cache-write. These are disjoint fields in the current v2 schema.
- Total tokens per active minute = measured tokens / sum of completed model request durations. Overlapping requests both contribute their own duration.
- Total tokens per wall minute = measured tokens / elapsed time between first start and last completion.
- Model generation tokens/sec = (visible output + reasoning) / (stream completion time − first-token time), when both timing events were observed.
- TTFT = first-token event observed time − model dispatch time, measured through event observation.
- A step.ended event can occur after tools settle; step.streamed is used for generation end instead.
- Task averages include only steps attributable to a known issue; UNATTRIBUTED is never distributed across tasks.
- Unknown or missing counters remain null, shown as an em dash rather than zero.
- Model aliases resolve via the effective .retina/opencode.runtime.json, falling back to opencode.json.
- Cost is provider-reported USD; the dashboard never guesses a cost from a price list.

## Security, reliability and limits

- Listener is restricted to 127.0.0.1 (port 4318; configurable with RETINA_DASHBOARD_PORT). It has no API endpoint for writing telemetry or changing bindings.
- Data resides in git-ignored .retina/ only.
- The append-only NDJSON file survives restarts. Duplicate step completion events are deduplicated by session+assistant-message ID.
- The local file store is intended for a single workstation filesystem, not shared NFS or several hosts.
- The dashboard limits source files to 100 MB, after which rotation or archival is required.
- There is no model optimization, token budget, Jira sync or full automated Gerrit review in this feature.
- OpenCode and Hormouz live API behavior must be verified on the user's own installation.

Older static reports remain supported via the existing usage CLI.
