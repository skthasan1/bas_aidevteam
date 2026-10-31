# Control panel and headless runs

Purpose: see the team on one local page, and start or stop a headless AI worker without opening its session.

Two tools do this. They have no dependencies and need Node 20 or newer.

- `tools/run-role.mjs` runs ONE worker without a person in the session (from a terminal, a scheduler or the panel).
- `tools/panel.mjs` is a small local web page that shows the hub and calls `run-role` for you.

## 1. What the panel is

A page on your own computer. It shows:

- Overview: the mode, and every project with who covers review, test, security and decision, and its merge policy.
- Team: each worker (person, role, account), its `headless` setting and its last run, with buttons to preview and start a run.
- Decisions queue: the contents of `queue.md`, handoff notes and when each watch last ran.
- Runs: the last runs with status, a log viewer and a Stop button.
- Doctor results: the same policy checks as `tools/doctor.mjs`.

It is a window and a remote control, not a second brain. It cannot edit the config, merge, push, comment on GitHub or touch keys. Its only write actions are: preview a run, start a run, stop a run it started.

## 2. How to start it

```example
node tools/panel.mjs --config acme-hub/qa-projects.json --hub acme-hub
```

It prints one address, for example `http://127.0.0.1:4310/?token=...`. Open it in your browser. The token is random, created when the panel starts and shown only once. Stop the panel with Ctrl+C; the next start makes a new token. `--port` changes the port (default 4310; `0` picks a free one).

The config file is read again on every request, so a change to it shows after Refresh. Headless settings are changed in the config by a person, never from the page.

## 3. Setting up a worker for headless runs

In the config add a `runner` and, per worker, `headless` (and a `folder`, the working copy the agent starts in):

```example
"runner": { "command": "agent-a", "args": ["--your-non-interactive-flags"], "prompt_via": "arg", "timeout_minutes": 30 },
"roles": { "ai-developer": { "account": "acme-dev-bot", "headless": "write-branch", "folder": "../acme-worktrees/dev-1" },
           "tech-lead": { "account": "acme-techlead-bot", "headless": "read-only", "folder": "../acme-worktrees/lead" } }
```

- `headless` is `false` (default, the worker cannot run headless), `"read-only"` (reads and reports, writes only its handoff note) or `"write-branch"` (may commit to a NEW branch; ai-developer only).
- The tech lead only reviews and reports in a headless run: no merge power. No headless worker may spend money.
- `runner.command` is run directly, never through a shell. On Windows name the real program (an `.exe` or `node`), not a `.cmd` shim. Check your agent's own documentation for the exact non-interactive flags; the kit does not assume any.
- `prompt_via` is `"arg"` (the prompt is the last argument) or `"stdin"` (sent on standard input; prefer this for long prompts, because command lines have length limits).
- `timeout_minutes` defaults to 30 and may not exceed 240. When it passes, the process is killed and the run is recorded as timed out.

`node tools/doctor.mjs` fails when a worker has `write-branch` on another role, or when a worker is headless and there is no `runner`.

## 4. Running from the terminal

```example
node tools/run-role.mjs --config acme-hub/qa-projects.json --hub acme-hub --role ai-developer --person dana-owner --task "Fix the flaky login test"
```

Without `--apply` this is a dry run: it prints the exact command, folder, timeout, log path and the full prompt, and writes nothing. Add `--apply` to run it. If one person runs several workers of the same role, say which with `--account`.

The prompt is: fixed headless rules (no merge, no push to a protected branch, no spend, never read or print a key, end with a handoff note, stop and ask instead of guessing), then the role brief (`briefs/<role>-startup.md` from the hub, else `roles/<role>.md` from the kit), then the worker's latest handoff note, then your task.

Each run writes `runs/<UTC date>-<role>-<n>.log` (output, with token patterns hidden) and `runs/<same>.json` (role, person, account, task, started, ended, exit, timedOut). Only one run per worker folder runs at a time; a lock under `runs/.locks` is treated as stale after the run's timeout.

## 5. Security model of the panel

- It listens on `127.0.0.1` only.
- A random token is needed for every request. The first load carries it in the address and trades it for an `HttpOnly`, `SameSite=Strict` cookie; the API accepts the cookie or an `x-panel-token` header, never the query.
- A `Host` header other than `127.0.0.1:<port>` or `localhost:<port>` is refused (DNS rebinding).
- Every POST needs an `Origin` that matches the panel and a JSON content type. No CORS headers are sent, so other sites cannot call it.
- Starting a run needs a preview of exactly that run within the last five minutes; the preview is good for one start, and a changed task or prompt needs a new preview.
- The page cannot choose a folder or a command: both come from the config.
- Only three files are served, matched by exact name. Run logs are read by a strict id pattern, as regular files only, with a size cap. Nothing outside the hub and the config is read.
- Responses carry `Content-Security-Policy: default-src 'self'`, `X-Content-Type-Options: nosniff` and `Cache-Control: no-store`. The page loads nothing from outside, uses no inline script, and sets text as text, never as HTML.
- Everything the panel sends back is passed through a redactor that hides token patterns and the values of secret-looking environment variables. The environment is never returned.

Limits: it is for one person on a trusted computer, not a hosted service; do not put it behind a proxy or expose its port. A person with access to your user account can read the token from the process or browser. The panel can only stop runs it started itself; a run started from a scheduler is stopped by killing its process. Redaction is pattern based and is not a guarantee: keys must still never be in a task, a brief or a note.

## 6. Scheduling a run

Dry-run first, then schedule the same command with `--apply`. Use absolute paths. The scheduler's environment must hold whatever the agent needs to sign in; do not write keys into the command.

Cron (Linux or macOS), every weekday at 07:30:

```example
30 7 * * 1-5 cd /srv/acme-kit && /usr/bin/node tools/run-role.mjs --config /srv/acme-hub/qa-projects.json --hub /srv/acme-hub --role tech-lead --task "Review open pull requests and write the handoff note" --apply >> /srv/acme-hub/runs/cron.out 2>&1
```

Windows Task Scheduler, from a command prompt:

```example
schtasks /Create /SC DAILY /ST 07:30 /TN "Acme tech lead morning review" /TR "node C:\acme-kit\tools\run-role.mjs --config C:\acme-hub\qa-projects.json --hub C:\acme-hub --role tech-lead --task \"Review open pull requests and write the handoff note\" --apply"
```

A scheduled run has no person watching, so schedule only workers set to `read-only`, or `write-branch` for an ai-developer whose branches are reviewed before any merge. Read the log and the handoff note the next morning.
