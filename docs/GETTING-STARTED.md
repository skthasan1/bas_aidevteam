# Getting started

Purpose: walk a new organization from nothing to a working AI team, step by step.

## 1. Prerequisites

- Claude Code installed (or another coding agent that reads a brief and follows it).
- Git and Node.js installed. Check with `git --version` and `node --version`.
- A GitHub organization or account that owns the repositories.
- The GitHub command line tool (`gh`), signed in as you, for the owner's own steps.
- Optional but recommended: Build@Scale with AI installed in each project.
- A folder for the hub, outside every repository. Example: `~/hub`.
- Time: about two hours for the first set-up, and a few short sessions in the first week.

You do not need any AI bot account to start reading and planning. You do need them before an AI changes anything on GitHub.

## 2. Run the onboarding script in dry-run mode

1. Get the kit: `git clone <kit-repository-url> bas_aidevteam`.
2. Write your config from the example in `examples/`: organization name, repositories, people and the areas they own, and the roles to enable. Keep the config out of the kit folder.
3. Run `tools/onboard.mjs` with your config. Without the apply option it is a dry run: it prints what it would create and changes nothing. Run it with the tool's help option to see its options.
4. Read the output. Check the repository list, the people, the areas, the roles.
5. Run it again with the apply option (flags are `--apply` and `--force`; a value other than true or false is an error; `--force` keeps the old config as `qa-projects.json.bak`). The angle-bracket placeholders it knows (`<org>`, `<owner>`, `<hub-path>`, `<repo-list>`) are filled in; the rest (such as `<date>` and `<reason>`) you fill when you use the file. It creates:
   - the hub folder (runbook, config, queue, briefings);
   - one start-up brief per enabled role;
   - a checklist of steps only the owner can do, including copying the files in `templates/repo` (pull request template, issue templates, code owners, baseline CI workflow, label sets) into each repository yourself. The script does not touch your repositories.

6. Run `tools/doctor.mjs --config <your config>`. It fails if (in team mode) a project has no lead AI, or if a project has no one covering review, test, security and decision. Add `--repo <folder>` to check a repository carries the template, the baseline checks and CODEOWNERS, and `--me <your-handle>` to see which projects you own or belong to and what your AI workers may do in each.

Why dry run first: you see exactly what will be written and can fix a wrong config before any file exists.

## 3. What the owner must do by hand

The script never does these, on purpose.

1. **Create the AI identities.** One bot account or GitHub App per role (see `docs/SECURITY-MODEL.md`).
2. **Create tokens** with the smallest scopes, with expiry dates. Put them in your secret store or session environment yourself. Never paste them into a chat or a file.
3. **Give the identities access** to only the repositories they need.
4. **Set repository rules:** branch protection on the main and develop branches, require pull requests, require the CI check, block force-push, turn on code owners.
5. **Copy the repository files** (templates, code owners, CI) into each repository through a pull request.
6. **Create the labels** from the label sets.
7. **Set spend caps** on every key you give a session.
8. **Mark confidential projects** in the hub config.
9. **Choose the watch mode** per repository. Start every repository in review mode.
10. **Decide your own limits:** what always needs your own look (production, payments, access, schema changes).

Tick each item on the checklist the script gave you.

## 4. Start each role session with its brief

For every role:

1. Make a folder for it: its own clone or worktree.
2. Give it its own ports and its own database name (see `docs/ARCHITECTURE.md`).
3. Open Claude Code in that folder.
4. Paste the start-up message from the role's brief in `roles/`. The brief says what the role is for, what it may do, its daily loop and what it must never do.
5. Ask it to restate its limits in its own words. If it gets one wrong, fix the brief, not the answer.
6. Give it one small first task and watch it.

Start in this order:

1. The tech lead, in the hub folder.
2. One AI developer.
3. The QA lead, once there are pull requests to test.
4. The security lead, once the repositories have CI.
5. The researcher, when you have outside ideas to test.

## 5. First-week plan

**Day 1.** Run the dry run, then apply. Do the owner steps for one repository only. Start the tech lead session. Let it read the runbook and summarise it for you.

**Day 2.** Pick three small, well-described issues. Start the AI developer. Have it do one, test first. Review the pull request yourself, with the tech lead's review beside it.

**Day 3.** Turn on `tools/pr-watch.mjs` on a schedule. Check that it tells the tech lead about new pull requests and says nothing when nothing is new.

**Day 4.** Start the QA lead. Have it test the merged version and write a report that names the full commit. Read the report. Does it say what it did not test?

**Day 5.** Review the week. How many pull requests? What did the reviews catch? Was anything done without a person's approval that should have had one? Fix the briefs. Add the second repository.

**Week 2 and on.** Add the security lead and the researcher. Move a repository from review mode to merge mode only after you have seen several correct reviews and you are comfortable with the rules.

Keep a short list of your own decisions in the hub queue. Every answer you give becomes part of the team's memory.

## 6. Add a second developer's AI team

A second human developer brings their own AI assistant. To add them:

1. Agree on the shared repositories and who owns which area. Put it in the code owners file.
2. The developer creates their AI's identity, with access only to the shared repositories (see `docs/SECURITY-MODEL.md`). It is not shared with anyone else.
3. Give them the developer kit (`dev/`) and the protocol (`docs/PROTOCOL.md`). Their AI follows the same branch-per-issue and test-first rules, and signs its comments the same way.
4. Give their AI its own folder, ports and database, on their machine.
5. Decide who reviews their AI's pull requests. Usually the tech lead, plus the developer themselves.
6. Before their AI edits an area another person owns, it checks open pull requests and code owners and asks the owner.
7. If they run their own hub and tech lead, the two teams interoperate through GitHub only. No access to each other's hub is needed.
8. After a month, check: any overlap problems, any unsigned comments, any review that did not name its commit.

If the other developer does not use this kit, ask them to follow the protocol as a set of conventions. Their pull requests still get the same review.

## 7. When things go wrong

- A token was committed: follow section 3 of the security model. Revoke first.
- Two sessions changed the same files: stop both. Check which branch each is on. Give each its own folder.
- An AI did something you did not allow: do not argue with it. Fix the brief or the permission, and write the rule and its reason in the runbook.
- You are unsure whether a step is safe: ask the tech lead session, then decide yourself.
