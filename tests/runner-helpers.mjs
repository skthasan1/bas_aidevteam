// Shared setup for the run-role and panel tests (not a test file): a temp hub, a worker folder and a fake agent.
import fs from "node:fs";
import path from "node:path";
import { validateConfig } from "../tools/lib/config.mjs";
import { baseRaw, tmpDir } from "./helpers.mjs";

// A token-like string built at run time so no literal token sits in this file.
export const FAKE_TOKEN = "gh" + "p_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4";

// The fake agent. Mode comes from the first argument; the prompt is the last argument (arg mode) or standard input (stdin mode).
//   echo   prints the start of the prompt, the last argument, a token (split across two writes) and a key block, then exits 0
//   sleep  waits 60 seconds (a test kills it)
//   stdin  prints what it read from standard input
//   fail   prints a line and exits 3
const AGENT = [
  'const mode = process.argv[2];',
  'const tok = "gh" + "p_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4";',
  'const sleep = (ms) => new Promise((r) => setTimeout(r, ms));',
  'if (mode === "sleep") { console.log("sleeping"); setTimeout(() => {}, 60000); }',
  'else if (mode === "fail") { console.log("failing"); process.exit(3); }',
  'else if (mode === "stdin") { let d = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (c) => (d += c)); process.stdin.on("end", () => { console.log("STDIN:" + d.split("\\n")[0]); console.log("STDINLEN:" + d.length); }); }',
  'else { (async () => {',
  '  const last = process.argv[process.argv.length - 1];',
  '  console.log("ARGS_OK cwd=" + process.cwd().split(/[\\\\/]/).pop());',
  '  console.log("FIRSTLINE:" + last.split("\\n")[0]);',
  '  console.log("TASKLINE:" + last.split("\\n").slice(-1)[0]);',
  '  process.stdout.write("part " + tok.slice(0, 10));',
  '  await sleep(80);',
  '  process.stdout.write(tok.slice(10) + " end\\n");',
  '  console.log("-----" + "BEGIN RSA PRIVATE KEY-----");',
  '  console.log("MIIEowIBAAKCAQEA-secret-body");',
  '  console.log("-----" + "END RSA PRIVATE KEY-----");',
  '  console.log("after key");',
  '})(); }',
].join("\n");

export function rawWith({ agentPath, mode = "echo", promptVia = "arg", timeoutMinutes, headless = {}, extraWorkers = null } = {}) {
  const raw = baseRaw();
  raw.mode = "solo";
  raw.ai_accounts = ["acme-bot", "acme-dev-bot", "acme-tl", "acme-dev-bot-2"];
  raw.roles = {
    "tech-lead": { account: "acme-tl", headless: headless["tech-lead"] ?? "read-only" },
    "ai-developer": { account: "acme-dev-bot", headless: headless["ai-developer"] ?? "write-branch" },
    "qa-lead": { account: "acme-bot" },
    researcher: { headless: headless.researcher ?? false },
  };
  raw.runner = { command: process.execPath, args: [agentPath, mode], prompt_via: promptVia };
  if (timeoutMinutes !== undefined) raw.runner.timeout_minutes = timeoutMinutes;
  if (extraWorkers) raw.people = extraWorkers;
  return raw;
}

// Creates { root, hub, folder, agentPath, configFile, config } for one test.
export function makeEnv(opts = {}) {
  const root = tmpDir();
  const hub = path.join(root, "hub");
  const folder = path.join(root, "worker");
  fs.mkdirSync(path.join(hub, "briefs"), { recursive: true });
  fs.mkdirSync(folder);
  const agentPath = path.join(root, "agent.mjs");
  fs.writeFileSync(agentPath, AGENT);
  fs.writeFileSync(path.join(hub, "briefs", "ai-developer-startup.md"), "BRIEF-DEV: you build small tested pull requests.\n");
  fs.writeFileSync(path.join(hub, "briefs", "tech-lead-startup.md"), "BRIEF-LEAD: you review.\n");
  const raw = rawWith({ agentPath, ...opts });
  raw.roles["ai-developer"].folder = folder; // the panel takes the folder from the config only
  const { errors, config } = validateConfig(JSON.parse(JSON.stringify(raw)));
  if (errors.length) throw new Error(errors.join("; "));
  const configFile = path.join(root, "qa-projects.json");
  fs.writeFileSync(configFile, JSON.stringify(raw, null, 1));
  return { root, hub, folder, agentPath, configFile, config, raw };
}

export async function waitFor(fn, ms = 10000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, 40));
  }
}
