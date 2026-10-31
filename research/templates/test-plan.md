# Test plan: <library id> (<date>)

Purpose: say exactly what will be run, what it costs and when it stops, before anything is spent.

- Registry search: `registry.mjs find <words>` result: <"not run before" or earlier test id and what is new>
- Budget: <approved amount>, hard stop <stop line>. Approved by: <named person>, in the session that will spend (date).
- Runner: <role or person>
- Throwaway environment: <name; never a live system>
- Ledger: <file>. A line is written BEFORE each paid call.

## Rules for this plan
- Nothing runs on a live system. Capped keys only. No prompt or code is committed.
- Outputs stay local or in the media store. Media never go into git.
- Blind judging where taste is involved: shuffled neutral names, key held outside the repository, review block on the sheet.
- Dry run first (free).

## Order (cheapest first within priority)
| Test id | Question it answers | Variants | Sample | Estimate | Result that would change the decision |
|---|---|---|---|---|---|

## Report
Path: <report file>. Per test: exact prompts, model ids, counts, cost, files, judging result, failures, total versus stop line.
