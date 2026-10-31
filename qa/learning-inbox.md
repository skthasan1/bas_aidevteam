# Learning inbox: how the owner's test rounds feed the team

Purpose: keep the QA lead's knowledge of how the product should behave in step with what the owner decides when testing.

## What a test round is

A **test round** is any of these:

- an annotated list the owner worked through (what passed, what felt wrong, in the owner's words);
- a batch of issues raised from the owner's own testing;
- a decision on a design question.

## Why

A tester that only follows written rules misses what the owner learns by using the product. Each round shows a new pattern, confirms a rule, or contradicts one. If those lessons are not written down, the same mistakes come back.

## The steps (the same day)

1. **The tech lead raises the issues** as usual (priority, owner, "raised by the tech lead, from the owner's test").
2. **The tech lead copies the source** (the annotated list, the screenshots' paths, the note) into `learning/inbox/`, with a short `<name>.note.md`: issues raised, the owner's own words worth learning from, decisions taken. No keys, no private notes, no personal data.
3. **The tech lead tells the QA lead** that something is waiting.
4. **The QA lead processes it that day:**
   - update the learning files in `learning/out/` where the round shows a new pattern, confirms or contradicts a rule: `testing-style.md`, `ui-standards.md`, `flow-standards.md`, `ux-checklist.md`, `ux-score.md`;
   - mark a rule **"confirmed by the owner"** only when the owner said so, and quote the words or give the issue number;
   - fix or retire a rule the owner contradicted;
   - add the evidence (issue references);
   - move the source to `learning/processed/`;
   - add one line to `learning/CHANGELOG.md` (date, source, files changed, what changed);
   - add the new checks to the scenarios and suites.
5. **The QA lead sends a five-line summary** to the tech lead and owner: new rules, changed rules, checks added, open questions.
6. **The tech lead reviews the summary.** Approved rules move into the product's repository docs when the owner says so.

## Rules

- A rule stays **proposed** until the owner confirms it.
- Facts, recommendations and decisions stay apart in every learning file.
- The learning files hold rules and evidence, not secrets and not private conversation.
- Blind-test material held back for a ranking is never in this inbox (see the research kit's blind-test rules).

## Layout

```
learning/inbox/       waiting
learning/processed/   done
learning/out/         the five learning files
learning/CHANGELOG.md one line per round
```
