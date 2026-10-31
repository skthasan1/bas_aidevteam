# QA workspace: how it is organised and how findings become issues

Purpose: explain the QA lead's folder layout, the daily flow, and how a finding travels from a test to a tracked issue. Kit version 0.1.0.

Written for: the QA lead (an AI session), the tech lead, and the owner.

## What the QA kit is

The QA lead is one role on the team. It tests the exact version of the code that someone names, reports what it measured, and hands findings to the tech lead. It does not fix, merge, close or decide.

Files in this kit:

| File | What it is for |
|---|---|
| `ROLE.md` | What the QA lead does, may do and must not do |
| `test-strategy.md` | Scenarios, the full suite, the regression suite, how to run by risk |
| `report-template.md` | The long form of the `docs/PROTOCOL.md` section 6 evidence block; the one report format used after every run |
| `findings-template.csv` | The finding record, one row per problem |
| `ui-standards-checklist.md` | A generic UI-standards list, with how to check each line |
| `practice-checklist.md` | Secrets, evidence, security hand-off and other practice checks |
| `free-test-rules.md` | Free and local testing, stubs, throwaway data, spend rule |
| `windows-notes.md` | Lessons about running tests on Windows |
| `evidence-and-limitations.md` | How to write what was not reached |
| `learning-inbox.md` | How the owner's test rounds feed the team's learning |
| `workspace-skeleton/` | Empty folder layout to copy into the QA lead's own workspace |

## The workspace layout

Copy `workspace-skeleton/` to a folder outside your product repos. The QA lead works there.

```
<qa-workspace>/
  reports/                one file per test run
  evidence/<date>/        screenshots and recordings, never secrets
  findings.csv            the open findings sheet (columns in findings-template.csv)
  learning/inbox/         sources waiting to be processed
  learning/processed/     sources already processed
  learning/out/           the learning files the QA lead maintains
  <project>/              one folder per product: README.md, scenarios/, suites/, reports/
  repos/                  read-only checkouts of the code under test
  scratch/                throwaway files, safe to delete
```

Why: one place per concern. A report can be found by date. Evidence is never mixed with code. Read-only checkouts make an accidental edit impossible to commit.

## The flow, from test to issue

1. **Find out what changed.** The tech lead or a daily feed lists what merged. Test the changed features first, then the flows around them.
2. **Test the named head.** A pull request head, or the merged branch head. Write the full commit id in the report. A short id is only allowed when the full one was not available, and the report says so.
3. **Write one finding per problem** in `findings.csv`. Fill every field (see "A finding the tech lead can raise without questions" below).
4. **Write the report** from `report-template.md` before you say the run is done.
5. **Review with the tech lead.** A short session or a short message: is it real, which repo owns it, which priority, is it a duplicate. Nothing is raised before this.
6. **The tech lead raises the issues.** One issue per finding, in the repo that owns the code.
7. **Re-test the fix** when it lands. Tell the tech lead "verified" or "still fails", with the head you tested. The tech lead closes the issue.

## Access rule

In the default set-up the QA lead has no GitHub write access. It has read access to the repos under test, so it can read code and pull requests. It does not open or comment on issues, labels, branches or pull requests. Findings go to the tech lead in `findings.csv`, and the tech lead raises them.

Why: one raising point keeps the issues clean (no duplicates, right repo, right priority) and keeps an attributable record of who asked for what. If an owner later grants the QA lead write access, that is the owner's decision and is written in the QA lead's `ROLE.md` in the team's own copy.

If the QA lead shares a login with another AI, the issue author cannot tell them apart. Fix that by giving each AI its own account. Until then, every issue body names the reporter ("Reported by the QA lead's AI assistant").

## A finding the tech lead can raise without questions

A finding is ready only when all of these fields are filled:

| Field | What to write |
|---|---|
| `project` | The product name, as the team calls it |
| `repo` | The repo that owns the code, if you know. If not, write `unknown` and say why in `actual` |
| `type` | `ui`, `ux`, `api`, `functionality`, `performance`, `usability` or `accessibility` |
| `priority` | Your recommendation, P0 to P3, as defined in `docs/PROTOCOL.md` section 8. The tech lead sets the final priority |
| `severity` | `critical`, `high`, `medium`, `low` or `info`, as in `docs/PROTOCOL.md` section 8 |
| `tier` | `T0` to `T3`, the review tier of the area affected (`docs/PROTOCOL.md` section 5). If unsure, write your best guess and say so in `actual` |
| `title` | One line a developer understands without the sheet ("Save button does nothing on a phone-width screen") |
| `steps` | Numbered, short, starting from a known state. Say which seeded data you used |
| `expected` | What should happen, and where that comes from (a spec line, a design note, a rule id from the checklist) |
| `actual` | What happened. For performance, a number and how it was measured. For an API, the request, the status code and the body with secrets removed |
| `environment` | App version or address, device or viewport, browser, theme, role, local or shared |
| `tested_head` | The full commit id you tested |
| `evidence` | A relative path in `evidence/<date>/` or a link; never a secret |
| `cost_class` | `free`, `cheap` or `paid` (what reproducing it costs). A `paid` finding says what was spent |
| `security_flag` | `no`, or `yes`. If `yes`, the row says only "flagged to the tech lead privately" and carries no detail (see `practice-checklist.md`) |
| `known_issue` | An existing issue reference if it is already tracked, else empty |
| `tester` | The QA lead's role name |

Why: the tech lead raises an issue by copying these fields. Any missing field costs a round trip, and a round trip is why findings sit unraised.

## Labels the tech lead sets

`tester-found`, a type label, and a priority label. The title is prefixed `[QA]`. The body ends with the line required by `docs/PROTOCOL.md` section 8, for example "Reported by the QA lead's AI assistant, raised by the tech lead's AI assistant, from a test round". The evidence the tech lead posts uses the block in `docs/PROTOCOL.md` section 6. A finding raised twice is skipped (the issue carries a marker with the finding's title and head).

## Rules for the sheet

- Never put a password, key, token, cookie or another person's personal data in a finding or a screenshot. Blur it or leave it out.
- Say what you expected, not only what is wrong.
- Check the known-issues list before you file. Do not report what is already tracked; link it.
- One problem per row. If two problems share a cause, write two rows and link them in `actual`.
- Recommend, never decide: "I recommend P2" is fine. Closing, relabelling or reprioritising an issue is not yours to do.
