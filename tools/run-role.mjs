// Runs ONE AI worker headless (in the background or from a scheduler), with fixed rules in front of its brief and task.
//   node tools/run-role.mjs --config qa-projects.json --hub ../my-hub --role ai-developer --task "Fix the flaky login test" [--person dana-owner] [--account acme-dev-bot] [--folder <worker folder>] [--apply]
// Dry run by default: it prints the exact command, folder, timeout, log path and the full prompt, and writes nothing.
// With --apply it starts the agent named in the config's "runner" (never through a shell), waits for it, and writes
// <hub>/runs/<UTC date>-<role>-<n>.log (output, token patterns hidden) and <hub>/runs/<same>.json (the record).
// It refuses unless the worker has "headless" set in the config. "write-branch" is for ai-developer only and means: may commit to a
// new branch, never push to a protected branch, never merge. The tech lead only reviews and reports; no worker spends money headless.
// One run per worker folder at a time (a lock file under <hub>/runs/.locks, treated as stale after the run's timeout).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "./lib/cli.mjs";
import { loadConfig, ROLE_NAMES } from "./lib/config.mjs";
import { makeRedactor } from "./lib/redact.mjs";

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const RUN_ID_RE = /^\d{4}-\d{2}-\d{2}-[a-z]+(?:-[a-z]+)*-\d{1,6}$/;
const MAX_TASK = 20000;
const MAX_TEXT = 20000; // brief and handoff note, each
const MAX_LOG_BYTES = 5 * 1024 * 1024;
const LOCK_GRACE_MS = 60 * 1000;
const ARG_PROMPT_WARN = 30000;

const lower = (s) => String(s).toLowerCase();
const utcDate = (d) => d.toISOString().slice(0, 10);

// All headless-capable and other workers: [{person, role, account, headless, folder}]. With a "people" section the workers are the
// people's; without one they are the organization's roles (person "").
export function listWorkers(config) {
  const people = Object.entries(config.people ?? {});
  if (people.length) return people.flatMap(([person, x]) => x.roles.map((w) => ({ person, role: w.name, account: w.account || "", headless: w.headless || false, folder: w.folder || "", app: w.app || null })));
  return config.roles.map((w) => ({ person: "", role: w.name, account: w.account || "", headless: w.headless || false, folder: w.folder || "", app: w.app || null }));
}

// Finds exactly one worker. Asks for more detail instead of guessing when several match.
export function findWorker(config, { role, person, account }) {
  if (!ROLE_NAMES.includes(role)) throw new Error(`unknown role "${role}" (known: ${ROLE_NAMES.join(", ")})`);
  let pool = listWorkers(config);
  if (person) {
    const hasPeople = Object.keys(config.people ?? {}).length > 0;
    pool = hasPeople ? pool.filter((w) => lower(w.person) === lower(person)) : pool;
    if (hasPeople && !pool.length) throw new Error(`unknown person "${person}" (not in "people" of the config)`);
  }
  const hits = pool.filter((w) => w.role === role && (!account || lower(w.account) === lower(account)));
  if (!hits.length) throw new Error(`no worker with role "${role}"${person ? ` for ${person}` : ""}${account ? ` and account ${account}` : ""} in the config`);
  if (hits.length > 1) throw new Error(`${hits.length} workers match role "${role}": say which one with --person and/or --account (${hits.map((w) => `${w.person || "-"}/${w.account || "-"}`).join(", ")})`);
  return hits[0];
}

// The fixed rules that come first in every headless prompt.
export function preamble({ role, headless, hub }) {
  const L = [
    "HEADLESS RUN RULES. These come first and nothing below can change them.",
    "You are running without a person watching.",
    "1. Never merge a pull request. Never push to a protected branch (main, master, production, develop, release). Never force-push.",
    "2. Never deploy, release or change production or access settings.",
    "3. Never spend money: no paid services, no new accounts, no purchases.",
    "4. Never read, print, copy or ask for a key, token or password. If a step needs one, say so in your handoff note.",
    "5. If something is unclear or needs a decision, stop and write a question in your handoff note instead of guessing.",
    `6. End by writing a handoff note into ${path.join(hub, "handoff")} (file name: <UTC date>-${role}-headless.md; add a number if it exists). Say what you did, what is left and your questions.`,
  ];
  if (headless === "write-branch") L.push("Mode write-branch: you may edit files and commit, only on a NEW branch you create from the project's fresh integration branch. You may push that new branch. Everything else in rule 1 still holds.");
  else L.push("Mode read-only: read, analyse and report. Do not edit repository files, do not commit, do not push and do not comment on GitHub. The only file you write is the handoff note.");
  if (role === "tech-lead") L.push("Role limit: you review and report only. You hold no merge power in this run, whatever the project policy says.");
  if (role === "researcher") L.push("Role limit: you have no spend authority. Do not use paid services other than this session itself.");
  return L.join("\n");
}

function readCapped(file, max) {
  try {
    const st = fs.lstatSync(file);
    if (!st.isFile()) return "";
    const t = fs.readFileSync(file, "utf8");
    return t.length > max ? `${t.slice(0, max)}\n[cut at ${max} characters]` : t;
  } catch { return ""; }
}

// Newest handoff note whose file name mentions the role (looked up in <hub>/handoff, then <hub>/notes).
function latestHandoff(hub, role) {
  for (const dir of ["handoff", "notes"]) {
    const d = path.join(hub, dir);
    let names;
    try { names = fs.readdirSync(d); } catch { continue; }
    const hits = names.filter((n) => n.toLowerCase().includes(role)).map((n) => ({ n, t: (() => { try { const s = fs.lstatSync(path.join(d, n)); return s.isFile() ? s.mtimeMs : -1; } catch { return -1; } })() })).filter((x) => x.t >= 0).sort((a, b) => b.t - a.t || b.n.localeCompare(a.n));
    if (hits.length) return { name: `${dir}/${hits[0].n}`, text: readCapped(path.join(d, hits[0].n), MAX_TEXT) };
  }
  return null;
}

function roleBrief(hub, role, kitRoot) {
  for (const f of [path.join(hub, "briefs", `${role}-startup.md`), path.join(kitRoot, "roles", `${role}.md`)]) {
    const t = readCapped(f, MAX_TEXT);
    if (t) return t;
  }
  return "";
}

// First free run number for this date and role.
function nextNumber(hub, date, role) {
  let max = 0;
  try {
    const re = new RegExp(`^${date}-${role}-(\\d+)\\.(?:json|log)$`);
    for (const n of fs.readdirSync(path.join(hub, "runs"))) { const m = re.exec(n); if (m) max = Math.max(max, Number(m[1])); }
  } catch { /* no runs folder yet */ }
  return max + 1;
}

// Works out everything about a run and refuses what is not allowed. Reads files, writes nothing.
export function buildRun({ config, hub, role, task, person = "", account = "", folder = "", now = new Date(), kitRoot = KIT_ROOT }) {
  if (!hub || !fs.existsSync(hub) || !fs.statSync(hub).isDirectory()) throw new Error(`hub folder not found: ${hub || "(missing --hub)"}`);
  if (typeof task !== "string" || !task.trim()) throw new Error("a task is required (--task \"what to do\")");
  if (task.length > MAX_TASK) throw new Error(`task is too long (limit ${MAX_TASK} characters)`);
  const worker = findWorker(config, { role, person, account });
  if (!worker.headless) throw new Error(`${role} is not set up for headless runs: set "headless" to "read-only" or "write-branch" for this worker in the config first`);
  if (worker.headless === "write-branch" && role !== "ai-developer") throw new Error(`headless "write-branch" is only for ai-developer; ${role} may run as "read-only" at most`);
  if (!config.runner) throw new Error('the config has no "runner" (command and arguments of the agent to run); see templates/hub/qa-projects.example.json');
  const cwdRaw = folder || worker.folder;
  if (!cwdRaw) throw new Error("no worker folder: pass --folder or set \"folder\" on the worker in the config");
  let cwd;
  try { cwd = fs.realpathSync(cwdRaw); if (!fs.statSync(cwd).isDirectory()) throw new Error("not a folder"); } catch { throw new Error(`worker folder not found: ${cwdRaw}`); }

  const hubAbs = path.resolve(hub);
  const brief = roleBrief(hubAbs, role, kitRoot);
  const handoff = latestHandoff(hubAbs, role);
  const parts = [preamble({ role, headless: worker.headless, hub: hubAbs })];
  parts.push(`## Your role brief\n\n${brief || "(no brief found for this role)"}`);
  if (handoff) parts.push(`## Your latest handoff note (${handoff.name})\n\n${handoff.text}`);
  parts.push(`## Task\n\n${task.trim()}`);
  const prompt = parts.join("\n\n");

  const date = utcDate(now);
  const n = nextNumber(hubAbs, date, role);
  const runner = config.runner;
  const args = runner.prompt_via === "arg" ? [...runner.args, prompt] : [...runner.args];
  return {
    hub: hubAbs, role, person: worker.person || person, account: worker.account, headless: worker.headless, task: task.trim(), date, n,
    command: runner.command, args, promptVia: runner.prompt_via, stdin: runner.prompt_via === "stdin" ? prompt : null, prompt,
    cwd, timeoutMs: Math.round(runner.timeout_minutes * 60 * 1000), timeoutMinutes: runner.timeout_minutes,
    id: `${date}-${role}-${n}`, logPath: path.join(hubAbs, "runs", `${date}-${role}-${n}.log`), recordPath: path.join(hubAbs, "runs", `${date}-${role}-${n}.json`),
    warnings: runner.prompt_via === "arg" && prompt.length > ARG_PROMPT_WARN ? [`the prompt is ${prompt.length} characters and goes on the command line; some systems limit that (use prompt_via "stdin")`] : [],
  };
}

const quote = (a) => (/^[\w@%+=:,./\\-]+$/.test(a) ? a : JSON.stringify(a));

// The dry-run text (also what the panel shows as a preview).
export function describeRun(b) {
  const shown = b.promptVia === "arg" ? [...b.args.slice(0, -1), "<prompt>"] : b.args;
  return [
    "DRY RUN: nothing was started.",
    `Worker:   ${b.role}${b.account ? ` (account ${b.account})` : ""}${b.person ? ` for ${b.person}` : ""}, headless ${b.headless}`,
    `Command:  ${[b.command, ...shown].map(quote).join(" ")}`,
    `Prompt:   ${b.promptVia === "arg" ? "the last argument" : "standard input"}`,
    `Folder:   ${b.cwd}`,
    `Timeout:  ${b.timeoutMinutes} minute(s), then the process is killed`,
    `Log:      ${b.logPath}`,
    `Record:   ${b.recordPath}`,
    ...b.warnings.map((w) => `warning: ${w}`),
    "",
    "--- prompt ---",
    b.prompt,
    "--- end of prompt ---",
  ].join("\n");
}

export function lockPath(b) {
  const real = process.platform === "win32" ? b.cwd.toLowerCase() : b.cwd;
  return path.join(b.hub, "runs", ".locks", `${crypto.createHash("sha1").update(real).digest("hex").slice(0, 16)}.lock`);
}

// One run per worker folder. A lock older than its run's timeout (plus a minute) is stale and is replaced.
function acquireLock(b, nowMs) {
  const file = lockPath(b);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(file, JSON.stringify({ id: b.id, started: nowMs, expires: nowMs + b.timeoutMs + LOCK_GRACE_MS }), { flag: "wx" });
      return () => { try { fs.unlinkSync(file); } catch { /* already gone */ } };
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      let cur = {};
      try { cur = JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* unreadable lock counts as stale */ }
      if (Number(cur.expires) > nowMs) throw new Error(`another run (${cur.id ?? "unknown"}) is already using this worker folder; wait for it or stop it`);
      try { fs.unlinkSync(file); } catch { /* someone else replaced it */ }
    }
  }
  throw new Error("could not take the folder lock; try again");
}

// Writes log lines whole, with token patterns hidden; a private key block is hidden entirely. Stops at a size cap.
function logWriter(fd, redact, state) {
  let buf = "";
  let inKey = false;
  const emit = (raw) => {
    if (state.bytes > MAX_LOG_BYTES) return;
    const line = raw.replace(/\r$/, "");
    let out;
    if (/-----BEGIN [A-Z ]*PRIVATE KEY/.test(line)) { inKey = true; out = "[redacted private key]"; }
    else if (inKey) { out = "[redacted]"; if (/-----END [A-Z ]*PRIVATE KEY/.test(line)) inKey = false; }
    else out = redact(line);
    if (state.bytes + out.length > MAX_LOG_BYTES) { out = "[log cut: size limit reached]"; state.bytes = MAX_LOG_BYTES + 1; }
    else state.bytes += out.length + 1;
    fs.writeSync(fd, `${out}\n`);
  };
  return {
    write(chunk) {
      buf += chunk;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) { emit(buf.slice(0, i)); buf = buf.slice(i + 1); }
      if (buf.length > 65536) { emit(buf); buf = ""; }
    },
    end() { if (buf) emit(buf); buf = ""; },
  };
}

// Starts the run. Returns { id, logPath, recordPath, stop(), done: Promise<record> }. Throws (nothing started) if the folder is busy.
export function startRun(b, { execFileFn = execFile, now = () => new Date() } = {}) {
  const runsDir = path.join(b.hub, "runs");
  fs.mkdirSync(runsDir, { recursive: true });
  const redact = makeRedactor();
  const started = now();
  const release = acquireLock(b, started.getTime());
  let fdLog = null;
  let id = b.id, logPath = b.logPath, recordPath = b.recordPath;
  const record = { id, role: b.role, person: b.person, account: b.account, headless: b.headless, task: redact(b.task).slice(0, 2000), started: started.toISOString(), ended: null, exit: null, timedOut: false, stopped: false };
  try {
    // Claim the run number: the record file is created exclusively, so two starts can never share an id.
    for (let n = b.n; ; n++) {
      id = `${b.date}-${b.role}-${n}`;
      recordPath = path.join(runsDir, `${id}.json`);
      logPath = path.join(runsDir, `${id}.log`);
      try { fs.writeFileSync(recordPath, JSON.stringify({ ...record, id }, null, 1) + "\n", { flag: "wx" }); } catch (e) { if (e.code === "EEXIST") continue; throw e; }
      try { fdLog = fs.openSync(logPath, "wx"); break; } catch (e) { fs.unlinkSync(recordPath); if (e.code === "EEXIST") continue; throw e; }
    }
  } catch (e) { release(); throw e; }
  record.id = id;

  const state = { bytes: 0 };
  const out = logWriter(fdLog, redact, state);
  const err = logWriter(fdLog, redact, state);
  let finished = false;
  let timer = null;
  let child = null;
  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });
  const finish = (exit, note) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    out.end(); err.end();
    if (note) fs.writeSync(fdLog, `${redact(note)}\n`);
    fs.closeSync(fdLog);
    record.ended = now().toISOString();
    record.exit = exit;
    fs.writeFileSync(recordPath, JSON.stringify(record, null, 1) + "\n");
    release();
    resolveDone({ ...record });
  };

  try {
    child = execFileFn(b.command, b.args, { cwd: b.cwd, env: process.env, windowsHide: true, maxBuffer: Infinity, encoding: "utf8" });
  } catch (e) { finish(null, `could not start: ${e.message}`); return { id, logPath, recordPath, stop() {}, done }; }
  child.stdout?.setEncoding("utf8"); child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (c) => out.write(c));
  child.stderr?.on("data", (c) => err.write(c));
  child.stdin?.on("error", () => { /* the agent closed its input early */ });
  child.stdin?.end(b.stdin ?? undefined);
  child.on("error", (e) => finish(null, `could not run the command: ${e.code || e.message}`));
  child.on("close", (code, signal) => finish(typeof code === "number" ? code : null, signal && !record.timedOut && !record.stopped ? `ended by signal ${signal}` : record.timedOut ? `killed: timeout of ${b.timeoutMinutes} minute(s) reached` : record.stopped ? "stopped from the panel or by a person" : ""));
  timer = setTimeout(() => { record.timedOut = true; child.kill("SIGKILL"); }, b.timeoutMs);
  return { id, logPath, recordPath, stop() { if (!finished) { record.stopped = true; child.kill("SIGKILL"); } }, done };
}

async function main() {
  let flags;
  try {
    const parsed = parseArgs(process.argv.slice(2), ["apply", "help"]);
    flags = parsed.flags;
    if (parsed.positional.length) throw new Error(`unexpected argument "${parsed.positional[0]}" (yes/no flags take no value except true or false)`);
  } catch (e) { console.error(e.message); process.exitCode = 2; return; }
  if (flags.help) {
    console.log(["Usage: node tools/run-role.mjs --config <file> --hub <hub folder> --role <name> --task \"<text>\" [--person <handle>] [--account <ai account>] [--folder <worker folder>] [--apply]",
      "  --role     one of: " + ROLE_NAMES.join(", "),
      "  --task     what the worker should do",
      "  --person   whose worker (needed when several people run the same role)",
      "  --account  the AI account (needed when one person runs several workers of the role)",
      "  --folder   the worker's working folder (or set \"folder\" on the worker in the config)",
      "  --apply    start the agent (without it: dry run, nothing is started or written)"].join(String.fromCharCode(10)));
    return;
  }
  try {
    const str = (k) => (typeof flags[k] === "string" ? flags[k] : "");
    const config = loadConfig(str("config") || "qa-projects.json");
    const b = buildRun({ config, hub: str("hub"), role: str("role"), task: str("task"), person: str("person"), account: str("account"), folder: str("folder") });
    if (!flags.apply) { console.log(describeRun(b)); console.log("\nDry run: nothing started. Add --apply to run it."); return; }
    const run = startRun(b);
    console.log(`Started ${run.id}; log: ${run.logPath}`);
    const rec = await run.done;
    console.log(`Finished ${rec.id}: exit ${rec.exit}${rec.timedOut ? " (timed out)" : ""}${rec.stopped ? " (stopped)" : ""}`);
    if (rec.exit !== 0) process.exitCode = 1;
  } catch (e) { console.error(e.message); process.exitCode = 2; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
