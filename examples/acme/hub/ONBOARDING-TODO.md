# Onboarding to-do for acme

Purpose: the steps only a person can do. The onboarding tool never creates accounts, never touches tokens and never changes repository settings.

## 1. Accounts

- [ ] Create a separate GitHub account (or GitHub App) for the tech-lead role (planned name: acme-techlead-bot). One identity per AI; never share a login.
- [ ] Create a separate GitHub account (or GitHub App) for the ai-developer role (planned name: acme-dev-bot). One identity per AI; never share a login.
- [ ] Create a separate GitHub account (or GitHub App) for the qa-lead role (planned name: acme-qa-bot). One identity per AI; never share a login.
- [ ] Create a separate GitHub account (or GitHub App) for the security-lead role (planned name: acme-security-bot). One identity per AI; never share a login.
- [ ] Create a separate GitHub account (or GitHub App) for the researcher role (planned name: acme-research-bot). One identity per AI; never share a login.
- [ ] Add each account to the organization with the least access that works (read for most repos, write only where the role pushes branches).

## 2. Tokens and keys

- [ ] For each role account, create a fine-grained token limited to the listed repositories. Store it where the role's session reads it (for example the gh CLI login of that machine user). Do not paste a token into any file in this folder or into a chat.
- [ ] Decide who pays for any model or cloud keys, and give each session only its own. Spending needs a named person's yes in the session that will spend.

## 3. Repository settings (per repository)

- [ ] acme/notes-web: protect the default and production branches (pull request required, at least one approval, no force-push, no deletion).
- [ ] acme/notes-web: add the pull request template, issue templates, CODEOWNERS and the baseline CI workflow from templates/repo, then make the checks required once they are green.
- [ ] acme/notes-web: create the labels (priority, area, severity) from templates/repo.
- [ ] acme/notes-api: protect the default and production branches (pull request required, at least one approval, no force-push, no deletion).
- [ ] acme/notes-api: add the pull request template, issue templates, CODEOWNERS and the baseline CI workflow from templates/repo, then make the checks required once they are green.
- [ ] acme/notes-api: create the labels (priority, area, severity) from templates/repo.
- [ ] acme/tasks: protect the default and production branches (pull request required, at least one approval, no force-push, no deletion).
- [ ] acme/tasks: add the pull request template, issue templates, CODEOWNERS and the baseline CI workflow from templates/repo, then make the checks required once they are green.
- [ ] acme/tasks: create the labels (priority, area, severity) from templates/repo.

## 4. Projects

- [ ] Acme Notes (notes): confirm owners (dana-owner), testing status (active) and watch mode (review).
- [ ] Acme Tasks (tasks): confirm owners (dana-owner), testing status (later) and watch mode (off).

## 5. First run

- [ ] Install Node 20 or newer and the gh CLI on the machine that runs the watches; sign in as the tech lead's account.
- [ ] Run each watch once with --dry-run, then without it, and read the output together.
- [ ] Open one session per enabled role and paste its start-up brief from briefs/.
