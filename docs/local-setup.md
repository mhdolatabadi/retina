# Running Retina locally with Hormouz AI

Prerequisites: Node.js 22+, Git and **OpenCode v2**. The provider values below match the Chat Completions curl example supplied by the user; they are not evidence of a successful authenticated request.

## Configure credentials

```sh
git clone https://github.com/mhdolatabadi/retina.git
cd retina
cp .env.example .env
chmod 600 .env
```

Edit `.env` to set **only** `HORMOZ_API_KEY=ng-YOUR_ACTUAL_KEY`. Do **not** include the `Bearer` keyword. Never send the key in chat or commit `.env`.

Provider configuration in `opencode.json`:

- **Base URL:** `https://api.hormouz.net/v1`
- **Wire API:** OpenAI-compatible `POST /chat/completions`
- **Upstream model ID:** `anthropic/claude-sonnet-5.5`
- **OpenCode model alias:** `hormoz/sonnet`
- **Key source:** `HORMOZ_API_KEY` environment variable.

Use the full endpoint `https://api.hormouz.net/v1/chat/completions` for direct curl calls, but **not** as `settings.baseURL` in OpenCode, which appends the API path itself.

## Run

```sh
npm test
npm run local:doctor
npm run local:opencode
```

The default primary agent is `discovery`. You can also select `project-manager` or `orchestrator`.

Non-interactive smoke test against the real provider (requires credits and a working key):

```sh
node --env-file=.env scripts/opencode-local.mjs run --standalone --agent discovery "Say READY."
```

To work in a different checkout, set `RETINA_WORKSPACE` to that **absolute** directory in `.env`. The wrapper loads the Retina config and agents from the Retina repository.

## What is not ready

The GitHub checkout includes task-oriented token reports and role definitions. It does **not** yet provide an unattended Jira-to-Gerrit execution pipeline or live token ingestion. The local doctor verifies configuration and binaries, **not** API authentication, actual model tool calling, or model availability on your Hormouz subscription. If provider calls fail, inspect the HTTP error and confirm service credits and tool-calling compatibility with Hormouz.

The project repository is currently public; do not commit organization-specific endpoints, credentials, internal issue data or customer code.

## Independent model selection per Agent

All six Retina roles have independent OpenCode model aliases with role-specific `model:` frontmatter. You can choose a different upstream model ID for each role, **without changing Agent prompts or committing your local selections**.

The initial default for every role is the only Hormouz model ID supplied and confirmed by the API example: `anthropic/claude-sonnet-5.5`. This is a safe configuration default, not a recommendation that every role permanently use the same model.

```sh
npm run models -- list
npm run models -- set discovery anthropic/claude-sonnet-5.5
npm run models -- set coder PROVIDER/MODEL-ID-FROM-HORMOUZ
npm run models -- set reviewer-1 PROVIDER/ANOTHER-MODEL-ID
npm run models -- reset coder
npm run models -- reset-all
npm run local:doctor
npm run local:opencode
```

Supported role identifiers: `discovery`, `project-manager`, `orchestrator`, `coder`, `reviewer-1`, `reviewer-2`.

Use exact model IDs from your Hormouz account's available-model list. A model name typed into the selector is not proof of API availability or tool-calling support; test each desired model with a real request. To check a role explicitly:

```sh
node --env-file=.env scripts/opencode-local.mjs run --standalone --agent discovery "Say READY."
```

**How it works:** `npm run models -- set ...` stores the local mapping in `.retina/role-models.json` (gitignored). The `local:opencode` wrapper writes an effective `.retina/opencode.runtime.json` (also gitignored) with role-specific `modelID` values and passes it to OpenCode. Do not launch `opencode` directly if you want local model overrides to apply.

OpenCode display aliases (e.g. `hormoz/coder`) and actual upstream model IDs (e.g. `anthropic/claude-sonnet-5.5`) are different; when later ingesting live telemetry, record **both** to compare model performance correctly. This feature does not automatically select models or optimize token use.
