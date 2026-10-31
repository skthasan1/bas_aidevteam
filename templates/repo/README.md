# Repository templates

Purpose: files a repository needs so people and AI teams can work together by the protocol in `docs/PROTOCOL.md`. Copy them in; change only the placeholders.

## What is here

| File here | Copy to | What it does |
|---|---|---|
| `pull_request_template.md` | `.github/pull_request_template.md` | Evidence fields on every pull request: clearance link and hash, carry-forward record, QA evidence, tier, tests, counter-factual, size |
| `ISSUE_TEMPLATE/bug.md` | `.github/ISSUE_TEMPLATE/bug.md` | A bug with evidence, task, acceptance check |
| `ISSUE_TEMPLATE/finding.md` | `.github/ISSUE_TEMPLATE/finding.md` | A review, audit or security finding |
| `ISSUE_TEMPLATE/task.md` | `.github/ISSUE_TEMPLATE/task.md` | A planned task with two owners |
| `CODEOWNERS.example` | `.github/CODEOWNERS` | Who must review which paths |
| `workflows/checks.yml` | `.github/workflows/checks.yml` | Baseline CI: secrets scan of the PR's commits, install, lint, typecheck, test, build, audit (report only) |
| `labels.json` | not copied; create the labels from it | Priority, severity, type, area, tier, status labels |

## Steps

1. Copy the files to the places in the table. Do it on a branch and open a pull request. The CI file is a T2 change and CODEOWNERS is a T3 change (it decides who must approve): a named person reads the exact head before merge.
2. In `CODEOWNERS`, replace every `<...>` with a real handle of a person or team that has write access. Remove paths you do not have.
3. In `checks.yml`, read the comment block at the top. Pin every action by full commit hash (replace each `PIN-BY-HASH`), set the script names and Node version, and add a verified gitleaks install. Do not merge the file while any `PIN-BY-HASH` is left.
4. Create the labels. With the GitHub command line, for each entry in `labels.json`: `gh label create "<name>" --color "<color>" --description "<description>" --force` (run it yourself; the kit never does it for you).
5. In repository settings, the owner turns on: branch protection on the integration and production branches, required reviews, required status check `check`, "Require review from Code Owners", and private vulnerability reporting.
6. Say in the repository's contributing file whether AI accounts may submit formal approvals. If not stated, they may not.

## Rules while using the templates

- Do not put a real key, token, email address or hostname into any template.
- Do not delete a section of the pull request template; write "none" or "not applicable, because ...".
- The CI file never deploys and never reads a production secret.
- License of the kit: CC BY 4.0 (see the top-level README).
