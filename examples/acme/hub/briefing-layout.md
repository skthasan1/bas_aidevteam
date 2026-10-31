# Daily briefing layout

Purpose: the layout of the one briefing the tech lead writes each day, one section per project, so the owner can read it in five minutes. Save as `briefings/<date>.md`. Facts come from tools (pull request list, test feed, issue status); the narrative is written by the tech lead.

```markdown
# Briefing <date>

## Needs you today
- (decision rows from queue.md that are open or due; one line each; link)
- (alerts: concern, excluded area, refused merge, failing check)
If empty, write "Nothing needs you today."

## Team status
| Role | Doing | Blocked on | Idle since |
|---|---|---|---|
| tech-lead | | | |
| ai-developer | | | |
| qa-lead | | | |
| security-lead | | | |
| researcher | | | |

## Project: <project name>
- **Merged since the last briefing:** repo, pull request title, who, verdict (from the watch log).
- **Open pull requests:** count; oldest; any waiting on the owner.
- **Testing:** last report (link, full commit, pass/fail counts); findings open; fixes awaiting re-test.
- **Security:** open findings by severity; new this week; due items.
- **Research:** entries in progress; verdicts waiting for an action.
- **Risks / gaps:** things not covered, with the reason.
- **Next:** the next three items for this project.

(repeat the project section for each project; keep confidential projects in their own file)

## Spend
- Today: $<amount> against the budget $<budget>. Source: the ledger.

## Instances updated after merges
- One line per instance.
```

Rules for the briefing: no secrets, no personal data; every number has a source; say "unknown" instead of guessing; keep it to one screen per project.
