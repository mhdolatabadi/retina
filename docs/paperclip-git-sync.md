# Paperclip ⇄ Retina: Git-backed agents

Paperclip is the execution and assignment manager. Retina's Git repository is the **versioned source of truth** for the six specialist roles (not for Paperclip's existing CEO or other company agents). This integration is safe-by-default and does not store ChatGPT OAuth credentials, API keys, Paperclip IDs, or remote host paths in Git.

## What stays in Git

- `paperclip/agents/<role>/AGENTS.md` — complete specialist instructions. These are the canonical prompt files. Do not edit `.retina/paperclip/instructions/*.md`: that was the old generated, ignored location.
- `paperclip/agents/<role>/settings.json` — created by the first `save`, containing **only** the following portable options: agent name, title, capability description, adapter type, selected model, heartbeat enabled flag and monthly budget in cents.
- `.retina/paperclip/git-sync.json` — local-only ignored mapping from Retina role to Paperclip agent ID, plus last-sync baseline. Never commit this file.

**Not copied to public Git:** ChatGPT login, AI connection grants and IDs, credentials, custom environment variables, service secrets, agent runtime sessions, workspace paths, company IDs, permission grants, skills, avatar assets and other Paperclip-specific settings. Paperclip remains authoritative for those. For a full Paperclip backup, use its official Company Export separately, stored outside this public repository.

## First-time setup — existing Paperclip agents

Requires Paperclip on the **same machine and disk** as this Retina checkout, an authenticated `paperclipai` CLI and instance-admin permission to configure external instructions bundles.

    cd retina
    git pull origin master
    npm test
    npm run paperclip:sync -- status --company-id YOUR_COMPANY_ID

**Link once** after deciding what to do with the current Paperclip Identity/AGENTS.md:

    # Preserve the checked-in Retina prompts (good for newly imported roles):
    npm run paperclip:sync -- link --company-id YOUR_COMPANY_ID --apply --prefer-retina

    # OR import your already-customized Paperclip Identity prompt into Retina:
    npm run paperclip:sync -- link --company-id YOUR_COMPANY_ID --apply --prefer-paperclip

Choose **one**, never both. The command first backs up the managed Paperclip AGENTS.md locally to ignored `.retina/paperclip/backups/<role>-before-link.md`, then switches each role to Paperclip's documented **external instructions bundle** using `requireExistingEntry: true`. It never creates a CEO or an Agent. It refuses to overwrite an unrelated external bundle.

Without `--apply`, link performs a dry run. If existing managed instructions differ and neither preference is supplied, it fails instead of guessing. For a previously customized role, inspect and compare the two versions before choosing; importing the Paperclip prompt replaces that role's tracked file. The current version of the linker does not automatically merge two different instruction files.

**Important:** In an external bundle, edits in Paperclip's **Agent → Identity** are written to the actual `AGENTS.md` in your Retina checkout. They become local Git changes immediately. Agents in this mode do not get Paperclip's managed, persistent personal folder behaviour: use the managed mode if that functionality matters more than repo-based instructions.

## Daily use: save everything portable to Retina

After changing instructions or model/title/budget in Paperclip, run:

    npm run paperclip:save

This reads the existing six Paperclip agent configurations and saves the allowlisted settings to `paperclip/agents/*/settings.json`. It never overwrites an unsent local settings edit if the remote did not change, and refuses changes on both sides that cannot be reconciled. Identity edits are already in the shared files if you linked external bundles.

To **commit and push** those tracked agent files to your Retina GitHub repository in one explicit step:

    npm run paperclip:publish

This performs `git commit --only` for `paperclip/agents`, then `git push origin HEAD`. Other staged files are not committed. Git push failures or non-fast-forward updates are not forced. **The Retina repository is public: inspect `git diff -- paperclip/agents` first and never store company-private prompts or secrets here.**

## Change an Agent in Git, apply it back to Paperclip

Edit `paperclip/agents/<role>/AGENTS.md` in your editor; the next Paperclip run reads it automatically through the linked bundle. To change a setting, edit `paperclip/agents/<role>/settings.json` and apply:

    npm run paperclip:apply -- --apply

Only name, title, capabilities, model, heartbeat enabled flag and budget are sent. Each update uses Paperclip's **expectedConfigurationRevision**, so it rejects concurrent edits rather than silently overwriting them. To avoid stale writes it also compares with `.retina/paperclip/git-sync.json` from the previous save.

Changing the agent's **Codex/OpenCode runtime, subscription connection, permissions, agent manager, machine or workspace is deliberately NOT automated**. Perform those changes in Paperclip, then run `npm run paperclip:save` to update the portable snapshot where relevant. Adapter changes require Paperclip's own validation and authentication.

## New agents

`npm run paperclip` previews six specialized workers, and `npm run paperclip -- --company-id ID --ceo-id EXISTING_CEO_ID --apply` installs them (only if those names do not already exist). Its instructions point at `paperclip/agents/<role>/AGENTS.md` directly, and it **never generates or overwrites those tracked prompts**. Then run the one-time link, followed by save.

## Limits and recovery

- `save` and `apply` are manually triggered; this version does not claim automatic background GitHub backups. Paperclip Identity edits are immediate in the local checkout but need publish for remote persistence.
- Stable agent IDs and conflict baselines are ignored in `.retina/`; on a second Mac with no state, first `status`/`link` and then `save` are needed to establish the local binding.
- The managed bundle stores persistent Agent files across tasks, unlike an external bundle. Use a dedicated private folder if that data matters.
- A failed `link`/`apply` halfway through can leave some roles linked or changed. Commands are idempotent for already-linked bundles; review the status before retrying.
- For complex settings not represented in our portable allowlist, use Paperclip's configuration revisions and official `paperclipai company export YOUR_COMPANY_ID --out ../paperclip-backup` for a private comprehensive backup.
- If Paperclip runs in Docker, a server without access to your Mac's Retina checkout cannot use the external path. Mount the repository at a stable path into the Paperclip process or keep managed bundles and import explicit snapshots; do not assume the local files are visible remotely.

Official docs:
- https://docs.paperclip.ing/guides/org/agents/
- https://docs.paperclip.ing/reference/api/agents/
- https://docs.paperclip.ing/reference/cli/agent/
- https://docs.paperclip.ing/guides/power/export-import/
