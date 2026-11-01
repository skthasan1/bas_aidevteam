# Keeping the kit current

Purpose: how lessons from a live team reach the kit, and how a kit release reaches a team that already uses it. Two directions, one rule: people decide, and nothing private leaves a team.

## A. From a live team into the kit

### 1. Keep a promotion-candidates log

Every team keeps `learning/promotion-candidates.md` in its hub (the onboarding tool creates it from `templates/hub/learning/`). When a change to a rule, role, template or tool turns out to be worth making, add an entry:

| Field | Content |
|---|---|
| Date | when it changed |
| What changed | the file or rule, one line |
| Why | what went wrong or was missing |
| Where it applies | roles, tools or templates affected |
| Generalised rule | one or two sentences, no names, with the reason |
| Status | `candidate`, `promoted` (kit pull request and version) or `rejected` (why) |

### 2. Weekly promotion pass

Once a week the tech lead role goes through the candidates and, for each one worth sharing:

1. removes names, projects, dates, incidents, paths, numbers and anything a stranger could trace back to your team;
2. rewrites it as a general rule with its reason (a rule without a reason is not promoted);
3. checks it does not already exist in the kit, and where it belongs (a role brief, `dev/`, `qa/`, `research/`, a template, a tool);
4. opens a pull request on the kit with the change, a test where it touches a tool, and a changelog line;
5. sets the entry to `promoted` with the pull request, or `rejected` with the reason.

The AI prepares the pull request. A named person reads it and decides.

### 3. The gate before every kit change

All of these, on the exact commit that will be merged:

1. Tests: `node --test "tests/*.test.mjs" "research/tests/*.test.mjs"` is green.
2. Doctor on the example: `node tools/doctor.mjs --config examples/acme/qa-projects.json --hub examples/acme/hub` reports OK with no warning.
3. The example hub is regenerated when templates or onboard changed: `node tools/onboard.mjs --config examples/acme/qa-projects.json --target examples/acme/hub --apply --force`, then delete the `.bak` file.
4. Public check with the maintainer's own private deny list: `node tools/check-public.mjs . --denylist <your private list>`. The list stays outside the repository (or in the ignored `.private/` folder) and is never published.
5. A scan of the whole git history, not only the current files, with the same deny list, because a name removed in the last commit is still public in the one before. If anything is found in history, stop: the history must be rewritten before release, by a person who has agreed to that one rewrite.
6. Version bump (below), changelog entry, and a person's review of the pull request.

### 4. Version bump rules

| Change | Bump | Examples |
|---|---|---|
| Fixes and wording | patch (0.1.0 to 0.1.1) | a typo, a clearer sentence, a bug in a tool |
| New rules, roles, templates or tools, backward compatible | minor (0.1.0 to 0.2.0) | a new role brief, a new check, a new optional config field |
| Anything that breaks an existing config or hub | major (0.x to 1.0, then 2.0) | a renamed or removed config field, a changed protocol format |

Write the changelog entry under "Unreleased" while the change is in review. At release, rename the section to the version and date, and set `VERSION`.

### 5. Release

A named person releases: they tag the version and publish. An AI never releases alone, and never runs the gate on its own say-so as the only approval.

**Every version change is published.** A new version is never left only in a branch: after the release pull request is merged, the named person (or an AI on their explicit word for that release) tags the merge commit `v<version>` and publishes a release whose notes are the changelog section of that version, copied unchanged. The tag, the `VERSION` file, `package.json` and the changelog heading must name the same version. A team upgrades from a published version, never from a branch.

## B. From the kit into a team

1. **Version marker.** `onboard --apply` writes `.bas-aidevteam-version` (the kit version) and `.bas-aidevteam-manifest.json` (a hash of every kit template file as written) into the hub. Commit neither to a public place; they contain no secret, but they belong to the hub.
2. **Preview.** `node tools/upgrade.mjs --hub <hub folder>` is a dry run. It shows installed against available version, the changelog sections you have not seen, and for each template file one of: unchanged, updated in kit (safe to update), edited in your hub (kept), new in kit, removed in kit.
3. **Apply.** `node tools/upgrade.mjs --hub <hub folder> --apply` updates only files you never edited. A file you edited is never overwritten: the kit's new text is written next to it as `<name>.kit-new`, with a short hint of the first difference. Merge what you want by hand, then delete the `.kit-new` file. The tool never touches `qa-projects.json`, briefs, notes, the queue, briefings or runs, and writes only inside the hub.
4. **Check.** Run `node tools/doctor.mjs --config <hub folder>/qa-projects.json --hub <hub folder>` after an upgrade, as you would run an audit. Doctor warns when the hub has no marker or an older version than the kit.
5. **Older hubs.** A hub made before the marker existed cannot be upgraded in place: run onboard into a new folder and copy your own files (queue, notes, briefings) across.

Role briefs in `briefs/` are generated from `roles/`. They are not tracked as template files, so after a release that changes a role, regenerate them into a scratch folder with onboard and compare by hand.

## Checklist for a maintainer

- [ ] Change is general: no names, projects, keys, paths or incident details.
- [ ] A test covers every new guard and fails without it.
- [ ] Tests green; doctor on the example OK; example hub regenerated.
- [ ] Public check with the private deny list OK; whole-history scan clean.
- [ ] Version bumped by the rules above; changelog entry written.
- [ ] A named person reviewed and will release.

## What must never be promoted

- Private names: people, companies, customers, accounts, handles, email addresses.
- Project names, repository names, product names and anything that identifies what a team builds.
- Keys, tokens, passwords, URLs with secrets, internal hostnames and local paths.
- Incident details: who did what, when, which customer was hit, exact numbers. Keep the lesson and its reason; drop the story.
- Anything under a confidentiality wall between projects, even if made anonymous: if the rule only makes sense with the story, it stays in the hub.
- Decisions that belong to one team's owner (budgets, vendors, access).
