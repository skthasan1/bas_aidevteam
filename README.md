# Build@Scale AI Dev Team

### A small, accountable AI team for your organization. Locally and through GitHub.

Purpose: explain what the kit is, who it is for, and how to install it in three steps.

---

Once you build with one AI agent, the next step is several. Without rules, several agents make a mess: they edit the same files, share one login so nobody can tell who did what, merge things nobody checked, spend money nobody approved, and forget everything overnight.

**Build@Scale AI Dev Team** (short: BAS AI Dev Team) gives you the rules, the roles and the small tools to run a few AI sessions as a real team. Each AI has one job, one identity, one workspace and one list of things it must never do. People stay in charge of approvals, releases, spending and access. GitHub is the shared record, so human developers and other people's AI teams can work with yours.

It is a sibling of **Build@Scale with AI**. That one makes a single project production-ready. This one runs a team across many projects.

---

## Who it is for

- An owner or founder who already builds with Claude Code and now wants a reviewer, a tester and a security check that do not depend on one tired person.
- A tech lead who reviews more pull requests than one human can.
- A small organization with a few human developers, each with their own AI assistant, who must work on the same repositories without stepping on each other.
- Two organizations whose AI teams need to work together through GitHub.

You do not need to write code. You do need to be comfortable with a terminal, Git and GitHub.

---

## What you get

- **Five roles**, each with a brief, a permission contract and a start-up message.
- **A hub**: a local folder that holds the runbook, the config, a queue of decisions for people, and daily briefings.
- **A protocol** for GitHub: how an AI signs a review, what a clearance must say, when an earlier clearance may be carried forward, who owns which area.
- **A developer kit**: branch per issue, test first, small pull requests, review tiers.
- **A QA kit**: test strategy, report and finding templates, a UI-standards checklist.
- **A researcher kit**: a pipeline for testing outside ideas blind, with a registry and a rule that every judged test ends in an action.
- **Watches**: small scripts that tell the tech lead session when a pull request or a question needs attention.
- **An onboarding script** that builds your hub and tells you the steps only you can do.
- **A security model** that covers identities, tokens, spending and confidentiality between projects.

---

## How it works in 3 steps

### Step 1 - Get the kit

In a folder where you keep your tools, run:

```
git clone <kit-repository-url> bas_aidevteam
```

Replace `<kit-repository-url>` with the address of this repository.

### Step 2 - Run the onboarding script in dry-run mode

Copy the example config from `examples/` to your own file and fill in your organization, repositories, people and the roles you want. Then run `tools/onboard.mjs` with your config (use its help option to see the exact options).

By default it only shows what it would create. Read the output. When it looks right, run it again with the apply option. It creates your hub folder, the role briefs and the repository files to copy. It never creates accounts and never touches a token.

### Step 3 - Start the first role sessions

Open Claude Code in the hub folder for the tech lead. Paste the start-up message from the tech lead's brief. Then do the same for the AI developer, in its own folder. Add the other roles when the first two work well. `docs/GETTING-STARTED.md` has the full walkthrough and a first-week plan.

> **Tip:** the kit works best with Build@Scale with AI installed in each project (`/pipeline`, `/audit`, `/mft`, `/security`). It works without it, but it is weaker.

---

## The roles

| Role | Core job |
|---|---|
| Tech lead | Reviews every change, raises issues with an owner and a priority, keeps the process, merges only what the rules allow |
| AI developer | Builds small pull requests, test first, one issue each |
| QA lead | Tests the exact version, free and local, and writes the report |
| Security and compliance lead | Weekly audit, routes findings to the right place, checks readiness |
| AI researcher | Designs and runs blind tests of outside ideas and makes sure each verdict ends in an action |

Details and how to combine roles: [docs/ROLES.md](docs/ROLES.md).

---

## Documents

- [docs/DESIGN.md](docs/DESIGN.md) - the design and the principles
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - layers, data flow, what runs where
- [docs/PROTOCOL.md](docs/PROTOCOL.md) - the interop specification
- [docs/SECURITY-MODEL.md](docs/SECURITY-MODEL.md) - identities, tokens, secrets, destructive actions, walls between projects
- [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md) - onboarding walkthrough
- [docs/ROLES.md](docs/ROLES.md) - the five roles
- [CHANGELOG.md](CHANGELOG.md) - release history

---

## What it is not

- **Not autopilot.** The AI team proposes, prepares, reviews and tests. A named person approves releases, spending, access and anything that cannot be undone.
- **Not a hosting service.** The AI sessions run where you run them, on your machine or your own server. The kit does not host them.
- **Not a dashboard or a billing tool.** The hub is plain files. There is no web interface in 0.1.
- **Not a security guarantee.** It lowers risk with separate identities, small permissions and written rules. It does not replace a real security review, and an AI can still be wrong.
- **Not a replacement for human developers.** It is built so that humans and AI teams can share the same repositories.
- **Not finished.** This is version 0.1.0. The protocol and the tools will change.
- **License:** CC BY 4.0, the same as Build@Scale with AI: use it, adapt it, build products with it, share it with your team, and keep the attribution "Build@Scale AI Dev Team, part of Build@Scale with AI by Siva Kannathasan". The LICENSE file is added when this kit is published and linked from the framework.
