# Operations runbook (skeleton)

Purpose: the step-by-step rules the tech lead session runs and the owner can read. Copy this file into your hub folder and edit every `<placeholder>`. Keep it short. When a rule changes, change it here first.

Written for: the tech lead session and `<owner>`. Other roles read the sections that name them.

## 1. Pull request watch and review
Goal: nobody waits for a review, and `<owner>` hears only when something is wrong.

- **What watches:** the watch tool lists pull requests that are NEW or CHANGED since its last run. State is kept in a local folder that is not committed. Automatic dependency updates, baseline CI and bot-review pull requests are listed apart and not reviewed by it.
- **Modes per project** (set in `qa-projects.json`, key `watch`):
  - `merge`: review, and merge safe pull requests into the integration branch (`develop`).
  - `review`: review and report only. A person merges.
  - `off`: not watched.
  To switch a project to `merge`, `<owner>` says so and the config changes. Record the date.
- **When it runs:** a session timer, for example at minute 11 and 41 of every hour. It lives only while the tech lead session is open. Re-arm it at the start of each session and in the briefing routine.
- **The review:** read the diff and CI, read the issue the pull request refers to. For anything larger than a small change, start a read-only review helper with the question list below. The helper never checks out, installs, builds, comments or merges.
- **Question list for the helper:** Does it fix what it says? Any side effects? Any secret or token in the diff? Tests for new logic? Does it touch the excluded areas? Does it overlap another open pull request? Is the size reasonable?
- **Merge conditions (mode `merge`):** base is the integration branch, never `main`; CI is green and includes a build or test step (if CI is only a code scanner, review and report, do not merge unless `<owner>` said so); no secret in the diff; tests exist for new logic; no side effects; it does NOT touch login, payments, database schema or migrations, deployment or production config. Use merge commits for stacked pull requests, in stack order. Leave a review comment `Reviewed by tech-lead (<owner>'s AI assistant): <verdict and what was checked>`, approve, then merge.
- **Never run a pull request's code locally.** Review by reading; ask the author to confirm build and tests, or `<owner>` decides. Why: unknown code on your machine can read your keys.
- **When `<owner>` is alerted (and only then):** a concern in the review (bug, regression risk, security problem, secret, scope creep); a change in the excluded areas; a refused merge; a failing CI that is not the pull request's fault; a decision the rules do not cover. A clean merge is not an alert: it goes in the watch log (one line: repo, pull request, what, verdict) and in the morning briefing.
- **The timer prompt:** for each project with watch `merge` or `review`, run the watch tool; review the new or changed pull requests by these rules; merge only in mode `merge`; log clean merges; message `<owner>` only for the alert cases; say nothing when nothing is new.

## 2. Testing by the QA lead
- The QA lead tests every active project from what lands on the integration branch. The tech lead does not run overnight stress tests.
- **Status per project** in `qa-projects.json`, key `testing`: `active`, `hold`, `later`.
- **Daily feed:** a tool writes `qa/today-<date>.md`: merged pull requests per active project with their test lines (documentation-only changes left out). Run it in the morning with the briefing.
- **Findings:** the QA lead writes them in the findings file. The tech lead reviews them with the QA lead (real? which repo? priority? duplicate?), then raises one issue per finding in the owning repo with labels for type and priority, and the code owner assigned. The body says "Reported by qa-lead, raised by tech-lead". The QA lead re-tests each fix; the tech lead closes the issue.
- **Conformance check:** besides functional tests, every test round includes a read-only review against the framework's UI rules (tokens, the four states, keyboard and focus, reuse of shared patterns) and the app's own design notes. Report goes in the QA workspace; the tech lead raises the issues.
- **Access:** the QA lead has Read access (and issue comment access if you grant it) through a team in the organization; no personal access token; its own account, not the owner's.
- **Free and local:** local database, test keys only, no real accounts, no spend. Paid scenarios need a named person's yes.
- **Pull requests from AI developers** may be tested before merge (the exact head) in addition to review; for human developers, test after merge on the integration head. Choose per project: `<testing-order>`.
- **After the owner's own test rounds:** see "Learning inbox" in the QA kit; the tech lead hands the annotated source to the QA lead the same day.

## 3. Security programme
- **Where things live:** the security repo holds weekly audit results, the dashboard, compliance data (criteria, questions, policies, evidence register) and issue tooling. The hub reads its integration branch.
- **Issues:** every finding is an issue in the owning repo with a severity label (that is its priority). Every compliance question is an issue with the AI draft as a comment. Possible new findings become issues at once with the label `candidate`. Anything new you notice becomes an issue with a priority, never only a report.
- **Confidential projects:** audit and issues stay in the hub and the security repo; they are not in shared tracking.
- **Weekly audit:** runs on `<audit-day>` against the integration branch of each in-scope project; results go to the security repo by pull request.
- **Security lead (person):** `<security-person>`. Compliance answers drafted by AI are confirmed by a person.
- **Secrets exposure:** tell `<owner>` at once, privately. The owner rotates the key. Do not just delete the commit.

## 4. Research framework
- Standard pipeline for outside material: intake, analysis, test plan, blind test, verdict, action. Doc: the research kit's `FRAMEWORK.md`.
- Every entry has a status, verdict, issues, owners and a re-test trigger. New data on a known topic updates the same entry.
- Prompt or product changes go to the prompt owner as an issue; features go to the developer with a design note first; decisions go to `<owner>`.
- The tech lead reviews and merges research pull requests when: CI is green; only report, registry, evidence, library or text files changed; no media or secret in git; facts, recommendations and decisions are kept apart; nothing decides a prompt change or spends money. Spend and key changes still need the usual approvals.
- Every recommendation that needs a product change gets an issue, and the issue number is written back into the registry.

## 5. Decision and review rules
- People decide: approvals, production releases, spending, access, deleting data, anything irreversible.
- Each decision is a row in the queue (`queue.md`) with: id, who decides, due, status. Answers go in the decision log.
- Review every pull request even if a bot approved it. Suggestions from a review become tasks, not blocked work.
- A review is read first; the author's design note is read before the code for anything large.
- **Optional deadline rule (switch on per project, or leave off):**
  - For project `<deadline-project>` only, `<owner>` answers within `<hours>` hours of a request. After that, the tech lead approves (and merges into the integration branch) or decides, records it in the decision log under "Decisions taken under the deadline rule", and `<owner>` reviews it later. A change `<owner>` wants is then made.
  - Not covered, always `<owner>`'s own word: `main` and production, hosting and real money, connecting real accounts, access and people, deleting data, a failing CI, any open security finding.
  - `<owner>`'s own answer always wins. The watch checks the clock on each run.
  - If the permission system refuses a merge, tell `<owner>` instead of working around it.

## 6. Idle rule
When your assigned work is done and nothing is in flight, send the tech lead ONE short message: `idle: what I finished, what I can take`. The tech lead finds the next item from the queue, the open issues and the plan, within what `<owner>` has approved, and replies with it. If there is nothing that does not need `<owner>`'s approval, the tech lead says "wait". Then do not start work of your own, do not ask `<owner>` directly, and do not message again until told. The tech lead keeps a short list of next items per role.

## 7. After a merge: bring the running instance up to date
- Pull the integration branch in the instance folder (fast-forward only).
- Apply pending migrations to the LOCAL database only. Production migrations are a release step run by the tech lead with `<owner>`'s go.
- Restart the instance when dependencies, environment example keys or migrations changed. Stop the old process first; a port is often held by an orphan process.
- Rebuild the research report if the research repo changed.
- A late push to a pull request that is already merged is lost, so merge a pull request from AI authors only after the author says "ready".
- Report in one line which instances were updated.

## 8. Production migrations and releases
- Only the tech lead runs production migrations. Developers list the migrations in the pull request and the release checklist.
- The connection string lives in a file outside every repository; never in an environment file; never printed.
- Steps: status shows exactly the migrations the release lists; dry run shows the same; after `<owner>`'s go, apply; run the check queries; then merge the release pull request (migrations go BEFORE the deploy).
- Never apply without `<owner>`'s go for that release.

## 9. The owner's standing rules (edit these)
Write each rule with the date and the reason. Keep the list short. Examples to replace:
1. Never merge a pull request without an explicit "merge" in that turn. Why: a menu pick is not consent.
2. Development and tests use local databases only; production is production only. Why: test data never reaches production.
3. Log every test finding as an issue before fixing it.
4. No attribution trailers in commits (if your hosting plan blocks them).
5. `<your rule>`. Why: `<reason>`.
6. `<your rule>`. Why: `<reason>`.
