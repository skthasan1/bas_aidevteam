# Handoff note template

Purpose: a short note written at every stop (done, blocked, hold, end of session) so the next session or person can start from it without any chat history. Save it in your handoff folder with the date in the file name.

Keep it factual. Use full commit hashes. Do not include keys, tokens or connection strings; if a secret was involved, write the file path only.

---

# Handoff: <you>, <date and time>

For: <next session, the tech lead, or a named person>

## First three things to do when you come back
1. ...
2. ...
3. ...

## Identity check
The account this work uses and the command that proves it (for example "run `gh api user --jq .login`; it must print `<expected login>`").

## State of work
| Issue | Branch | Last pushed full hash | Pull request | State |
|---|---|---|---|---|
| #<n> | `<branch>` | `<hash>` | <link or none> | building / in review / in test / on hold / merged |

Uncommitted or unpushed work: none / <what and where>.

## Waiting on someone
| Waiting for | What | Since |
|---|---|---|
| <role> | <decision, review, test, key> | <date> |

## Told to others
What I told the tech lead, the tester or the owner, with the date, so nobody has to ask again.

## Not covered or not checked
Gaps, with the reason (no key, no browser, no data, out of scope). A gap is not a pass.

## Spend
No paid calls. / Calls made: what, estimate, actual, who said yes, where the ledger is. Open budget: none / <amount and stop line>.

## Findings logged
Issues I raised this session with severity.

## Holds and standing rules in force
Any hold, freeze or special instruction that still applies.

## Next items I can take
Issues I could take next and any I should not touch (sensitive areas, owned by someone else).
