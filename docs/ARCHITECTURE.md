# Architecture

Purpose: show the layers of the kit, how information moves between people, GitHub, the hub and the role sessions, and what runs where.

## 1. The layers

```
people (owners, developers)          decide, approve, merge to production
   |
GitHub (issues, PRs, reviews)        the shared record, in the protocol's format
   |
the hub (a local folder)             runbook, config, queue of decisions, briefings, watches
   |
role sessions (one per AI)           own worktree, own ports, own database, own account
```

Each layer has one job.

- **People** make the decisions that cannot be undone: production releases, spending, access, deleting data, changing the rules.
- **GitHub** is the shared bus. Anything another person or another AI team needs to see goes on a pull request or an issue, in the protocol's format. Why: a note in a private chat cannot be checked by anyone else, and it disappears with the session.
- **The hub** is the tech lead's memory and control folder. It is plain files on the owner's machine. Why: files are easy to read, back up and review, and need no service.
- **Role sessions** are the working AIs. Each has its own brief and its own limits.

## 2. What is in the hub

| Item | Purpose |
|---|---|
| `RUNBOOK.md` | The standing rules and step-by-step procedures, each with its reason |
| Config files | The list of repositories, people and areas, role settings, and the watch mode per repository |
| The queue | Decisions waiting for a person. Each decision is one row with an ID, the question, the options and the answer |
| Briefings | One short daily summary per project, facts from a tool, narrative from the tech lead |
| Reviews and logs | Review notes, a log of clean merges, decision clocks |
| Handoff notes | What the next session needs to know, because sessions forget |

Rule: the hub never holds a secret. It holds the names of secrets and where the owner keeps them, never the values.

## 3. Data flow

1. A person or the tech lead writes an **issue**: priority, owner, evidence, acceptance check.
2. The **AI developer** (or a human developer) takes the issue, makes a branch, writes the test first, and opens a small **pull request** with the evidence fields filled in.
3. A **watch** (`tools/pr-watch.mjs`) lists pull requests that are new or changed since its last run. It does not review them itself. It tells the tech lead session what to look at.
4. The **tech lead** reviews the diff and the CI result. For a large change it starts a read-only review agent. The review is posted as a comment in the protocol's format, with the full commit it covers and what it did not cover.
5. The **QA lead** tests the exact version, before or after merge, free and local. The report names the full commit, the scenarios, the environment and the limits. Findings go to the tech lead, who raises them as issues.
6. The **security lead** audits on a schedule. Findings become issues in the owning repository with a severity. Findings that must not be public go to a private place only.
7. A **merge** happens only when the rules for that repository allow it (`tools/merge-watch.mjs` reports what is ready and what is blocked). Merges to production are always a person's.
8. The **researcher** feeds ideas in: a tested idea ends as a verdict and an action line, which becomes an issue or a decision in the queue.
9. Questions waiting for a person (compliance questions, design questions) are tracked by `tools/question-watch.mjs`, so none is forgotten.
10. The hub's daily briefing summarises all of this for the owner. The owner is alerted only when something is wrong or needs a decision.

## 4. What runs locally and what runs on GitHub

| Runs locally (on the owner's machine or the owner's own server) | Runs on GitHub |
|---|---|
| All AI role sessions | Issues, pull requests, reviews, comments (the shared record) |
| The hub folder and its tools | CI workflows (build, tests, secret scan) |
| The watches (they read GitHub, they run locally) | Branch protection and code owners |
| Test environments with local databases and stub accounts | Scheduled workflows that record state (for example issue status) |
| The evidence and report builders | Repository secrets used only by CI |

Why: the AI sessions need the owner's files and tools, and keeping them local keeps keys and data under the owner's control. GitHub holds what must be shared, signed and permanent.

A watch is a script you run on a schedule (for example every half hour from the tech lead session, or from your operating system's scheduler). It reads GitHub with a read-only token and prints a short list. If nothing is new it prints nothing. Plan for the schedule to stop when the session closes, and re-arm it at the start of each session.

## 5. Per-role session set-up

Each role gets its own session with its own surroundings. Why: two sessions in one folder switch each other's branches, overwrite each other's files and mix up their notes. This has caused lost work.

| Item | Rule |
|---|---|
| Folder | Its own clone or `git worktree`. Never share a working folder between two sessions |
| Ports | Its own range, written in the hub config. Example: tech lead 3000, developer A 3100 to 3199, QA lead 3200 to 3299. These numbers are illustrations |
| Database | Its own local database or its own database name. Never a shared one. Tests run on local copies only |
| Account | Its own GitHub bot account or GitHub App, with the smallest permissions that role needs |
| Keys | Its own capped development keys, set by the owner. The session never reads or prints them |
| Brief | Its own start-up message from `roles/` |
| Notes | Its own session notes and handoff file |

The throwaway rule: experiments go in a throwaway worktree that you delete afterwards. A folder that shows a running instance stays on its agreed branch.

After a merge, update the running instance that shows the change: pull, apply local migrations, restart if dependencies or settings changed. Production migrations are a separate, deliberate release step that one named person runs.

## 6. The scheduled watches

| Tool | Reads | Purpose |
|---|---|---|
| `tools/pr-watch.mjs` | Pull requests in the configured repositories | Lists pull requests that are new or changed since the last run. Bot-generated dependency pull requests are listed apart |
| `tools/question-watch.mjs` | Issues or questions marked as waiting for a person | Shows what is still unanswered and how old it is |
| `tools/merge-watch.mjs` | Merge state, reviews and CI of open pull requests | Shows which are ready to merge under the rules and which are blocked, and why |
| `tools/check-public.mjs` | The files of this kit or any repository you point it at | Looks for names, secrets and private identifiers before you publish |

Each repository has a **mode** in the hub config:

- **merge**: the tech lead may merge when the rules are met.
- **review**: the tech lead reviews and reports; a person merges.
- **off**: not watched.

A repository starts in review mode. Only the owner moves it to merge.

## 7. How a second organization's AI team works with yours

Two teams interoperate through GitHub only. Neither needs access to the other's hub or machine.

1. Both teams follow `docs/PROTOCOL.md`: the same comment prefix, the same clearance format, the same carry-forward rules, the same issue format.
2. Each AI signs as `Reviewed by <role> (<owner>'s AI assistant)`. A reader always knows which human is responsible for the AI that wrote it.
3. The owners agree, in writing, on: which repositories are shared, who is the code owner of each area, which review tiers need a human, and where security findings go.
4. Each team uses its own bot identities with access only to the shared repositories. No team shares a login with another.
5. A clearance from the other team counts only if it names the full commit and states what it did not check. If the commit has since changed, the carry-forward rules decide what still holds.
6. Before editing, an AI checks open pull requests and code owners for overlap. If another team owns the area, it asks first.
7. Confidential projects stay behind the wall described in `docs/SECURITY-MODEL.md`. Sharing one repository does not share the rest.

If the other team does not use this kit, the protocol still works as a set of conventions you ask them to follow. A team that ignores them gets a human reviewer, not an AI one.
