# AI identities on GitHub

Purpose: give every AI worker its own GitHub identity, so each comment, review and merge says which worker did it, and so no AI acts under a person's login.

Why: with one shared login, nobody can tell who wrote what, a leaked token exposes everything the person can do, and a person cannot revoke one AI without losing their own access.

The guided setup (`SETUP.md`, phase 3b) walks you through this. This page is the reference.

## 1. Choose how each AI gets its identity

| | GitHub App (recommended) | Machine user |
|---|---|---|
| What it is | An App you register once. It acts as `<name>[bot]`. | A second GitHub account used by one AI. |
| Extra seat or account | No | Yes, and an organization seat for private repositories |
| Token lifetime | One hour, fetched on demand | Up to a year, renewed by hand |
| Permissions | Set on the App, installed on chosen repositories | Set by team and token |
| Counts as a required reviewer | Probably not (check your repository rules) | Yes |
| Setup effort | A small script, included (`tools/app-token.mjs`) | `gh auth login` |

Use an App unless you need the AI's approval to count as a required review, or you cannot install Apps on your organization. Mixed setups are fine.

## 2. Create a GitHub App (one per AI)

1. GitHub: your profile picture, Settings, Developer settings, GitHub Apps, New GitHub App. (For an organization-owned App, use the organization's settings instead.)
2. Name: `<org>-ai-<role>`, lowercase. The name must be unique across GitHub. `onboard` writes a suggested name for each worker in `ONBOARDING-TODO.md`.
3. Description (adapt): "AI <role> for <org>'s projects. Works through GitHub only, signs every comment as an AI assistant, and never merges, spends or changes settings without a named person's yes."
4. Homepage URL: any page you control, such as the kit's repository.
5. Webhook: turn Active off.
6. Repository permissions: the set for the role (section 3). Leave everything else at No access.
7. Where can this be installed: **Only on this account** if the AI works on one owner's repositories. **Any account** if one AI must work on both a personal account and an organization (an App limited to one account cannot be installed on the other). "Any account" makes the App's install page public. It does not give anyone access to your repositories: access depends on the private key and on who installs it.
8. Create the App, then **Generate a private key**. A `.pem` file downloads.
9. Move the `.pem` to a folder outside every repository (for example `~/.ai-keys/`). Never open it in a chat, never paste it, never commit it. `doctor` fails if a key file sits inside a git repository.
10. Note the **App ID** (a number, not secret).
11. Install the App: the App's page, Install App. Choose **Only select repositories** and pick only the repositories this AI works on. An organization owner must approve the install on the organization.

You give the agent only two things: the App ID and the path of the `.pem`. Put them in the config as:

```json
{ "name": "tech-lead", "account": "acme-ai-tech-lead[bot]", "app": { "id": 123456, "key_file": "~/.ai-keys/acme-ai-tech-lead.pem" } }
```

## 3. Permissions by role

Always: Metadata read. Never: Administration, Secrets, Environments, Packages, or any organization or account permission.

| Role | Repository permissions | Notes |
|---|---|---|
| Tech lead | Contents read; Pull requests write; Issues write; Checks read; Commit statuses read; Actions read | Add **Contents write** only for projects where the lead may merge. Merging needs it. |
| AI developer | Contents write; Pull requests write; Issues write; Checks read; Commit statuses read; Actions read | Workflows write only if it edits CI files; every CI change is a pull request a person reads. |
| QA lead | Contents read; Pull requests write; Issues write; Checks read; Commit statuses read; Actions read | |
| Security lead | Contents write; Pull requests write; Issues write; Checks read; Commit statuses read; Actions read | Contents write is for audit results, which go to the security repository by pull request. Branch rules still require a person to merge. |
| Researcher | Contents write; Pull requests write; Issues write | Contents write is for the research repository, by pull request. |

An App has the same permissions on every repository it is installed on. If an AI must only comment on some repositories and push on others, either install it on fewer repositories or register a second App for the second job.

### The same list in the order GitHub's form shows it

When you create or edit an App (Permissions, Repository permissions), set these and leave every other permission at **No access**. "R" is Read-only, "R/W" is Read and write.

| Permission | Tech lead (review only) | Tech lead (may merge) | AI developer | QA lead | Security lead | Researcher |
|---|---|---|---|---|---|---|
| Actions | R | R/W | R | R | R | No access |
| Administration | No access | No access | No access | No access | No access | No access |
| Checks | R | R | R | R | R | No access |
| Commit statuses | R | R | R | R | R | No access |
| Contents | R | R/W | R/W | R | R/W | R/W |
| Issues | R/W | R/W | R/W | R/W | R/W | R/W |
| Metadata | R (automatic) | R (automatic) | R (automatic) | R (automatic) | R (automatic) | R (automatic) |
| Pull requests | R/W | R/W | R/W | R/W | R/W | R/W |
| Workflows | No access | R/W (only if it edits CI files) | R/W (only if it edits CI files) | No access | No access | No access |

Notes:
- **Actions R/W** lets an App re-run, cancel, disable and enable workflows. Read is enough to see results.
- **Workflows R/W** is the only permission that lets an App change files under `.github/workflows/`. Every such change is a pull request a person reads.
- **Optional for the security lead:** Code scanning alerts: R, Dependabot alerts: R, Secret scanning alerts: R, if you want it to read GitHub's own findings.
- **Everything else** (Attestations, Codespaces, Custom properties, Dependabot secrets, Deployments, Discussions, Environments, Merge queues, Packages, Pages, Projects, Repository security advisories, Secrets, Variables, Webhooks) stays **No access**. Under Account and Organization permissions, set nothing.

Two permissions deserve care:
- **Workflows (write)** lets an App change CI files, which run with the repository's secrets. Keep it off unless the AI builds CI, and put every such change through a pull request a person reads (review tier T2).
- **Actions (write)** lets an App re-run, disable or enable workflows. Reading results needs only Actions read.

## 4. Use it

```
node tools/app-token.mjs --app-id <id> --key-file <pem> --repo owner/name
node tools/as-app.mjs --config qa-projects.json --role tech-lead --owner <org> -- gh pr list -R <org>/<repo>
```

`as-app` fetches a one-hour token and runs the command with it set, without printing it. Tokens are cached until five minutes before they expire.

Verify a new identity before relying on it:
1. Run `doctor` (it checks one identity per AI and that the key is outside every repository).
2. Fetch a token for each owner the App is installed on.
3. Post one test comment on a pull request you choose. It must show `<name>[bot]`.

## 5. Rules that follow

- One identity per AI. Two workers never share an App or a login.
- The key never leaves its file. Nobody, human or AI, pastes it, prints it or asks for it.
- If a key may have leaked: delete the key in the App's settings first (that revokes every token made from it), then generate a new one.
- Branch rules still apply to Apps. An App can only bypass a rule if you add it as a bypass actor, and that is a person's decision per repository.
- Merging without a human review: an App's approval may not satisfy a required review. Decide per repository whether a person approves and the AI merges, or whether to add the App as a bypass actor.

## 6. Controls by role on repositories

An App's permissions say what the AI can do. Install scope and repository rules say where and how far. Set all three. The first column group is enforced by GitHub; the last is the rule the AI follows and `doctor` or a person checks.

| Role | Install on | May do | May not do | Merge |
|---|---|---|---|---|
| Tech lead | Every repository it reviews | Read code; review, comment, request changes; raise, label and assign issues; run the watches | Push code; edit CI files; change settings; spend; grant access | Only where the project's `merge` policy allows it, only into the integration branch (`develop`), never into `main` or a production branch, never its own work, never a change in a sensitive area (login, payments, database schema, deploy, production config) |
| AI developer | Only the repositories it is assigned | Create branches from fresh `develop` named for its issue; open pull requests into `develop`; comment on its own issues | Push to `develop` or `main`; merge, including its own pull request; change login, payments, schema or deploy files without the owner and code owners; edit CI files unless Workflows write was granted, and then only by pull request a person reads | Never |
| QA lead | Repositories it tests, read and comment | Read code; comment "verified" or "still fails" on issues; post the test report | Edit, commit, push or branch; raise, close, relabel or reprioritise issues (the tech lead raises them); use production keys or data | Never |
| Security lead | The security repository, plus repositories where it raises findings | Read code; write audit results to the security repository by pull request; raise findings as issues with a severity label (not for confidential projects: those stay in the hub) | Edit product code; publish an exploit path in a public issue; mark a control as met, accept a risk or grant an exception without a person | Never |
| Researcher | The research repository only | Open pull requests with reports, registry entries and evidence specs; draft issues for the tech lead to raise | Comment or raise issues in product repositories; run tests in a live project; spend past the owner's stop line; commit pictures, clips or audio | Never |

## 7. Repository controls to set (a person does these once per repository)

These are what make the table above true even if an AI makes a mistake.

1. **Protect `develop` and `main`** with a branch ruleset: pull request required, at least one approval, no force push, no deletion. Add required status checks where CI exists.
2. **No bypass for AIs by default.** Only add an App as a bypass actor on a repository where the owner has decided that AI may merge past a required review, and write that decision in the project's policy (`merge`).
3. **CODEOWNERS** on sensitive paths (login, payments, schema, deploy, production config, CI files), so a person's review is required there whatever any AI does.
4. **Restrict who can change CI files.** Treat any pull request that edits `.github/workflows/` as review tier T2: a named person reads the exact head.
5. **Keep Administration off every App.** Changing repository settings, visibility, branch rules and collaborators stays with people.
6. **Select repositories at install.** Do not install an AI on repositories it has no reason to touch. A broad install is a choice the owner makes knowingly, with the rulesets above doing the real protection.
7. **Review the installs every quarter.** For each App: list repositories, permissions and last use; remove what is not used.
