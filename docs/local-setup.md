# Run Retina locally with Hormoz AI

Use **Node.js 22+**, Git, and OpenCode v2. Install OpenCode from https://opencode.ai/docs/.

Create a local `.env` file in the Retina root:
```sh
cp .env.example .env
chmod 600 .env
```
Fill in `HORMOZ_API_KEY`, `HORMOZ_BASE_URL`, and `HORMOZ_MODEL_ID` using the **official Hormoz AI panel/docs**. Do not post the key in chat or commit it. These endpoint/model details have NOT been independently verified; do not guess the URL. For a non-local endpoint, HTTPS is required. This config requires OpenAI-compatible Chat Completions and compatible tool calling.

```sh
npm test
npm run local:doctor
npm run local:opencode
```

Within OpenCode, choose the `discovery` agent to clarify requirements. The configured model is `hormoz/coding` (an alias; the upstream model ID comes from your environment).

For a minimal noninteractive provider test:
```sh
node --env-file=.env scripts/opencode-local.mjs run --standalone --agent discovery "Say READY."
```

To work in another repository, set `RETINA_WORKSPACE` to its **absolute** local checkout path. The wrapper loads Retina's agents and provider settings from this repository.

**Current limitation:** This GitHub repository contains OpenCode agent definitions and token reporting, but NOT a connected unattended Jira-to-Gerrit pipeline. No live Jira issue creation, Gerrit votes or complete event ingestion should be assumed. The downloadable local Agent-Native bundle is a separate experimental scaffold with more CLI policies.

If authentication fails, verify the provider-issued Base URL, model ID, remaining credits and whether tool-calling is supported. Avoid sharing API headers, credentials or private source files.
