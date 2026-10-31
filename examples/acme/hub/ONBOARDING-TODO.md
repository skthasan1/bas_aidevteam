# Onboarding to-do for acme

Purpose: the steps only a person can do. The onboarding tool never creates accounts, never touches tokens and never changes repository settings.

## 1. Accounts

- [ ] Create a separate GitHub account (or GitHub App) for the tech-lead role (planned name: acme-techlead-bot). One identity per AI; never share a login.
- [ ] Create a separate GitHub account (or GitHub App) for the ai-developer role (planned name: acme-dev-bot). One identity per AI; never share a login.
- [ ] Create a separate GitHub account (or GitHub App) for the qa-lead role (planned name: acme-ai-qa-lead[bot]). One identity per AI; never share a login.
- [ ] Create a separate GitHub account (or GitHub App) for the security-lead role (planned name: acme-security-bot). One identity per AI; never share a login.
- [ ] Create a separate GitHub account (or GitHub App) for the researcher role (planned name: acme-research-bot). One identity per AI; never share a login.
- [ ] Add each account to the organization with the least access that works (read for most repos, write only where the role pushes branches).

## 2. Tokens and keys

- [ ] For each role account, create a fine-grained token limited to the listed repositories. Store it where the role's session reads it (for example the gh CLI login of that machine user). Do not paste a token into any file in this folder or into a chat.
- [ ] Decide who pays for any model or cloud keys, and give each session only its own. Spending needs a named person's yes in the session that will spend.

## 3. AI identities

Each AI worker acts as its own GitHub App. Do the steps below once per worker, signed in as an owner of the organization. Never paste a private key into a chat or a file in this folder.

### tech-lead - acme-techlead-bot (for dana-owner)

- [ ] Create a GitHub App named `acme-ai-tech-lead`.
- Description: tech-lead AI worker for dana-owner at acme. Acts only as this App; every comment is signed.
- Permissions (repository): Metadata: read; Contents: write; Pull requests: write; Issues: write; Checks: read; Commit statuses: read; Actions: read.
- Note: Contents write: a project this lead leads lets it merge (lead-after-conditions or lead-on-owner-word). Branch protection and the merge rules still apply.
- Never grant: Administration, Secrets, Environments, Packages, any organization permission, any account permission. Leave webhooks off.
- Where can this be installed: Only on this account.
- [ ] Install it on the organization and select only these repositories: acme/notes-web, acme/notes-api, acme/tasks.
- [ ] Generate a private key. Store the .pem file outside every repository and outside this folder, with access for you only. Tell the agent only the App ID and the key path; never the key.
- [ ] Add `app` {id, key_file, owner} to this worker in the config, and set its account to the App's login (`<slug>[bot]`).
- [ ] Verify: `node tools/app-token.mjs --app-id <App ID> --key-file <path to the .pem> --owner acme` prints a token (do not paste it anywhere), then post one test comment on a test issue with `node tools/as-app.mjs` and check that it shows as `acme-ai-tech-lead[bot]`. Then run `node tools/doctor.mjs --config <config> --check-keys`.

### qa-lead - acme-ai-qa-lead[bot] (for dana-owner)

- [ ] Create a GitHub App named `acme-ai-qa-lead`.
- Description: qa-lead AI worker for dana-owner at acme. Acts only as this App; every comment is signed.
- Permissions (repository): Metadata: read; Contents: read; Pull requests: write; Issues: write; Checks: read; Commit statuses: read; Actions: read.
- Never grant: Administration, Secrets, Environments, Packages, any organization permission, any account permission. Leave webhooks off.
- Where can this be installed: Only on this account.
- [ ] Install it on the organization and select only these repositories: acme/notes-web, acme/notes-api, acme/tasks.
- [ ] Generate a private key. Store the .pem file outside every repository and outside this folder, with access for you only. Tell the agent only the App ID and the key path; never the key.
- [ ] Add `app` {id, key_file} to this worker in the config, and set its account to the App's login (`<slug>[bot]`).
- [ ] Verify: `node tools/app-token.mjs --app-id <App ID> --key-file <path to the .pem> --owner acme` prints a token (do not paste it anywhere), then post one test comment on a test issue with `node tools/as-app.mjs` and check that it shows as `acme-ai-qa-lead[bot]`. Then run `node tools/doctor.mjs --config <config> --check-keys`.

### researcher - acme-research-bot (for dana-owner)

- [ ] Create a GitHub App named `acme-ai-researcher`.
- Description: researcher AI worker for dana-owner at acme. Acts only as this App; every comment is signed.
- Permissions (repository): Metadata: read; Contents: write; Pull requests: write; Issues: write.
- Note: Contents write: research results go to the research repository by pull request.
- Note: Also select the research repository.
- Never grant: Administration, Secrets, Environments, Packages, any organization permission, any account permission. Leave webhooks off.
- Where can this be installed: Only on this account.
- [ ] Install it on the organization and select only these repositories: acme/notes-web, acme/notes-api, acme/tasks.
- [ ] Generate a private key. Store the .pem file outside every repository and outside this folder, with access for you only. Tell the agent only the App ID and the key path; never the key.
- [ ] Add `app` {id, key_file, owner} to this worker in the config, and set its account to the App's login (`<slug>[bot]`).
- [ ] Verify: `node tools/app-token.mjs --app-id <App ID> --key-file <path to the .pem> --owner acme` prints a token (do not paste it anywhere), then post one test comment on a test issue with `node tools/as-app.mjs` and check that it shows as `acme-ai-researcher[bot]`. Then run `node tools/doctor.mjs --config <config> --check-keys`.

### ai-developer - acme-dev-bot (for dana-owner)

- [ ] Create a GitHub App named `acme-ai-ai-developer-dana-owner-1`.
- Description: ai-developer AI worker for dana-owner at acme. Acts only as this App; every comment is signed.
- Permissions (repository): Metadata: read; Contents: write; Pull requests: write; Issues: write; Checks: read; Commit statuses: read; Actions: read.
- Optional: Workflows: write, only if it edits CI files, then every CI change is a pull request a person reads.
- Note: Contents write: pushes branches for its pull requests.
- Never grant: Administration, Secrets, Environments, Packages, any organization permission, any account permission. Leave webhooks off.
- Where can this be installed: Only on this account.
- [ ] Install it on the organization and select only these repositories: acme/notes-web, acme/notes-api, acme/tasks.
- [ ] Generate a private key. Store the .pem file outside every repository and outside this folder, with access for you only. Tell the agent only the App ID and the key path; never the key.
- [ ] Add `app` {id, key_file, owner} to this worker in the config, and set its account to the App's login (`<slug>[bot]`).
- [ ] Verify: `node tools/app-token.mjs --app-id <App ID> --key-file <path to the .pem> --owner acme` prints a token (do not paste it anywhere), then post one test comment on a test issue with `node tools/as-app.mjs` and check that it shows as `acme-ai-ai-developer-dana-owner-1[bot]`. Then run `node tools/doctor.mjs --config <config> --check-keys`.

### security-lead - acme-security-bot (for dana-owner)

- [ ] Create a GitHub App named `acme-ai-security-lead`.
- Description: security-lead AI worker for dana-owner at acme. Acts only as this App; every comment is signed.
- Permissions (repository): Metadata: read; Contents: write; Pull requests: write; Issues: write; Checks: read; Commit statuses: read; Actions: read.
- Note: Contents write: audit results go to the security repository by pull request.
- Note: Also select the security repository.
- Never grant: Administration, Secrets, Environments, Packages, any organization permission, any account permission. Leave webhooks off.
- Where can this be installed: Only on this account.
- [ ] Install it on the organization and select only these repositories: acme/notes-web, acme/notes-api, acme/tasks.
- [ ] Generate a private key. Store the .pem file outside every repository and outside this folder, with access for you only. Tell the agent only the App ID and the key path; never the key.
- [ ] Add `app` {id, key_file, owner} to this worker in the config, and set its account to the App's login (`<slug>[bot]`).
- [ ] Verify: `node tools/app-token.mjs --app-id <App ID> --key-file <path to the .pem> --owner acme` prints a token (do not paste it anywhere), then post one test comment on a test issue with `node tools/as-app.mjs` and check that it shows as `acme-ai-security-lead[bot]`. Then run `node tools/doctor.mjs --config <config> --check-keys`.

### ai-developer - sam-dev-bot-1 (for sam-dev)

- [ ] Create a GitHub App named `acme-ai-ai-developer-sam-dev-2`.
- Description: ai-developer AI worker for sam-dev at acme. Acts only as this App; every comment is signed.
- Permissions (repository): Metadata: read; Contents: write; Pull requests: write; Issues: write; Checks: read; Commit statuses: read; Actions: read.
- Optional: Workflows: write, only if it edits CI files, then every CI change is a pull request a person reads.
- Note: Contents write: pushes branches for its pull requests.
- Never grant: Administration, Secrets, Environments, Packages, any organization permission, any account permission. Leave webhooks off.
- Where can this be installed: Only on this account.
- [ ] Install it on the organization and select only these repositories: acme/tasks.
- [ ] Generate a private key. Store the .pem file outside every repository and outside this folder, with access for you only. Tell the agent only the App ID and the key path; never the key.
- [ ] Add `app` {id, key_file, owner} to this worker in the config, and set its account to the App's login (`<slug>[bot]`).
- [ ] Verify: `node tools/app-token.mjs --app-id <App ID> --key-file <path to the .pem> --owner acme` prints a token (do not paste it anywhere), then post one test comment on a test issue with `node tools/as-app.mjs` and check that it shows as `acme-ai-ai-developer-sam-dev-2[bot]`. Then run `node tools/doctor.mjs --config <config> --check-keys`.

### ai-developer - sam-dev-bot-2 (for sam-dev)

- [ ] Create a GitHub App named `acme-ai-ai-developer-sam-dev-3`.
- Description: ai-developer AI worker for sam-dev at acme. Acts only as this App; every comment is signed.
- Permissions (repository): Metadata: read; Contents: write; Pull requests: write; Issues: write; Checks: read; Commit statuses: read; Actions: read.
- Optional: Workflows: write, only if it edits CI files, then every CI change is a pull request a person reads.
- Note: Contents write: pushes branches for its pull requests.
- Never grant: Administration, Secrets, Environments, Packages, any organization permission, any account permission. Leave webhooks off.
- Where can this be installed: Only on this account.
- [ ] Install it on the organization and select only these repositories: acme/tasks.
- [ ] Generate a private key. Store the .pem file outside every repository and outside this folder, with access for you only. Tell the agent only the App ID and the key path; never the key.
- [ ] Add `app` {id, key_file, owner} to this worker in the config, and set its account to the App's login (`<slug>[bot]`).
- [ ] Verify: `node tools/app-token.mjs --app-id <App ID> --key-file <path to the .pem> --owner acme` prints a token (do not paste it anywhere), then post one test comment on a test issue with `node tools/as-app.mjs` and check that it shows as `acme-ai-ai-developer-sam-dev-3[bot]`. Then run `node tools/doctor.mjs --config <config> --check-keys`.

### ai-developer - sam-dev-bot-3 (for sam-dev)

- [ ] Create a GitHub App named `acme-ai-ai-developer-sam-dev-4`.
- Description: ai-developer AI worker for sam-dev at acme. Acts only as this App; every comment is signed.
- Permissions (repository): Metadata: read; Contents: write; Pull requests: write; Issues: write; Checks: read; Commit statuses: read; Actions: read.
- Optional: Workflows: write, only if it edits CI files, then every CI change is a pull request a person reads.
- Note: Contents write: pushes branches for its pull requests.
- Never grant: Administration, Secrets, Environments, Packages, any organization permission, any account permission. Leave webhooks off.
- Where can this be installed: Only on this account.
- [ ] Install it on the organization and select only these repositories: acme/tasks.
- [ ] Generate a private key. Store the .pem file outside every repository and outside this folder, with access for you only. Tell the agent only the App ID and the key path; never the key.
- [ ] Add `app` {id, key_file, owner} to this worker in the config, and set its account to the App's login (`<slug>[bot]`).
- [ ] Verify: `node tools/app-token.mjs --app-id <App ID> --key-file <path to the .pem> --owner acme` prints a token (do not paste it anywhere), then post one test comment on a test issue with `node tools/as-app.mjs` and check that it shows as `acme-ai-ai-developer-sam-dev-4[bot]`. Then run `node tools/doctor.mjs --config <config> --check-keys`.

## 4. Repository settings (per repository)

- [ ] acme/notes-web: protect the default and production branches (pull request required, at least one approval, no force-push, no deletion).
- [ ] acme/notes-web: add the pull request template, issue templates, CODEOWNERS and the baseline CI workflow from templates/repo, then make the checks required once they are green.
- [ ] acme/notes-web: create the labels (priority, area, severity) from templates/repo.
- [ ] acme/notes-api: protect the default and production branches (pull request required, at least one approval, no force-push, no deletion).
- [ ] acme/notes-api: add the pull request template, issue templates, CODEOWNERS and the baseline CI workflow from templates/repo, then make the checks required once they are green.
- [ ] acme/notes-api: create the labels (priority, area, severity) from templates/repo.
- [ ] acme/tasks: protect the default and production branches (pull request required, at least one approval, no force-push, no deletion).
- [ ] acme/tasks: add the pull request template, issue templates, CODEOWNERS and the baseline CI workflow from templates/repo, then make the checks required once they are green.
- [ ] acme/tasks: create the labels (priority, area, severity) from templates/repo.

## 5. Projects

- [ ] Acme Notes (notes): confirm owners (dana-owner), testing status (active) and watch mode (review).
- [ ] Acme Tasks (tasks): confirm owners (dana-owner), testing status (later) and watch mode (off).

## 6. First run

- [ ] Install Node 20 or newer and the gh CLI on the machine that runs the watches; sign in as the tech lead's account.
- [ ] Run each watch once with --dry-run, then without it, and read the output together.
- [ ] Open one session per enabled role and paste its start-up brief from briefs/.
