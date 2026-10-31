# Test strategy: scenarios, suites, and running by risk

Purpose: describe how the QA lead builds a scenario library for each product and runs it.

## The loop

1. **Write scenarios that cover every feature.** One file per feature area under `<project>/scenarios/`. Each scenario has:
   - an id (`AREA-NNN`, for example `NOTES-014`)
   - purpose
   - preconditions (seeded data, a fresh install, a given role)
   - numbered steps
   - expected result
   - **cost class**: `free`, `cheap` or `paid`
   - an automation hint (a script, a browser check, or "by hand")
2. **Make two suites from them.**
   - **Full suite:** every scenario. Run for major changes and before each release.
   - **Regression suite:** the smallest set that guards the main flows and every past bug (one scenario per fixed issue, linked to the issue). Free scenarios first, so it can run often.
3. **Keep them alive.** For every feature added, add scenarios. For every change, fix the scenarios it breaks and record why. For every fixed bug, add its regression scenario.
4. **Run by risk.**
   - *Targeted:* the scenarios for the areas the change touched.
   - *Regression:* when a change touches shared code (data layer, auth, shared components, build config) or before a release merge.
   - *Full:* for major changes (new pipeline stage, database change, model or prompt change, framework upgrade) and releases.
5. **Report.** Each run produces one report (`report-template.md`) and one row in `<project>/runs.md` (head, date, suite, counts, cost).

Why: a scenario library that is not tied to the merge feed goes stale in a week and then protects nothing.

## What each test round also covers

Besides the functional scenarios, every UI test round includes:

- the UI-standards checklist (`ui-standards-checklist.md`), with the product's own overrides applied;
- the practice checklist (`practice-checklist.md`);
- a read-only conformance review against the team's framework and the product's own design notes: the four UI states, keyboard and focus, reuse of shared patterns, hardening patterns (timing-safe compares, fail-loud settings, untrusted-data wrapping, encrypted credentials), and whether docs, plan rows and the bug log are current. The conformance report lists each area, the rule, what was seen, severity and how to reproduce, with facts and recommendations apart, and lists the rules it could not check.

## Order of work for a new product

1. A fix-verification sheet for known bugs. It also proves your instance works.
2. Scenario files for the main pipeline, in the order a user meets it, free scenarios first.
3. The regression set from closed issues.
4. Automate only what is stable and free (page and API checks against your own local copy). Anything that costs money stays manual and capped.

## Test types and what to record

| Type | Record |
|---|---|
| UI / visual | viewport, theme, screenshot, rule id from the checklist |
| UX / usability | the task, the steps a new user needed, where they hesitated (if a human did the test, quote them) |
| API | request, status code, body (secrets removed), timing |
| Functionality | scenario id, expected, actual |
| Performance | the number, the unit, the tool, how many runs, the machine |
| Stress / load | what load, for how long, what broke first. Local only |
| Accessibility basics | keyboard reach, focus ring, names, contrast numbers, reduced motion, forced colours |

A performance finding without a number is not a finding. A load test is never run against a shared or production system.

## Layout per product

```
<project>/README.md          what the product is, how to start it locally, known issues
<project>/scenarios/<area>.md
<project>/suites/full.md
<project>/suites/regression.md
<project>/runs.md            one row per run
<project>/reports/           product-specific reports, if kept apart
```

## Learning intake

After every test round by the owner, the QA lead processes the learning inbox. See `learning-inbox.md`.

## Recommend, never decide

Every report and every learning file separates **facts**, **recommendations** and **decisions needed**. A decision is made by the tech lead and the owner only.
