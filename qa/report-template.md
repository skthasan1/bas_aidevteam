# Test report: <product> <suite> <date> #<n>

Purpose: the one format for every test report. Copy this file to `reports/<product>-<what>-<head8>-<YYYY-MM-DD>-<n>.md` and fill every section. If a section does not apply, write "not applicable" and why.

Written for: the tech lead and the owner. Tester: the QA lead (an AI session).

## 1. What was tested

- **Tested head (full commit id):** `<40 characters>`
- **Branch or pull request:** `<name or number>`; merged or not merged at the time: `<which>`
- **Why this run:** `<what changed / scheduled / release / re-test of a fix>`
- **Suite:** `<targeted / regression / full / free checks>`
- **Environment:** local or shared; how it was started; database (local, throwaway); browser and version; viewports; themes; OS
- **Date and duration:**
- **Cost:** `$0` or the amount and who approved it (free runs say `$0`)

## 2. Result at a glance

- **Counts:** passed X, failed X, blocked X, not run X (reasons for blocked and not run below)
- **Verdict line (a recommendation, not a decision):** `<safe to merge / not safe / cannot say>` and one sentence why

## 3. Facts: what happened

| Scenario or check | Result | Number or observation | Finding row | New or known | Evidence |
|---|---|---|---|---|---|

Failed and blocked items first. Give the measured number wherever there is one (pixels, seconds, ratio, status code).

## 4. Checklists run

| Checklist | Sections run | Pass | Fail | N/A | Not measured |
|---|---|---|---|---|---|
| UI standards | | | | | |
| Practice | | | | | |

For every fail, the number measured. For every not-measured, the reason.

## 5. Not reached (a gap is not a pass)

List everything you did not test or could not test, one per line, with the reason:

- `<what>`: `<why not: no access / needs a real device / needs a paid call / needs a human listener / ran out of time / feature flag off / a stub cannot tell>`

If this section is empty, say "I looked for gaps and found none" and name what you checked. See `evidence-and-limitations.md`.

## 6. Scenarios added or fixed during the run

- ...

## 7. Recommendations

Numbered. Each is a suggestion for the tech lead or owner. None is a decision.

## 8. Decisions needed

Each item: the question, the options with evidence, your recommendation, what you could not verify. Leave empty if none.

## 9. Security hand-off

One line: "Nothing to flag" or "Flagged to the tech lead privately, not detailed here". Never describe a vulnerability in a report that is shared more widely than the tech lead.

## 10. Confidentiality note (only if the product is confidential)

If the product has its own confidentiality rule, this report stays in that product's folder and uses only the words allowed there. Keep product-specific standards in a separate addendum file (see `ui-standards-checklist.md`, section "Project addenda").
