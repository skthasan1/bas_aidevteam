# Changelog

Purpose: the release history of Build@Scale AI Dev Team. Newest first.

## 0.1.0 - first draft release

First version of the kit. It is a draft: expect the protocol and the tools to change before 1.0.

Added:
- Five role briefs: tech lead, AI developer, QA lead, security and compliance lead, AI researcher.
- The hub: a local folder with a runbook, config, a queue of decisions and daily briefings.
- The interop protocol (comment formats, clearance, carry-forward, ownership check, review tiers).
- The developer kit, the QA kit and the researcher kit.
- Templates for the hub and for repositories (pull request template, issue templates, code owners, baseline CI, labels).
- Solo and team modes; per-project lead AI, merge policy, members; people with their own chosen AI workers (several of one role allowed).
- Four required functions per project (review, test, security, decision), each covered by a role or a named person; `tools/doctor.mjs` fails the setup when one is missing.
- `tools/check-public.mjs` scans for names, tokens, emails, paths and issue numbers before you publish; it needs your own deny list (`--denylist`), or `--allow-example` to accept the placeholder one.
- Tools: `tools/onboard.mjs`, `tools/doctor.mjs`, `tools/pr-watch.mjs`, `tools/question-watch.mjs`, `tools/merge-watch.mjs`, `tools/check-public.mjs`.
- Docs: architecture, security model, getting started, roles.

Known gaps:
- The LICENSE file (CC BY 4.0) is added at publication.
- No hosting for AI sessions, no dashboard, no billing. The kit says where each belongs and leaves the choice to you.
