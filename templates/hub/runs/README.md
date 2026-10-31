# Headless runs

Purpose: one record per headless run of an AI worker, written by `tools/run-role.mjs`.

For each run there are two files with the same name, `<UTC date>-<role>-<n>`:

- `.log`: what the agent printed. Token patterns and key blocks are hidden.
- `.json`: the record (role, person, account, task, started, ended, exit, timedOut, stopped).

Rules:

- Read the log and the worker's handoff note after a run. A headless worker has no person watching it.
- Do not edit or delete a record to hide a run. If a run was a mistake, say so in the decision log.
- The `.locks` folder holds one small file per worker folder while a run is active. It is safe to delete a lock only when no run is active.
- Logs can still hold sensitive project text. Keep this folder private; do not publish it.
