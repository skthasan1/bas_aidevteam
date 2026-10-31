# Morning decisions

Purpose: one short page the owner reads first thing: only the decisions that block the team today, each answerable in a word. Written by the tech lead from the queue. Save as `briefings/<date>-decisions.md`.

```markdown
# Decisions for <owner>, <date>

Reply with the id and your choice, for example "D-004: b". Anything not answered stays open and the team works on what it can.

## Blocking work today
### D-004: <question in one line>
- Who is waiting: <role>, since <date>
- a) <option> (what happens)
- b) <option> (what happens)
- Recommendation (AI): <a or b>, because <one line>. Not verified: <one line>.
- If you do not answer: <what the team does instead>

## Can wait
- D-007: <question> (due <date>)

## Needs your own action (only you can do these)
- Create or rotate a key: <name of the key, never the value>
- Grant access: <who, which repo, what level>
- Approve spend: <amount, what for, say yes in the session that will spend>
- Repository settings: <what to change>

## Merge requests
- <pull request title, link>: summary in two lines; recommendation. Say "merge" to approve.
```

Rules: three decisions at most in the "Blocking" list; if there are more, rank them and say why. Plain words. No secrets.
