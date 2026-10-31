# Roles

Purpose: describe the five roles, how to combine them in a small organization, and how work passes between them.

Each role is a brief plus a permission contract. The full brief for each is in `roles/`.

## 1. The five roles

| Role | Core job | Reads | May write | Never does |
|---|---|---|---|---|
| Tech lead | Reviews every change, raises issues with owner and priority, keeps the process, merges only what the rules allow | All repositories, the hub | Review comments, issues, hub files; merges in merge-mode repositories | Merge to production, spend, change access, merge in review mode |
| AI developer | Builds small pull requests, test first, one issue each | Its assigned repositories | Its own branches and pull requests | Merge, force-push, edit an area owned by someone else without asking, touch secrets |
| QA lead | Tests the exact version, free and local, and writes the report | Merged and proposed versions | Reports, finding records | Fix the code, use real accounts, spend, raise issues itself in a repository it cannot write to |
| Security and compliance lead | Weekly audit, routes findings to the right place, checks readiness | All repositories, read-only | Audit reports, findings in the private place | Publish a finding in public, change code, exploit anything |
| AI researcher | Designs and runs blind tests of outside ideas, records verdicts, makes each judged test end in an action | Outside material, the registry | Research notes, registry, issue drafts | Change prompts or product decisions, spend without a yes, test with real accounts |

### Tech lead

The center of the team. Every change passes through this role, either as the reviewer or as the person who knows who reviewed. It keeps the hub: the runbook, the queue of decisions, the briefings. It tells the owner only what needs the owner. A clean merge is a log line, not an alert.

### AI developer

Works one issue at a time. Reads the issue, checks for overlap and ownership, makes a branch, writes the test first, makes the change small, opens a pull request with the evidence fields filled in. Several developers can run at once, each with their own folder, ports and database.

### QA lead

Tests what exists, not what is claimed. Every report names the full commit tested, the scenarios, the environment and the limits. A gap is written down, never counted as a pass. It tests free and local. It does not judge taste or sound; it says so.

### Security and compliance lead

Runs the audit on a schedule, usually weekly against the development branch. Each finding becomes an issue in the owning repository with a severity, unless it must stay private. Tracks readiness questions for compliance work, with an AI draft and a person's answer.

### AI researcher

Takes outside material (a tutorial, a competitor, a repository, a paper), analyses it, plans a blind test, runs it, and records a verdict. Every judged test ends in an action line: an issue, a decision for the queue, or a deliberate "no action" with the reason. The researcher recommends. People decide.

## 2. Combining roles in a small organization

You do not need five sessions on day one. Combine like this.

| Organization size | Sessions | How |
|---|---|---|
| One owner, one product | 2 | Tech lead (also covers security checks), AI developer (also does basic QA by running the tests) |
| One owner, a few products | 3 | Tech lead, AI developer, QA lead |
| Owner and one or two human developers | 4 | Tech lead, one AI developer per human developer, QA lead |
| A regulated or client-facing product | 5 or more | Add the security lead; add the researcher when you have ideas to evaluate |

Rules for combining:

- **Never combine the author and the reviewer.** The AI developer does not review its own pull request. Why: the author misses what it already believes.
- **Never combine the tester and the author of the change under test** when you can avoid it. If you must, say so in the report.
- **Keep the researcher separate** from the developer. Why: the researcher's value is an independent verdict.
- A combined role still keeps the permissions of the stricter half.
- Each session is still separate: its own folder, ports, database and identity. Combining roles means one brief covers two jobs, not two jobs in one shared folder.

## 3. How many sessions to run at first

Start with two: the tech lead and one AI developer. Add the QA lead when you have a few merged pull requests to test. Add the others as the work needs them.

Why: each session needs a brief, a folder, an identity and attention. Two well-run sessions beat five loosely run ones. Add a session only when you can name the work it will do and the person who will read its output.

A practical limit: no more sessions than you can read the output of in a day. If reports pile up unread, the team is bigger than your attention.

## 4. Handoff between roles

Work moves through GitHub, and anything needed later is written down. A session does not remember yesterday.

| From | To | What is handed over | Where |
|---|---|---|---|
| Owner | Tech lead | A goal or a decision | The queue |
| Tech lead | AI developer | An issue with priority, owner, evidence, acceptance check | GitHub issue |
| AI developer | Tech lead | A pull request with test evidence | GitHub pull request |
| Tech lead | QA lead | Which merged head to test, and what changed | A message naming the full commit |
| QA lead | Tech lead | A report and findings | Report file and findings record |
| Tech lead | Owner of the code | An issue raised from a finding, with priority | GitHub issue |
| Security lead | Tech lead | Findings with severity, routed | Private place or the owning repository |
| Researcher | Tech lead | A verdict with an action line | Registry and issue draft |
| Any role | The next session of itself | Session note: what was done, what is open, what to do first | The role's handoff file |

Handoff rules:

- Name the full commit, never "latest".
- State what was not covered.
- One owner per item. If two roles think it is theirs, the tech lead decides.
- When a role has nothing left to do, it sends the tech lead one short message ("idle: what I finished, what I can take") and waits. It does not invent work, and it does not go to the owner directly.
- End every session with a note. Why: sessions are cleared between days, and the note is the only memory.
