# Decision queue

Purpose: one list of every decision that waits for a person, so nothing is lost and the owner sees one page.

How to use it:
- Every decision is a row with an id (`D-001`, `D-002`, ...). Tasks that follow a decision are their own rows (`T-001`).
- Write the question so a person can answer in one line. Put options, evidence and the AI's recommendation in the detail note under the table.
- Who decides is a named person, never a role. Due is a date or "none". Status: `open`, `answered`, `done`, `dropped`.
- When answered: copy the answer to `decision-log.md`, set status, and make the follow-up task rows.
- Do not re-ask what the log already answers.

| id | Question | Who decides | Raised by | Due | Status | Detail |
|---|---|---|---|---|---|---|
| D-001 | Switch `acme-mobile` watch from review to merge? | Dana | tech-lead | none | open | note D-001 |
| D-002 | Approve a research budget of $<amount> for the first blind test? | Dana | researcher | <date> | open | note D-002 |
| T-001 | Add the baseline CI workflow to `acme-notes` | dev-a | tech-lead | <date> | open | issue link |

## Detail notes

### D-001
- **Why it matters:** two lines.
- **Options:** (a) stay in review mode; (b) merge mode for small changes only.
- **Evidence:** links to pull requests or reports.
- **Recommendation (AI):** (a) or (b) and why. Marked as a recommendation.
- **Not verified:** what the AI could not check.

### D-002
(same layout)
