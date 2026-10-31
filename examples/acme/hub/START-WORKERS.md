# Start your AI workers

Purpose: how to open each AI worker the way you chose to run it. Every worker has its own folder, its own account and its own start-up brief. Never share a folder between two workers.

## tech-lead - acme-techlead-bot (for dana-owner)

- Role: tech-lead. Account: acme-techlead-bot. Brief: `examples/acme/hub/briefs/tech-lead-startup.md`.
- Run mode: editor window.
  1. Open the folder `<folder for dana-owner-tech-lead-1>` in its own editor window.
  2. If you use VS Code, copy `workers/dana-owner-tech-lead-1/vscode-settings.json` from the hub to `<folder for dana-owner-tech-lead-1>/.vscode/settings.json`, so this window has the color #1d4ed8 and the title "tech-lead - acme-techlead-bot". Add `.vscode/settings.json` to the folder's `.git/info/exclude` so it is never committed.
  3. Start your coding agent in that window and paste the start-up brief.

## qa-lead - acme-qa-bot (for dana-owner)

- Role: qa-lead. Account: acme-qa-bot. Brief: `examples/acme/hub/briefs/qa-lead-startup.md`.
- Run mode: terminal.
  1. `cd <folder for dana-owner-qa-lead-1>`
  2. Start your coding agent there and paste the start-up brief.

## researcher - acme-research-bot (for dana-owner)

- Role: researcher. Account: acme-research-bot. Brief: `examples/acme/hub/briefs/researcher-startup.md`.
- Run mode: terminal.
  1. `cd <folder for dana-owner-researcher-1>`
  2. Start your coding agent there and paste the start-up brief.

## ai-developer - acme-dev-bot (for dana-owner)

- Role: ai-developer. Account: acme-dev-bot. Brief: `examples/acme/hub/briefs/ai-developer-startup.md`.
- Run mode: editor window.
  1. Open the folder `<folder for dana-owner-ai-developer-1>` in its own editor window.
  2. If you use VS Code, copy `workers/dana-owner-ai-developer-1/vscode-settings.json` from the hub to `<folder for dana-owner-ai-developer-1>/.vscode/settings.json`, so this window has the color #166534 and the title "ai-developer - acme-dev-bot". Add `.vscode/settings.json` to the folder's `.git/info/exclude` so it is never committed.
  3. Start your coding agent in that window and paste the start-up brief.

## security-lead - acme-security-bot (for dana-owner)

- Role: security-lead. Account: acme-security-bot. Brief: `examples/acme/hub/briefs/security-lead-startup.md`.
- Run mode: background (headless: read-only).
  1. Preview first: `node tools/run-role.mjs --config examples/acme/hub/qa-projects.json --hub examples/acme/hub --role security-lead --person dana-owner --task "<the task>"`
  2. Add `--apply` to run it, or schedule it (see `docs/PANEL.md`). Background workers review, test and report; they never merge, spend or push to production.

## ai-developer - sam-dev-bot-1 (for sam-dev)

- Role: ai-developer. Account: sam-dev-bot-1. Brief: `examples/acme/hub/briefs/ai-developer-startup.md`.
- Run mode: editor window.
  1. Open the folder `<folder for sam-dev-ai-developer-2>` in its own editor window.
  2. If you use VS Code, copy `workers/sam-dev-ai-developer-2/vscode-settings.json` from the hub to `<folder for sam-dev-ai-developer-2>/.vscode/settings.json`, so this window has the color #15803d and the title "ai-developer - sam-dev-bot-1". Add `.vscode/settings.json` to the folder's `.git/info/exclude` so it is never committed.
  3. Start your coding agent in that window and paste the start-up brief.

## ai-developer - sam-dev-bot-2 (for sam-dev)

- Role: ai-developer. Account: sam-dev-bot-2. Brief: `examples/acme/hub/briefs/ai-developer-startup.md`.
- Run mode: editor window.
  1. Open the folder `<folder for sam-dev-ai-developer-3>` in its own editor window.
  2. If you use VS Code, copy `workers/sam-dev-ai-developer-3/vscode-settings.json` from the hub to `<folder for sam-dev-ai-developer-3>/.vscode/settings.json`, so this window has the color #047857 and the title "ai-developer - sam-dev-bot-2". Add `.vscode/settings.json` to the folder's `.git/info/exclude` so it is never committed.
  3. Start your coding agent in that window and paste the start-up brief.

## ai-developer - sam-dev-bot-3 (for sam-dev)

- Role: ai-developer. Account: sam-dev-bot-3. Brief: `examples/acme/hub/briefs/ai-developer-startup.md`.
- Run mode: editor window.
  1. Open the folder `<folder for sam-dev-ai-developer-4>` in its own editor window.
  2. If you use VS Code, copy `workers/sam-dev-ai-developer-4/vscode-settings.json` from the hub to `<folder for sam-dev-ai-developer-4>/.vscode/settings.json`, so this window has the color #065f46 and the title "ai-developer - sam-dev-bot-3". Add `.vscode/settings.json` to the folder's `.git/info/exclude` so it is never committed.
  3. Start your coding agent in that window and paste the start-up brief.
