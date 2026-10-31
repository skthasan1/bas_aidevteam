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

// Read-only by default: only these subcommands may run, and "api" only as a GET. Anything else needs { write: true } on that call,
// which the watches never pass.
const READ_ONLY = new Set(["pr list", "pr view", "pr diff", "pr checks", "issue list", "issue view"]);
const FIELD_FLAG = /^(?:-[fF]|--(?:field|raw-field|input))(?:$|=)|^-[fF]./;

export function assertReadOnly(args) {
  if (args[0] === "api") {
    for (let i = 1; i < args.length; i++) {
      const a = args[i];
      let method;
      if (a === "-X" || a === "--method") method = args[i + 1];
      else if (a.startsWith("--method=")) method = a.slice(9);
      else if (/^-X./.test(a)) method = a.slice(2);
      if (method !== undefined && String(method).toUpperCase() !== "GET") throw new GhError(args, new Error(`read-only gh wrapper: api method ${method} needs { write: true }`));
      if (FIELD_FLAG.test(a)) throw new GhError(args, new Error("read-only gh wrapper: api field flags would turn the request into a POST; they need { write: true }"));
    }
    return;
  }
  if (!READ_ONLY.has(`${args[0]} ${args[1]}`)) throw new GhError(args, new Error(`read-only gh wrapper: "${args[0]} ${args[1] ?? ""}" is not allowed without { write: true }`));
}

export function createGh({ dryRun = false, runner = defaultRunner, log = console.log } = {}) {
  function run(args, { input, write = false } = {}) {
    if (!Array.isArray(args) || !args.every((a) => typeof a === "string")) {
      throw new TypeError("gh arguments must be an array of strings");
    }
    if (write !== true) assertReadOnly(args);
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
