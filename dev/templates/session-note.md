# Session note template

Purpose: the permanent record of one working session (what was done, what was decided, what was learned). It is longer-lived than a handoff note, which is for the very next start.

Rules: one file per session, named by date. Keep an index with one line per session; do not paste old notes into always-loaded instruction files. Facts, decisions and lessons stay apart. No secrets.

---

# Session note: <date>, <role or name>

**Index line (copy to the index):** <date> - <one line: what the session achieved>

## Goal of the session
One or two sentences.

## What was done
| Issue | Result | Pull request | Full head hash |
|---|---|---|---|
| #<n> | merged / in review / blocked | <link> | `<hash>` |

## Tests and evidence
Commands run and results at the final head. Test counts: before, after (say "previous plus delta, not a fresh run" if the full suite was not re-run).

## Decisions
| Decision | Who decided | Where recorded |
|---|---|---|
| ... | tech lead / owner | issue or pull request link |

## Findings logged
Issues raised, with severity.

## Spend
Paid calls, estimate against actual, who said yes. "None" if none.

## What went wrong or surprised me
Mistakes, near misses, wasted time, and the cause.

## Lessons
Rules or checks this suggests, one line each, with the reason. Mark which you propose adding to the team rules.

## Left open
Anything unfinished and who it is waiting for. The handoff note holds the first steps for next time.
