# Setup guide for the coding agent

Purpose: this file is read by a coding agent (Claude Code, Codex or any other) on behalf of a person who wants to set up Build@Scale AI Dev Team. The person pastes one short prompt (see the README); the agent follows this file.

If you are the agent: you are helping a person, not deciding for them. Follow the rules, then the steps.

## Rules for the agent

1. **Ask, do not guess.** Ask one block of questions at a time (a "form"). For each question, offer the choices, say which one you recommend and why in one sentence, and accept a plain answer. If an answer is unclear, ask again; never fill a blank with a guess.
2. **Show before you write.** Before writing any file outside the kit folder, say what you will write and where. Dry run first, then ask for a yes, then apply.
3. **Never read, print, paste or ask for a key, token or password.** If a step needs one, tell the person where it goes and let them put it there themselves.
4. **Never create accounts, change repository settings, change access, spend money, or push, merge or deploy anything.** List those as steps for the person in the to-do file.
5. **Write answers down as you go** in a file called `bas-setup-answers.md` in the hub folder, so the person can stop and resume. At the start, look for that file and offer to continue from it.
6. **Use plain words.** The person may not code. Explain a term the first time you use it.
7. **Say what you did not do.** End every phase with what was done, what was not, and what is next.

## Phase 0: get the kit and check the machine

1. Ask where the person keeps their tools, and clone the kit there if it is not already on the machine: `git clone https://github.com/skthasan1/bas_aidevteam bas_aidevteam`.
2. Check that `node --version` is 20 or newer and `git --version` works. If `gh --version` works, note it (it is needed only for the watches). If something is missing, tell the person how to install it and stop that step.
3. Check which instruction file your agent reads (for example `CLAUDE.md`, `AGENTS.md`). You will use it in Phase 5.

## Phase 1: form 1, what are we setting up?

Ask:

1. **Starting point.** (a) A new project from scratch, (b) one or more existing projects, (c) both. Recommend (b) if code already exists.
2. **Mode.** (a) Solo: one person, one owner, (b) Team: several people, each with their own AI workers. Recommend solo if the person is alone today; it can be changed to team later by editing one line.
3. **Organization name** (a short lowercase name) and **the person's GitHub handle** (the owner).

## Phase 2: form 2, the projects

For each project, ask:

1. A short id (lowercase letters, digits and dashes) and a human name.
2. Its repositories (`owner/repo`). For a new project with no repository yet, say so: the to-do will say how to create it. Do not create it.
3. Who owns it (GitHub handles). In solo mode this is the person.
4. Is it confidential from the other projects? If yes, write that in the answers file; confidential projects never get named in other projects' issues or reports.
5. Testing: active, hold, or later. Watching pull requests: merge, review, or off. Recommend review (or off) until the person has watched the first week; recommend merge only for a project where the owner is comfortable letting the lead AI merge after the written conditions.
6. **Who may merge here:** owner only, the lead AI after conditions, or the lead AI only when the owner says so each time. Recommend owner only for anything touching money, sign-in, data or production.

## Phase 3: form 3, the people and their AI workers

For each person (in solo mode, only the owner):

1. Which AI workers do they want? The roles are tech lead, AI developer, QA lead, security and compliance lead, and researcher. A person may run several of one role (for example three AI developers) and may skip roles. Recommend: tech lead plus one AI developer to start.
2. **How will they run each worker?** (a) A window of their editor (for example a VS Code window opened on the worker's own folder), (b) a terminal session in the worker's folder, (c) in the background on a schedule (read-only work such as reviews, tests and audits; the optional `tools/run-role.mjs` and `tools/panel.mjs` support this). Any mix is fine, and one person may use different ways for different workers. Recommend (a) or (b) for every worker at first; add (c) later for routine reviews. Write the answer next to each worker. If a worker runs in an editor window, offer a color for its window (the kit has a default per role, so the person can tell who is who the moment a window opens) and let them override it with a `#rrggbb` value.
3. What account will each AI worker use on GitHub (its own bot account or app; never the person's own login)? If none exists yet, leave it blank: the to-do will explain.

Then ask the **coverage questions**, once per project. These four functions are never optional; each must be covered by an AI role someone runs or by a named person:

1. **Review:** who reads each change besides its author?
2. **Test:** who runs the exact version and writes down what was not covered?
3. **Security:** who checks secrets, access and data boundaries?
4. **Decision:** who decides spend, releases, access and anything that cannot be undone? This is always a person who owns the project, and it can be more than one person. If different people decide different things (for example one decides merges and another decides spend), record that as `decision_areas`.

If the person skips a role, they must name who covers that function instead (themselves, a teammate, or a teammate's AI). Do not accept "nobody" or "later" for any of the four. If they say "I will do it", write `person:<their handle>`.

Also ask which AI is the **lead** of each project (the one that talks to other teams' AIs). Recommend the tech lead AI.

## Phase 3b: form 4, the identity of each AI worker

Every AI worker gets its own GitHub identity, so a comment shows which worker wrote it and no AI acts under a person's login. The reference is `docs/IDENTITIES.md`; read it first.

For each AI worker, ask:

1. **Identity type:** (a) a GitHub App (recommended: no extra seat, one-hour tokens), or (b) a machine user (a second GitHub account). Recommend (a) unless the person needs the AI's approval to count as a required review.
2. **Where it works:** only the person's own account, only one organization, or both. If both, the App must be set to "Any account" when created. Say plainly that "Any account" only makes the App's install page public; access still depends on the private key and on who installs it.
3. **Name:** suggest `<org>-ai-<role>` in lowercase.

Then walk the person through creating each App, step by step (docs/IDENTITIES.md section 2), one worker at a time. You may print the exact name, description, permissions and repositories to select (the generated `ONBOARDING-TODO.md` has them per worker). The person does every click. Never ask for, read, print or handle the private key or any token: ask only for the **App ID** and the **path** of the `.pem` file, and write those into the config as `app`. Check that the key file is outside every repository.

Also show the person the controls for each role (`docs/IDENTITIES.md` sections 6 and 7): where the AI may be installed, what it may and may not do, and the repository rules a person sets once per repository (protected `develop` and `main`, CODEOWNERS on sensitive paths, no Administration for any App). Ask them to confirm each rule is in place; you cannot check them, and you must not change repository settings yourself.

When an App exists and is installed, verify it: run `node tools/app-token.mjs` for each owner it is installed on (it prints a token, which you must not show or store), then ask the person to name a pull request and post one test comment with `node tools/as-app.mjs`. It must appear as `<name>[bot]`. If a worker has no identity yet, leave `app` and `account` empty: `doctor` will warn that it would act under a person's login, and the to-do lists the step.

## Phase 4: write the config, dry run, doctor

1. Write the person's config (JSON) from their answers, following `examples/acme/qa-projects.json`. Put it in the hub folder, outside the kit folder. Show it to the person.
2. Run `node tools/onboard.mjs --config <config> --target <hub folder>` (a dry run). Show the list of files. Ask for a yes.
3. Run it again with `--apply`.
4. Run `node tools/doctor.mjs --config <config> --me <person's handle>`. If it reports a problem, explain it in plain words, ask the question that fixes it, update the config, and run it again. Do not continue until it prints OK.

## Phase 5: Build@Scale with AI is mandatory in every project

Every project the team works on adopts the sibling framework, **Build@Scale with AI**. It gives each project its design-first process, tests, docs and audit habits. For each project repository the person has on this machine:

1. Ask for the repository's folder. For a new project, create the folder with the person's yes, run `git init`, and tell them to create the GitHub repository themselves (or ask them to do it and continue after).
2. In that folder: `git clone https://github.com/skthasan1/buildatscale shared`.
3. Then follow the framework's own setup prompt in `shared/README.md` (step 2 there). In short: copy `shared/commands/*.md` to the place your agent reads commands from (for Claude Code, `.claude/commands/`), copy `shared/settings-template.json` if your agent uses it, record `shared/VERSION`, read `shared/FRAMEWORK.md`, run the gap analysis against its Session 0 checklist, and build what is missing before any feature work. If your agent has no slash commands, read the matching file in `shared/commands/` and follow it when a step names that command.
4. Copy the repository files from `templates/repo` (pull request template, issue templates, `CODEOWNERS`, baseline checks) into the repository on a branch, and open a pull request only if the person says yes.
5. For a **new project**, run the framework's scaffold command (`shared/commands/scaffold.md`) with the person.
6. Run `node tools/doctor.mjs --config <config> --repo <that repository folder>`. It fails if the framework or the repository files are missing. Fix and rerun.

## Phase 6: start-up

1. Put the kit's instruction snippet (`templates/hub/CLAUDE.md.snippet.md`) into the instruction file your agent reads in the hub folder (`CLAUDE.md`, `AGENTS.md` or the equivalent), and fill in the person's details.
2. Tell the person how to start each AI worker, in the way they chose: open the worker's own folder (as an editor window or in a terminal), start the agent there, and paste the start-up brief from `<hub>/briefs/<role>-startup.md`. Each worker gets its own folder, its own ports, its own database and its own account, whichever way it is run. The onboarding script writes `<hub>/START-WORKERS.md` with the exact steps per worker for the way it is run, and, for editor workers, a `workers/<worker>/vscode-settings.json` (window title and colors). With the person's yes, copy each into that worker's own folder as `.vscode/settings.json` and add that path to the folder's `.git/info/exclude`; never commit it. For a worker the person wants in the background, show them `tools/run-role.mjs` (dry run first) and `docs/PANEL.md`, and set that worker's `headless` setting in the config; never turn it on without their yes.
3. Hand over `<hub>/ONBOARDING-TODO.md`: the steps only the person can do (accounts, tokens, repository settings, branch protection). Walk through the first three with them if they want. Never do these yourself.
4. Summarize: what exists now, what is left, and the next small thing to do (usually: open the tech lead worker and review one pull request).

## When something does not fit

If a situation is not covered here, stop and ask the person. Do not invent a rule. Write the question in `bas-setup-answers.md` under "Open questions".
