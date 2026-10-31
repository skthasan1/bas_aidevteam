# Pull request description template

Purpose: copy this into every pull request so the reviewer and tester know what changed, how to check it, and what was not covered.

---

**Closes:** #<issue>  
**Branch:** `<you>/<issue>-<short-name>` cut from develop at `<full hash>`  
**Stacked on:** none / `<other pull request>` (merge order: ...)  
**Size:** <n> hand-written lines (tests and docs not counted). Oversized-file exception: no / yes, because ...

## Sensitive hunks (T2 and T3): hunks a person must read
Leave "none" if there are none. At most 10 lines. For each: `file:line`, what the change allows, what it does not.

- none
- `<file>:<line>` - <change>. Allows: <...>. Does not allow: <...>.

## What and why
Two to five sentences. What was wrong or missing, what this changes, what users or other code will notice.

## How to verify
Exact steps or commands, and what you should see.

1. ...
2. ...

## Evidence
- Failing test before the fix: `<command>` -> <result>
- Passing after the fix: `<command>` -> <result>
- Counter-factual (fix removed, new test fails; fix restored, passes): yes / no. If no, why.
- Full check at head `<full hash>`: types / lint / tests / build -> <results>

## What was not covered
Anything not tested or not run, and why (no key, no browser, no data, out of scope). A gap is not a pass.

## Sensitive areas touched
Tick any that apply. Any tick means a Sensitive hunks section above.

- [ ] sign-in or access control
- [ ] money, spend or limits
- [ ] database schema or migrations (list the files)
- [ ] deploy or production configuration
- [ ] personal or customer data
- [ ] prompt wording or AI behaviour
- [ ] none of the above

## Cost
No paid call was made. / Paid calls: <what, estimate, actual, who said yes>.

## Notes for the reviewer
Follow-up issues raised (numbers), decisions you need, anything surprising.

Signed: <role> (<who you work for>'s AI assistant, or developer name)
