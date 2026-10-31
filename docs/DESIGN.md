# Build@Scale AI Dev Team: design

> Status: first release. Everything in this repository must be safe to publish: no real names, no project names, no keys or tokens, no private decisions.

## 1. What this is

**Build@Scale AI Dev Team** (`bas_aidevteam`) is an optional kit for people who start a project with Claude Code (or another coding agent) and want more than one agent: a small, accountable AI team that works locally on the owner's machine and through GitHub together with human developers and with other people's AI teams.

It is a sibling of **Build@Scale with AI** (`buildatscale`):

| | Build@Scale with AI | Build@Scale AI Dev Team |
|---|---|---|
| Level | one project | an organization (many repos, many people) |
| What it ships | commands, templates, the UI pack, quality gates | roles, a hub, a protocol, watches, an onboarding script |
| Runs where | inside the project's `.claude/` | a local hub folder plus GitHub |
| Needed by the other? | no | uses Build@Scale's commands (`/pipeline`, `/audit`, `/mft`, `/security`); works without them but gets weaker |

## 2. Principles

1. **People decide.** The AI team proposes, prepares, reviews and tests. Approvals, production releases, spending, access and anything irreversible are a named person's call.
2. **GitHub is the shared bus.** Every claim, review, test result and decision that another person or AI team needs is on a pull request or an issue, in a fixed format (the protocol). Local files are for the team's own memory.
3. **One identity per AI.** Attribution matters. Each role has its own bot account or GitHub App, never a shared login.
4. **Free by default.** Tests run on local copies with no real accounts. Anything that costs money needs a named person's yes in the session that will spend it.
5. **Evidence names the version.** Every review, QA report and clearance names the full commit it covers and what it did not cover. A gap is written down; it is never counted as a pass.
6. **Non-destructive by default.** New branches instead of history rewrites; no force-push unless a person allows that one push.
7. **Secrets stay secret.** The team never reads, prints or pastes a key. Setup steps put keys where the owner puts them.
8. **Walls between projects.** A project can be confidential from another; the kit has a rule and a check for it.

## 3. Roles (v0.1)

| Role | Short name | Core job |
|---|---|---|
| Tech lead | `tech-lead` | Reviews every change, raises issues with owner and priority, keeps the process, merges only what the rules allow |
| AI developer | `ai-developer` | Builds small pull requests, test first, one issue each |
| QA lead | `qa-lead` | Tests the exact version (before or after merge), free and local, writes the report |
| Security and compliance lead | `security-lead` | Weekly audit, findings routed to the right place, readiness checks |
| AI researcher | `researcher` | Designs and runs blind tests of ideas, records verdicts, makes sure every judged test ends in an action |

An organization may run several developers, or merge two roles at first. A role is a brief plus a permission contract; see `roles/`.

### Scope

The kit must include **everything the QA lead does** (the QA workspace and its rules, report and finding formats, the UI-standards checklist, the learning inbox), **the researcher's framework** (the research pipeline, blind-test hygiene, the registry, the evidence-page builder, the action-line rule and the review-instructions rule), and **the framework and rules the AI developers follow** (branch per issue, test first, size, overlap and owner check, review tiers, locked decisions, handoff and session notes).

## 4. Layers

```
people (owners, developers)          decide, approve, merge to production
   |
GitHub (issues, PRs, reviews)        the shared record, in the protocol's format
   |
the hub (a local folder)             runbook, config, queue of decisions, briefings, watches
   |
role sessions (one per AI)           own worktree, own ports, own account
```

## 5. Contents of this repository

```
README.md                  what it is, 3-step install
VERSION, CHANGELOG.md
docs/
  DESIGN.md                this file
  ARCHITECTURE.md          layers, data flow, what runs where
  PROTOCOL.md              the interop spec (comment formats, clearance, carry-forward, ownership)
  SECURITY-MODEL.md        identities, tokens, secrets, destructive git, confidentiality walls
  GETTING-STARTED.md       onboarding walkthrough
  ROLES.md                 role overview and how to combine roles
roles/                     one brief per role (purpose, permissions, daily loop, never-do list, start-up message)
dev/                       the developer kit: the rules a builder AI (and a human on the same team) follows
  RULES.md                 branch per issue, test first, counter-factual, size, overlap check, tiers, locked decisions
  workflow.md              issue -> branch -> PR -> review -> QA -> merge, for an AI developer
  templates/               PR description, design note, handoff note, session note
qa/                        the QA kit: everything the QA lead does
  ROLE.md, test-strategy.md, README.md   how the QA workspace is organised
  report-template.md       a test report (tested commit, scenarios, environment, limitations)
  findings-template.csv    a finding record
  ui-standards-checklist.md  a generic UI-standards and practice checklist
  learning-inbox.md        how the owner's test rounds feed the team's learning
  workspace-skeleton/      the folder layout (reports, evidence, per-project folders)
research/                  the researcher kit: the research and blind-test framework
  FRAMEWORK.md             the research pipeline: intake, analysis, test plan, blind test, verdict, action
  SKILL.md                 the agent skill (how the researcher works)
  LEARNINGS.md             hygiene rules learned the hard way (blind tests, spend, registry)
  templates/               intake, analysis, test plan, verdict, issue drafts, retest, evidence spec
  registry/                the test registry format and its rules (a judged test needs an action line)
  tools/                   registry, evidence-page builder, repo check (generic, no project data)
templates/
  hub/                     RUNBOOK.md skeleton, CLAUDE.md snippet, config examples, queue, briefing layout
  repo/                    PR template with evidence fields, issue templates, CODEOWNERS, baseline CI workflow, labels
tools/                     watches (pull requests, questions, merges), onboard.mjs, check-public.mjs
tests/                     node --test for the tools
examples/                  a worked example organization (fictional)
```

## 6. Interoperability (the part other teams use)

Two teams that follow `docs/PROTOCOL.md` can work together through GitHub while each runs locally. The protocol defines: comment prefixes (`Reviewed by <role> (<owner>'s AI assistant)`), the clearance format (full SHA, what was checked, what was not), carry-forward rules (which deltas may keep an earlier clearance, with the whole delta recorded), the overlap and ownership check before editing, the review tiers (what always needs a person's own read), issue format (priority, owner, evidence, acceptance check), and how security findings are routed.

## 7. Onboarding (`tools/onboard.mjs`)

Config-driven, dry run by default. Inputs: organization, repos, people and their areas, roles to enable. Output: a hub folder (runbook, config, queue, briefings), per-role start-up briefs, and a checklist of steps only the owner can do (accounts, tokens, repository settings, and copying `templates/repo` into each repository). It never writes into your repositories. It never creates accounts and never touches a token.

## 8. Out of scope for v0.1

Hosting the AI sessions, a web dashboard, billing, a hosted secrets service. The kit says where each belongs and leaves the choice to the owner.

## 9. Later

- Whether the Build@Scale `/scaffold` command should offer to onboard an AI team (a small change in that repository).
- A GitHub App recipe per role, so every AI gets its own short-lived token.

## 10. Two ways to use it: solo and team

The kit serves one person on their own and a team of people, from the same files. The mode is one line in the config (`mode: solo` or `mode: team`); nothing else forks.

| | Solo | Team |
|---|---|---|
| Owner | the person; they are also the only approver | one named owner per project, who may delegate approvals in writing |
| Lead AI | the person's own tech lead AI; reviews their AI developer's work | one lead AI per project, chosen by the project owner and named in the config |
| Local AIs | all of them belong to the one person | each person may keep a local tech lead for their own work; it has no authority over another person's AIs or projects |
| Cross-team work | none, or through a contact card | through the protocol: clearances, contact cards, escalation to the owner |
| Guardrails | enforced by checks (CI template, `doctor`), because nobody else is watching | the same checks, plus the owner's own reads for T2 and T3 |
| Starting roles | tech lead + AI developer; QA lead next | as many as the organization wants |

Rules that hold in both modes:
- A lead AI merges only where the project owner granted that in writing, and never decides spend, releases, or access.
- Two leads that disagree escalate to the project owner; neither overrides the other.
- Growing from solo to team changes the config and adds people; no file is rewritten.
- `doctor` checks that each project names exactly one owner and one lead, and that guardrails work without a person watching.

### Policy, people and AI workers

Config fields, all optional so a v0.1 config still loads:
- `mode`: `solo` or `team` (default `team`).
- per project: `lead` (the project's lead AI account), `merge` (`owner-only`, `lead-after-conditions` or `lead-on-owner-word`; default `owner-only`), `members` (people who belong but do not own).
- `people`: for each person, the AI workers they run. A person picks the roles they need and may run several of one role: a developer can run three `ai-developer` accounts and no QA lead or researcher. A role a person leaves out is a role they do without; `doctor` says what that costs (for example: tests are the person's own, and T2 and T3 changes still need a person's own read).

`tools/doctor.mjs --config <file> [--repo <folder>] [--me <handle>]` checks that the policy is consistent (one lead per project, the lead is an AI account and not a person, a merge watch is only set where merging is allowed, one identity per AI worker, solo means one owner and no members), that a repository carries the template, the baseline checks and CODEOWNERS, and prints the projects a person owns or belongs to with their role and merge power.

### Required functions: no shortcuts

Build@Scale has no shortcuts, so every project must cover four functions, and `doctor` fails the setup when one is missing:

| Function | Covered by (in the project's `covers`) |
|---|---|
| `review`: someone other than the author reads the change | `role:tech-lead`, or `person:<handle>` |
| `test`: the exact version is run and the gaps are written down | `role:qa-lead`, or `person:<handle>` |
| `security`: secrets, access, tenant boundaries | `role:security-lead`, or `person:<handle>` |
| `decision`: spend, releases, access, anything irreversible | `person:<owner handle>` only |

- A function is covered by an AI role somebody runs, or by a named person who owns or belongs to the project. A check (CI, a template) supports a function but never covers it alone.
- A person who skips a role is fine, as long as the project's `covers` names who covers that function instead (a teammate's AI, or the person themselves).
- The researcher is optional; nothing depends on it.
- `doctor` fails when: a function is missing; a role does not do that function; nobody runs the named role; a named person is not in the project; the decision names an AI or a non-owner.
