import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildRun, startRun, describeRun, preamble, findWorker, lockPath, RUN_ID_RE } from "../tools/run-role.mjs";
import { validateConfig } from "../tools/lib/config.mjs";
import { checkPolicy } from "../tools/lib/policy.mjs";
import { makeRedactor } from "../tools/lib/redact.mjs";
import { baseRaw } from "./helpers.mjs";
import { makeEnv, rawWith, FAKE_TOKEN } from "./runner-helpers.mjs";

const TOOL = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tools", "run-role.mjs");
const build = (env, over = {}) => buildRun({ config: env.config, hub: env.hub, role: "ai-developer", task: "Fix the flaky test", folder: env.folder, ...over });
const read = (f) => fs.readFileSync(f, "utf8");

test("config: headless and runner are validated", () => {
  const bad = (patch, re) => {
    const raw = rawWith({ agentPath: "x.mjs" });
    patch(raw);
    const { errors, config } = validateConfig(raw);
    assert.equal(config, null);
    assert.match(errors.join("\n"), re);
  };
  bad((r) => { r.roles["tech-lead"].headless = "yes"; }, /headless must be/);
  bad((r) => { r.runner.prompt_via = "env"; }, /prompt_via/);
  bad((r) => { r.runner.timeout_minutes = 241; }, /timeout_minutes/);
  bad((r) => { r.runner.timeout_minutes = 0; }, /timeout_minutes/);
  bad((r) => { r.runner.args = "x"; }, /runner.args/);
  bad((r) => { r.runner.command = ""; }, /runner.command/);
  bad((r) => { r.runner = "node"; }, /runner must be/);
  const ok = validateConfig(rawWith({ agentPath: "x.mjs" }));
  assert.equal(ok.config.runner.timeout_minutes, 30);
  assert.equal(ok.config.runner.prompt_via, "arg");
  assert.equal(ok.config.roles.find((r) => r.name === "qa-lead").headless, false);
});

test("doctor: write-branch outside ai-developer and a missing runner are errors", () => {
  const raw = rawWith({ agentPath: "x.mjs", headless: { "tech-lead": "write-branch" } });
  const { config } = validateConfig(raw);
  assert.match(checkPolicy(config).errors.join("\n"), /write-branch" is only for ai-developer/);
  const noRunner = rawWith({ agentPath: "x.mjs" });
  delete noRunner.runner;
  assert.match(checkPolicy(validateConfig(noRunner).config).errors.join("\n"), /no "runner"/);
  const fine = rawWith({ agentPath: "x.mjs" });
  const errs = checkPolicy(validateConfig(fine).config).errors.filter((e) => /headless|runner/.test(e));
  assert.deepEqual(errs, []);
  // a person's worker is checked too
  const ppl = baseRaw();
  ppl.ai_accounts = ["acme-bot"];
  ppl.runner = { command: "node" };
  ppl.people = { "dana-owner": { roles: [{ name: "qa-lead", account: "acme-bot", headless: "write-branch" }] } };
  assert.match(checkPolicy(validateConfig(ppl).config).errors.join("\n"), /people.dana-owner.qa-lead.*write-branch/);
});

test("refuses a worker whose headless is not set", () => {
  const env = makeEnv();
  assert.throws(() => build(env, { role: "qa-lead" }), /not set up for headless runs/);
  assert.throws(() => build(env, { role: "researcher" }), /not set up for headless runs/);
});

test("refuses without a runner, a task, a folder or a hub", () => {
  const env = makeEnv();
  const noRunner = { ...env.config, runner: undefined };
  assert.throws(() => build(env, { config: noRunner }), /no "runner"/);
  assert.throws(() => build(env, { task: "  " }), /task is required/);
  assert.throws(() => build(env, { folder: path.join(env.root, "missing") }), /worker folder not found/);
  assert.throws(() => build(env, { role: "tech-lead", folder: "" }), /no worker folder/);
  assert.throws(() => build(env, { hub: path.join(env.root, "nohub") }), /hub folder not found/);
  assert.throws(() => build(env, { role: "wizard" }), /unknown role/);
});

test("write-branch is only for ai-developer, even when the config slipped through", () => {
  const env = makeEnv({ headless: { "tech-lead": "write-branch" } });
  assert.throws(() => build(env, { role: "tech-lead" }), /only for ai-developer/);
});

test("the tech lead runs read-only with no merge power; the researcher has no spend", () => {
  const env = makeEnv({ headless: { researcher: "read-only" } });
  const lead = build(env, { role: "tech-lead" });
  assert.match(lead.prompt, /Mode read-only/);
  assert.match(lead.prompt, /review and report only\. You hold no merge power/);
  assert.doesNotMatch(lead.prompt, /Mode write-branch/);
  const res = build(env, { role: "researcher" });
  assert.match(res.prompt, /no spend authority/);
});

test("ai-developer write-branch prompt: preamble first, then brief, handoff and task", () => {
  const env = makeEnv();
  fs.mkdirSync(path.join(env.hub, "handoff"));
  fs.writeFileSync(path.join(env.hub, "handoff", "2026-01-01-ai-developer.md"), "OLD NOTE\n");
  fs.writeFileSync(path.join(env.hub, "handoff", "2026-01-02-ai-developer.md"), "NEW NOTE left off at step 4\n");
  fs.writeFileSync(path.join(env.hub, "handoff", "2026-01-03-qa-lead.md"), "OTHER ROLE NOTE\n");
  const b = build(env);
  const p = b.prompt;
  assert.ok(p.startsWith("HEADLESS RUN RULES"));
  for (const re of [/Never merge/, /protected branch/, /Never spend money/, /Never read, print, copy or ask for a key/, /handoff note/, /instead of guessing/, /Mode write-branch/, /NEW branch/]) assert.match(p, re);
  assert.ok(p.indexOf("BRIEF-DEV") > p.indexOf("Mode write-branch"));
  assert.ok(p.indexOf("NEW NOTE") > p.indexOf("BRIEF-DEV"));
  assert.ok(p.indexOf("Fix the flaky test") > p.indexOf("NEW NOTE"));
  assert.doesNotMatch(p, /OLD NOTE|OTHER ROLE NOTE/);
  assert.equal(b.headless, "write-branch");
  assert.match(preamble({ role: "qa-lead", headless: "read-only", hub: "/h" }), /Mode read-only/);
});

test("falls back to the kit's role file when the hub has no brief", () => {
  const env = makeEnv();
  const b = build(env, { role: "researcher", config: { ...env.config, roles: env.config.roles.map((r) => (r.name === "researcher" ? { ...r, headless: "read-only" } : r)) } });
  assert.match(b.prompt, /## Your role brief\n\n# Role: AI researcher/);
});

test("ambiguous workers are not guessed", () => {
  const env = makeEnv({ extraWorkers: { "dana-owner": { roles: [{ name: "ai-developer", account: "acme-dev-bot", headless: "write-branch" }, { name: "ai-developer", account: "acme-dev-bot-2", headless: "read-only" }] } } });
  assert.throws(() => build(env, { person: "dana-owner" }), /2 workers match/);
  assert.equal(build(env, { person: "dana-owner", account: "acme-dev-bot-2" }).headless, "read-only");
  assert.throws(() => build(env, { person: "nobody" }), /unknown person/);
  assert.throws(() => findWorker(env.config, { role: "qa-lead", person: "dana-owner" }), /no worker/);
});

test("dry run describes the run and writes nothing", () => {
  const env = makeEnv();
  const text = describeRun(build(env));
  for (const re of [/DRY RUN/, /Command:/, /Folder:/, /Timeout:  30 minute/, /Log:/, /--- prompt ---/, /Fix the flaky test/, /<prompt>/]) assert.match(text, re);
  assert.equal(fs.existsSync(path.join(env.hub, "runs")), false);
  // through the command line too
  const r = spawnSync(process.execPath, [TOOL, "--config", env.configFile, "--hub", env.hub, "--role", "ai-developer", "--task", "Do a thing", "--folder", env.folder], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Dry run: nothing started/);
  assert.match(r.stdout, /Do a thing/);
  assert.equal(fs.existsSync(path.join(env.hub, "runs")), false);
});

test("command line: yes/no flags are strict and a refusal exits 2", () => {
  const env = makeEnv();
  const run = (extra) => spawnSync(process.execPath, [TOOL, "--config", env.configFile, "--hub", env.hub, "--task", "x", "--folder", env.folder, ...extra], { encoding: "utf8" });
  const typo = run(["--role", "ai-developer", "--apply=yes"]);
  assert.equal(typo.status, 2);
  assert.match(typo.stderr, /yes\/no flag/);
  assert.equal(fs.existsSync(path.join(env.hub, "runs")), false);
  const refused = run(["--role", "qa-lead", "--apply"]);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /not set up for headless/);
  assert.equal(fs.existsSync(path.join(env.hub, "runs")), false);
});

test("a real run: arg prompt, no shell, folder, log, record, redaction", async () => {
  const env = makeEnv();
  const task = "Fix $(echo pwned) && echo hi; `ls` \"quoted\"";
  const run = startRun(build(env, { task }));
  const rec = await run.done;
  assert.match(run.id, RUN_ID_RE);
  const log = read(run.logPath);
  assert.match(log, /ARGS_OK cwd=worker/); // cwd is the worker folder
  assert.match(log, /FIRSTLINE:HEADLESS RUN RULES/);
  assert.ok(log.includes(`TASKLINE:${task}`), "the task reaches the agent unchanged (no shell expansion)");
  assert.equal(log.includes(FAKE_TOKEN), false);
  assert.equal(log.includes(FAKE_TOKEN.slice(0, 10)), false, "a token split across two writes is still hidden");
  assert.match(log, /\[redacted\]/);
  assert.equal(log.includes("secret-body"), false, "a private key block is hidden");
  assert.match(log, /after key/);
  const saved = JSON.parse(read(run.recordPath));
  assert.deepEqual(Object.keys(saved).filter((k) => ["role", "person", "account", "task", "started", "ended", "exit", "timedOut"].includes(k)).sort(), ["account", "ended", "exit", "person", "role", "started", "task", "timedOut"]);
  assert.equal(saved.exit, 0);
  assert.equal(saved.timedOut, false);
  assert.equal(saved.role, "ai-developer");
  assert.equal(saved.account, "acme-dev-bot");
  assert.ok(saved.ended);
  assert.equal(rec.exit, 0);
  assert.equal(path.basename(run.logPath), `${run.id}.log`);
  assert.equal(fs.readdirSync(path.join(env.hub, "runs", ".locks")).length, 0, "the lock is released");
});

test("prompt_via stdin sends the prompt on standard input", async () => {
  const env = makeEnv({ mode: "stdin", promptVia: "stdin" });
  const b = build(env);
  assert.equal(b.args.length, 2);
  const rec = await startRun(b).done;
  assert.equal(rec.exit, 0);
  const log = read(b.logPath.replace(/-1\.log$/, "-1.log"));
  assert.match(log, /STDIN:HEADLESS RUN RULES/);
  assert.match(describeRun(b), /standard input/);
});

test("a failing agent is recorded with its exit code", async () => {
  const env = makeEnv({ mode: "fail" });
  const rec = await startRun(build(env)).done;
  assert.equal(rec.exit, 3);
  assert.equal(rec.timedOut, false);
});

test("run numbers go up and never reuse an id", async () => {
  const env = makeEnv();
  const a = startRun(build(env));
  await a.done;
  const b = startRun(build(env));
  await b.done;
  assert.match(a.id, /-ai-developer-1$/);
  assert.match(b.id, /-ai-developer-2$/);
  // two builds made before either starts still get different ids
  const b1 = build(env), b2 = build(env);
  const r1 = startRun(b1);
  await r1.done;
  const r2 = startRun(b2);
  await r2.done;
  assert.notEqual(r1.id, r2.id);
});

test("timeout kills the agent", async () => {
  const env = makeEnv({ mode: "sleep", timeoutMinutes: 0.03 });
  const t0 = Date.now();
  const run = startRun(build(env));
  const rec = await run.done;
  assert.ok(Date.now() - t0 < 15000);
  assert.equal(rec.timedOut, true);
  assert.notEqual(rec.exit, 0);
  assert.match(read(run.logPath), /killed: timeout/);
  assert.equal(JSON.parse(read(run.recordPath)).timedOut, true);
});

test("only one run per worker folder at a time", async () => {
  const env = makeEnv({ mode: "sleep" });
  const first = startRun(build(env));
  assert.throws(() => startRun(build(env)), /already using this worker folder/);
  first.stop();
  const rec = await first.done;
  assert.equal(rec.stopped, true);
  // after it ends the folder is free again
  const again = startRun(build(env));
  again.stop();
  await again.done;
});

test("a stale lock (older than its run's timeout) is replaced; a fresh one blocks", async () => {
  const env = makeEnv();
  const b = build(env);
  fs.mkdirSync(path.dirname(lockPath(b)), { recursive: true });
  fs.writeFileSync(lockPath(b), JSON.stringify({ id: "other-run", started: Date.now(), expires: Date.now() + 60000 }));
  assert.throws(() => startRun(b), /other-run/);
  fs.writeFileSync(lockPath(b), JSON.stringify({ id: "old-run", started: 1, expires: 2 }));
  const rec = await startRun(b).done;
  assert.equal(rec.exit, 0);
  fs.writeFileSync(lockPath(b), "not json");
  assert.equal((await startRun(build(env)).done).exit, 0, "an unreadable lock counts as stale");
});

test("the redactor hides token patterns and secret-looking environment values", () => {
  const r = makeRedactor(["sup3r-secret-value"]);
  assert.equal(r(`a ${FAKE_TOKEN} b`), "a [redacted] b");
  assert.equal(r("x sup3r-secret-value y"), "x [redacted] y");
  assert.equal(r("nothing here"), "nothing here");
});

test("running the tool with --apply works end to end", () => {
  const env = makeEnv();
  const out = execFileSync(process.execPath, [TOOL, "--config", env.configFile, "--hub", env.hub, "--role", "ai-developer", "--task", "go", "--folder", env.folder, "--apply"], { encoding: "utf8" });
  assert.match(out, /Finished .*: exit 0/);
  assert.equal(fs.readdirSync(path.join(env.hub, "runs")).filter((n) => n.endsWith(".log")).length, 1);
});
