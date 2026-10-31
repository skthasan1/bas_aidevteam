// Shared test helpers (not a test file).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateConfig } from "../tools/lib/config.mjs";

export const baseRaw = () => ({
  organization: "acme",
  owner: { name: "Dana", handles: ["dana-owner"] },
  ai_accounts: ["acme-bot"],
  projects: {
    notes: { name: "Acme Notes", default: "acme/notes-web", repos: { web: "acme/notes-web", api: "acme/notes-api" }, owners: ["dana-owner"], testing: "active", watch: "review" },
    tasks: { name: "Acme Tasks", repos: { tasks: "acme/tasks" }, owners: ["dana-owner"], testing: "later", watch: "off" },
  },
});

export const makeConfig = (patch = (x) => x) => {
  const { errors, config } = validateConfig(patch(baseRaw()));
  if (errors.length) throw new Error(errors.join("; "));
  return config;
};

export const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "bas-test-"));

// A fake runner: handler(args, input) returns a string (or throws). All calls are recorded.
export function fakeRunner(handler) {
  const calls = [];
  const runner = (cmd, args, opts = {}) => {
    calls.push({ cmd, args, input: opts.input });
    return handler(args, opts.input);
  };
  runner.calls = calls;
  return runner;
}
