# Changelog

Purpose: the release history of Build@Scale AI Dev Team. Newest first.

## Unreleased

Rules from a week of running the team (promoted from a live team, 2026-11-01):
- `docs/PROTOCOL.md` section 5.3 **the security read**: a pull request in a security area (sign-in, secrets, access, payments, schema, security config, deploy) needs the security role's read of its exact head, in a fixed first-line form (`Security read by <name> (...): CLEARED|FINDINGS at <sha>`); a new commit makes it stale.
- `tools/t3-check.mjs <owner/repo> <number>`: the merge gate for it (exit 0 = not a security area or cleared on the current head). `pr-watch` tags security-area pull requests with the read's state when `security_read.enabled` is true in the config; `security_read.areas` adds areas. New `tools/lib/t3.mjs`, `tests/t3.test.mjs`, config validation for `security_read`.
- Section 5.4: a pull request size limit is a guide, not a blocker; judge the grouping.
- Section 12 **design before build**: every AI follows the pipeline and nothing is built before a comment ending `Design approved` from the tech lead or the decision's owner (a security-area design is read by the security role first). The old compatibility section is now 14.
- Section 13: refresh local copies and dashboards after every merge (with a stale-copy check in the watches); archived projects leave the live data; a session's permission prompt belongs to its person, and an AI never asks a peer to do an action it was refused.
- Section 9 rules 6 to 8: compliance refreshed weekly with the audit, stable finding ids (matched to issues by id plus title), verify fixes on the exact head and close only where the owner allowed it.
- Roles: tech-lead rules 11 to 15, ai-developer rules 13 to 16, qa-lead rules 12 and 13, security-lead rules 11 to 16 follow from the above.
- `tools/upgrade.mjs --config <file>`: read the organization config from another place than `<hub>/qa-projects.json` (for a hub whose tools already use a config file elsewhere). It still only reads the config.
- `docs/IDENTITIES.md`: controls by role on repositories (install scope, what each role may and may not do, who may merge) and the repository rules a person sets once per repository (protected branches, CODEOWNERS on sensitive paths, no Administration for any App, quarterly install review). `SETUP.md` shows these to the person.

## 0.3.0 - 2026-10-31

Every AI gets its own GitHub identity.

Added:
- AI identities: each worker (organization roles and `people` roles) may have an `app` {id, key_file, owner} and an `identity` ("app" or "machine-user"). `account` stays the bot's login, and `<slug>[bot]` is accepted for accounts, `ai_accounts` and a project's `lead` only. The config holds the key's path, never the key; any other field under `app` is refused.
- `doctor`: errors when two workers share one App or one account, when an App key file is inside a git repository or the hub or config folder, or is not a `.pem`; a warning for a team worker with no identity (it would act under a person's login). New `--check-keys` checks the key files exist and are not readable by other users (existence only on Windows). Key contents are never read.
- `tools/as-app.mjs`: runs one command as a worker's own GitHub App (`GH_TOKEN` set to a one-hour token, `GITHUB_TOKEN` removed, no shell, the token never printed). `--dry-run true` shows what would run.
- `tools/lib/identities.mjs`: the GitHub App permission set for each role, as data (never Administration, Secrets, Environments, Packages or any organization or account permission; a tech lead gets Contents write only when it leads a project with merge power), and the App request the onboarding to-do uses.
- `onboard`: the to-do list has an "AI identities" section per worker (App name, permissions, repositories, key handling, how to verify), and `START-WORKERS.md` shows the `as-app` command for a worker with an App.
- `tools/app-token.mjs`: gets a one-hour GitHub App installation token from the App's ID and private key file, so an AI can act as its own App instead of a person's login. The key is never printed; only the token is.

## 0.2.0 - 2026-10-31

Keeping the kit current, and policy that fits real teams.

Changed:
- Decisions can be shared by several people and split by area (`covers.decision` as a list, `decision_areas`). Every decider must be a human owner of the project.
- A project can be `archived`, or planned (no repositories yet, not watched). Such a project is dormant: it needs no lead, merge policy or coverage until it becomes active.

Added:
- Version marker: `onboard --apply` writes `.bas-aidevteam-version` and `.bas-aidevteam-manifest.json` (a hash of every kit template file as written) into the hub.
- `tools/upgrade.mjs --hub <folder> [--apply] [--force]`: shows what changed in the kit and updates only the template files you never edited; an edited file is kept and the kit's new text is written next to it as `<name>.kit-new`. Dry run by default.
- `doctor --hub <folder>` warns when a hub has no marker or an older version than the kit.
- `docs/MAINTAINING.md`: how the kit stays current (promotion pass from a live team, release gate, version rules, upgrading a team).
- `templates/hub/learning/promotion-candidates.md`: the log a team keeps of lessons that may belong in the kit.

## 0.1.0 - first draft release

First version of the kit. It is a draft: expect the protocol and the tools to change before 1.0.

Added:
- Five role briefs: tech lead, AI developer, QA lead, security and compliance lead, AI researcher.
- The hub: a local folder with a runbook, config, a queue of decisions and daily briefings.
- The interop protocol (comment formats, clearance, carry-forward, ownership check, review tiers).
- The developer kit, the QA kit and the researcher kit.
- Templates for the hub and for repositories (pull request template, issue templates, code owners, baseline CI, labels).
- Solo and team modes; per-project lead AI, merge policy, members; people with their own chosen AI workers (several of one role allowed).
- Four required functions per project (review, test, security, decision), each covered by a role or a named person; `tools/doctor.mjs` fails the setup when one is missing.
- `tools/check-public.mjs` scans for names, tokens, emails, paths and issue numbers before you publish; it needs your own deny list (`--denylist`), or `--allow-example` to accept the placeholder one.
- Tools: `tools/onboard.mjs`, `tools/doctor.mjs`, `tools/pr-watch.mjs`, `tools/question-watch.mjs`, `tools/merge-watch.mjs`, `tools/check-public.mjs`.
- Workers run where you like (`surface`: editor, terminal or background): `START-WORKERS.md` per worker, and a color and window title per VS Code worker.
- EXPERIMENTAL: `tools/run-role.mjs` (background runs, read-mostly, dry run first) and `tools/panel.mjs` (a local control panel); both optional, see `docs/PANEL.md`. Tested, but not yet used with a real coding agent or checked in every browser.
- License: CC BY 4.0 (see LICENSE).
- `SETUP.md`: the guided setup a coding agent follows from one pasted prompt (forms with recommendations, dry run, doctor, mandatory Build@Scale with AI in every project).
- Docs: architecture, security model, getting started, roles.

Known gaps:
- No hosting for AI sessions, no dashboard, no billing. The kit says where each belongs and leaves the choice to you.
