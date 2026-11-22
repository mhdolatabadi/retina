# Retina Observability with Grafana, scoped runs and Hormouz tariffs

## Quick start

Requirements: Node.js 22+, OpenCode v2, Docker + Compose. Create a local .env containing HORMOZ_API_KEY and a long unique GRAFANA_ADMIN_PASSWORD. Never commit either secret.

1. Update Retina: git pull origin master
2. Start Grafana/Prometheus: docker compose -f compose.grafana.yml up -d
3. Open http://127.0.0.1:3000 and log in as admin with GRAFANA_ADMIN_PASSWORD.
4. Dashboards -> Retina -> Retina · Agent Token and Hormouz Cost.
5. In another terminal run npm run local:opencode and start a NEW Retina Agent session.
6. When useful, bind the OpenCode session to the Jira issue: npm run task -- bind SESSION_ID IRIS-123 BUG_FIX 3 R2.

Grafana panels include model and role token usage, billable categories, tokens per task type and Jira issue, model-token throughput and tariff-calculated USD costs per role. Prometheus scrapes the exporter every 5 seconds. Grafana is bound to local loopback; exporter/Prometheus have no published host ports. The previous custom dashboard is optional.

## Run isolation

Prior versions recorded globally visible OpenCode step events without attributing their source. This made corporate and personal OpenCode activity appear together.

The launch wrapper now registers a random Retina run ID before spawning OpenCode. The telemetry plugin rejects events without that registered ID or with a different workspace directory, wrong provider (anything other than hormoz) or non-Retina agent role. Completion events are admitted only after a matching accepted step.started event.

Both Grafana metrics and the old read-only dashboard filter persisted events against the run registry. Historical unscoped rows are ignored rather than deleted. If OpenCode omits event location, Retina refuses to attribute it; this avoids falsely counting corporate activity. A resumed OpenCode session might need a fresh step.started event.

Run another OpenCode instance with a company internal model separately; its events must not increase Retina counters. This is covered by automated tests but also needs a real workstation smoke test.

## Hormouz tariff cost vs settled invoice

The first three models have a dated tariff snapshot in pricing/hormouz.json, sourced from the official Hormouz model pages:
- anthropic/claude-sonnet-5.5 discounted $1.20 input / $6.00 output per million tokens.
- openai/gpt-6.1-sol $2.00 input / $10.00 output per million tokens.
- google/gemini-3.8-flash discounted $0.825 input / $4.125 output per million tokens.

Formula: (uncached input * input price + (visible output + reasoning) * output price + cache read * cache read price + cache write * cache write price) / 1,000,000.

If cache read/write tokens are nonzero and their specific Hormouz price has not been verified, cost is unavailable (not zero). Missing usage counters or unknown models are also unpriced. The rate table must be updated whenever Hormouz changes pricing. A manually reviewed local .retina/hormouz-prices.json can override the repository snapshot; never include API keys.

Note: 'tariff-calculated cost' is a mathematical calculation using Hormouz public rates, NOT an authoritative settled charge. Hormouz publishes actual settled charges in the last streaming chunk and in its account billing dashboard. OpenCode's data.cost is not automatically that receipt, and Retina intentionally does not present it as a bill. Full invoice reconciliation requires a provider billing receipt integration. No fictitious USD-to-toman exchange rate is used.

Official sources:
https://hormouz.net/models/anthropic/claude-sonnet-5.5
https://hormouz.net/models/openai/gpt-6.1-sol
https://hormouz.net/models/google/gemini-3.8-flash
https://docs.hormouz.net/reference/billing

## Scope and limitations

- Only executions created via npm run local:opencode generate a registered Retina run ID.
- Telemetry remains on one local machine; Prometheus retention is 30 days.
- A task may be UNATTRIBUTED until explicitly bound to a Jira Issue.
- The cost calculation is fail-closed when cache tariffs are missing.
- The project is public. Keep corporate code, internal URLs and API keys out of GitHub.
- Runtime integration with an authenticated Hormouz/OpenCode instance and Docker must still be validated on your computer.
- No token budgets, auto-routing, auto-model-selection or Jira/Gerrit automation are added here.
