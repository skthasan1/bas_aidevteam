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
