# Build@Scale AI Dev Team

### A small, accountable AI team for your projects. Works with Claude Code, Codex or any coding agent.

Purpose: say what problem this solves, who it is for, what it does, and how to set it up with one paste.

---

## The problem

One AI agent builds fast. Several agents, without rules, make a mess:

- they edit the same files and overwrite each other's work;
- they share one login, so nobody can tell who did what;
- nobody independent reviews or tests what they build, so the author marks its own homework;
- they merge, spend money or touch production without a person's yes;
- they forget everything overnight, and a second team's agents cannot tell what yours decided.

## Who it is for

- **Solo builders** who want a reviewer, a tester and a security check that do not depend on one tired person (you).
- **Small teams** where each human developer has their own AI workers and everyone shares the same repositories.
- **Tech leads** who review more pull requests than one human can.
- **Two organizations** whose AI teams must work together through GitHub.

You do not need to write code. You need a terminal, Git, GitHub and a coding agent.

## What it does

- **Gives each AI one job, one identity, one workspace and a list of things it must never do.** Roles: tech lead, AI developer, QA lead, security and compliance lead, researcher. You pick the roles you run and how many of each.
- **Makes four functions mandatory in every project:** review, test, security and decision. Each is covered by an AI role or a named person. People always make the decisions: releases, spending, access, anything irreversible.
- **Uses GitHub as the shared record,** in a fixed format (the protocol), so human developers and other teams' AI teams can read and rely on it.
- **Works however you run your sessions:** one editor window per worker (each with its own color and title, so you know who is who at a glance), a terminal per worker, or a worker in the background on a schedule. A worker is a folder, a brief and an identity, so the surface does not matter.
- **Runs the team from a local hub:** a folder of plain files with the runbook, config, a queue of decisions for people and daily briefings.
- **Checks itself.** Small scripts watch pull requests and questions, and a `doctor` command fails the setup when something required is missing.
- **Brings Build@Scale with AI to every project,** the sibling framework that gives each project its design-first process, tests, docs and audits. It is mandatory.

## Set it up: one paste, no manual steps

Open your coding agent in a folder where you keep your tools and paste this:

```
Set up Build@Scale AI Dev Team for me. Clone https://github.com/skthasan1/bas_aidevteam into a folder called bas_aidevteam (skip if it is already there), read SETUP.md in it, and follow it step by step. Ask me the questions in SETUP.md one form at a time, recommend an answer for each, and do not write, push or spend anything until I say yes.
```

Your agent does the rest:

1. **Pulls the kit** and checks your machine.
2. **Asks you short forms,** each question with a recommended answer: new project or existing, solo or team, your projects and owners, which AI workers each person runs, and who covers review, test, security and decision.
3. **Writes your config, shows a dry run,** and applies it only after your yes.
4. **Runs `doctor`** and fixes what it reports with you.
5. **Adopts Build@Scale with AI in every project** (it is pulled into each repository, and a new project is scaffolded).
6. **Starts your team:** it tells you how to open each AI worker and hands you a short list of the few steps only you can do, such as creating accounts and tokens. It never creates accounts and never touches a token.

Your answers are saved as you go, so you can stop and come back.

## The roles

| Role | Core job |
|---|---|
| Tech lead | Reviews every change, raises issues with an owner and a priority, keeps the process, merges only what the rules allow |
| AI developer | Builds small pull requests, test first, one issue each |
| QA lead | Tests the exact version, free and local, and writes the report |
| Security and compliance lead | Weekly audit, routes findings to the right place, checks readiness |
| AI researcher | Designs and runs blind tests of outside ideas and makes sure each verdict ends in an action |

Details and how to combine roles: [docs/ROLES.md](docs/ROLES.md).

## What is in the kit

- [SETUP.md](SETUP.md) - the guided setup your agent follows
- [docs/DESIGN.md](docs/DESIGN.md) - the design and the principles
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - layers, data flow, what runs where
- [docs/PROTOCOL.md](docs/PROTOCOL.md) - the interop specification
- [docs/SECURITY-MODEL.md](docs/SECURITY-MODEL.md) - identities, tokens, secrets, destructive actions, walls between projects
- [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md) - what the setup does, in plain steps
- [docs/ROLES.md](docs/ROLES.md) - the roles and the four required functions
- [docs/PANEL.md](docs/PANEL.md) - the optional local control panel and background runs
- `roles/`, `dev/`, `qa/`, `research/` - the briefs and kits for each role
- `templates/` and `tools/` - hub and repository templates, the watches, `onboard`, `doctor`
- [CHANGELOG.md](CHANGELOG.md) - release history

## What it is not

- **Not autopilot.** The AI team proposes, prepares, reviews and tests. A named person approves releases, spending, access and anything that cannot be undone.
- **Not a hosting service.** The AI sessions run where you run them, on your machine or your own server.
- **Not a hosted dashboard or a billing tool.** The hub is plain files. An optional control panel runs on your own machine only (`docs/PANEL.md`).
- **Not a security guarantee.** It lowers risk with separate identities, small permissions and written rules. It does not replace a real security review, and an AI can still be wrong.
- **Not a replacement for human developers.** Humans and AI teams share the same repositories.
- **Not finished.** This is version 0.1.0. The protocol and the tools will change.

## License

CC BY 4.0, the same as Build@Scale with AI: use it, adapt it, build products with it, share it with your team, and keep the attribution "Build@Scale AI Dev Team, part of Build@Scale with AI by Siva Kannathasan". The LICENSE file is added when this kit is published and linked from the framework.
