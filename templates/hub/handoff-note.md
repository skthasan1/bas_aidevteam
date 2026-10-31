# Handoff note

Purpose: lets the next session (or another role) continue your work without asking you. Write it when you stop with work unfinished, or when you pass work to someone else. Save as `handoff/<role>-<topic>-<date>.md`.

```markdown
# Handoff: <topic> (<date>)

From: <role / session name>    To: <role / person>

## One-line state
(Where things stand in one sentence.)

## Done
- What is finished, with links to pull requests or commits (full SHA).

## In flight
- Branch name, base commit, what is half done, what the next step is.
- Uncommitted or local-only changes, and where they are.

## Decisions taken (and by whom)
- Decision, who decided, where it is recorded.

## Waiting for
- Person or role, what exactly, since when.

## Do not do
- Traps: things that look right but are not (for example a local-only branch that must never be pushed).

## How to run and test
- Commands, ports, database name, what works without keys, what needs a key (name the key, never the value).

## Open questions
- Questions that need a person's answer.

## Not verified
- What you did not test or read.
```

Rules: no secrets or personal data; plain words; one topic per note.
