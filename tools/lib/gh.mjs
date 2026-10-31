// A thin wrapper around the gh CLI. Arguments are always an array and go to execFile, never to a shell.
// In dry-run mode it only prints what it would run and returns null.
import { execFileSync } from "node:child_process";

export function defaultRunner(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    input: opts.input,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

const quote = (a) => (/^[\w@%+=:,./#-]+$/.test(a) ? a : JSON.stringify(a));

export class GhError extends Error {
  constructor(args, cause) {
    const detail = String(cause?.stderr || cause?.message || cause).trim().slice(0, 300);
    super(`gh ${args.slice(0, 3).join(" ")} failed: ${detail}`);
    this.name = "GhError";
  }
}

export function createGh({ dryRun = false, runner = defaultRunner, log = console.log } = {}) {
  function run(args, { input } = {}) {
    if (!Array.isArray(args) || !args.every((a) => typeof a === "string")) {
      throw new TypeError("gh arguments must be an array of strings");
    }
    if (dryRun) {
      log(`[dry-run] gh ${args.map(quote).join(" ")}`);
      return null;
    }
    try {
      return runner("gh", args, { input });
    } catch (e) {
      throw new GhError(args, e);
    }
  }
  function json(args, opts) {
    const out = run(args, opts);
    if (out === null || out === undefined || out.trim() === "") return null;
    return JSON.parse(out);
  }
  return { run, json, dryRun };
}
