import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { validateConfig } from "../tools/lib/config.mjs";
import { checkPolicy } from "../tools/lib/policy.mjs";
import { PERMISSIONS, OPTIONAL, NEVER, appRequestFor, checkKeyFiles, resolveKeyPath } from "../tools/lib/identities.mjs";
import { doctor } from "../tools/doctor.mjs";
import { runAs } from "../tools/as-app.mjs";
import { todoText, plan } from "../tools/onboard.mjs";
import { startInstructions } from "../tools/lib/workers.mjs";
import { baseRaw, tmpDir } from "./helpers.mjs";

const APP = { id: "111", key_file: "/keys/a.pem", owner: "acme" };
const covers = { review: "role:tech-lead", test: "role:qa-lead", security: "role:security-lead", decision: "person:dana-owner" };

// A team config: dana runs a tech lead and a qa lead; patch edits the raw config before it is validated.
const raw = (patch = (x) => x) => {
  const r = baseRaw();
  r.ai_accounts = ["lead-bot", "qa-bot", "sec-bot"];
  r.projects.notes.lead = "lead-bot";
  r.projects.notes.merge = "lead-on-owner-word";
  r.projects.tasks.lead = "lead-bot";
  r.projects.notes.covers = { ...covers };
  r.projects.tasks.covers = { ...covers };
  r.people = { "dana-owner": { roles: [{ name: "tech-lead", account: "lead-bot" }, { name: "qa-lead", account: "qa-bot" }, { name: "security-lead", account: "sec-bot" }] } };
  return patch(r);
};
const build = (patch) => {
  const { errors, config } = validateConfig(raw(patch));
  if (errors.length) throw new Error(errors.join("; "));
  return config;
};
const errorsOf = (patch) => validateConfig(raw(patch)).errors.join("\n");
const worker = (r, i) => r.people["dana-owner"].roles[i];

// ---- config shapes ----

test("an app object is accepted and normalised; a numeric id becomes a string", () => {
  const c = build((r) => { worker(r, 1).app = { id: 4242, key_file: "/keys/q.pem" }; worker(r, 1).identity = "app"; return r; });
  const w = c.people["dana-owner"].roles[1];
  assert.deepEqual(w.app, { id: "4242", key_file: "/keys/q.pem", owner: "" });
  assert.equal(w.identity, "app");
  assert.equal(c.people["dana-owner"].roles[0].app, null);
});

test("bad app shapes are rejected with a clear message", () => {
  assert.match(errorsOf((r) => { worker(r, 0).app = { id: "abc", key_file: "/k.pem" }; return r; }), /app\.id must be the App's numeric ID/);
  assert.match(errorsOf((r) => { worker(r, 0).app = { id: 1.5, key_file: "/k.pem" }; return r; }), /app\.id must be/);
  assert.match(errorsOf((r) => { worker(r, 0).app = { id: "1" }; return r; }), /app\.key_file must be the path/);
  assert.match(errorsOf((r) => { worker(r, 0).app = "123"; return r; }), /app must be an object/);
  assert.match(errorsOf((r) => { worker(r, 0).app = { id: "1", key_file: "/k.pem", owner: "bad owner!" }; return r; }), /app\.owner/);
  assert.match(errorsOf((r) => { worker(r, 0).identity = "robot"; return r; }), /identity must be one of app, machine-user/);
});

test("a key or token pasted into the config is rejected, not stored", () => {
  const msg = errorsOf((r) => { worker(r, 0).app = { id: "1", key_file: "/k.pem", private_key: "-----BEGIN " + "PRIVATE KEY-----" }; return r; });
  assert.match(msg, /unknown field "private_key"/);
  assert.match(msg, /never put a key or token/);
});

test("the [bot] suffix is accepted for accounts, ai_accounts and a lead, and nowhere else", () => {
  assert.doesNotThrow(() => build((r) => {
    r.ai_accounts.push("acme-ai-qa-lead[bot]");
    worker(r, 1).account = "acme-ai-qa-lead[bot]";
    r.roles = [{ name: "qa-lead", account: "acme-ai-qa-lead[bot]" }];
    r.projects.tasks.lead = "acme-ai-qa-lead[bot]";
    return r;
  }));
  assert.match(errorsOf((r) => { worker(r, 0).account = "x[bot][bot]"; return r; }), /invalid account/);
  assert.match(errorsOf((r) => { r.roles = [{ name: "qa-lead", account: "x[bot]y" }]; return r; }), /invalid account/);
  // people, owners, members and handles are never bots
  assert.match(errorsOf((r) => { r.owner.handles = ["dana[bot]"]; return r; }), /owner\.handles: invalid handle/);
  assert.match(errorsOf((r) => { r.projects.notes.owners = ["dana[bot]"]; return r; }), /owners: invalid handle/);
  assert.match(errorsOf((r) => { r.projects.notes.members = ["sam[bot]"]; return r; }), /members: invalid handle/);
  assert.match(errorsOf((r) => { r.people["sam[bot]"] = { roles: [] }; return r; }), /people: invalid handle/);
  assert.match(errorsOf((r) => { r.ai_accounts.push("not a handle"); return r; }), /ai_accounts: invalid account/);
});

// ---- policy checks ----

test("two workers sharing one App id is an error (one identity per AI)", () => {
  const c = build((r) => { worker(r, 0).app = { ...APP, key_file: "/k/a.pem" }; worker(r, 1).app = { ...APP, key_file: "/k/b.pem" }; return r; });
  assert.match(checkPolicy(c).errors.join("\n"), /App 111 is also used by people\.dana-owner\.tech-lead/);
  const ok = build((r) => { worker(r, 0).app = { ...APP, key_file: "/k/a.pem" }; worker(r, 1).app = { ...APP, id: "222", key_file: "/k/b.pem" }; return r; });
  assert.doesNotMatch(checkPolicy(ok).errors.join("\n"), /App \d+ is also used/);
});

test("the same App id written as a number and as a string still counts as shared", () => {
  const c = build((r) => { worker(r, 0).app = { id: 111, key_file: "/k/a.pem" }; worker(r, 1).app = { id: "111", key_file: "/k/b.pem" }; return r; });
  assert.match(checkPolicy(c).errors.join("\n"), /App 111 is also used/);
});

test("without a people section, two roles sharing one account is an error too", () => {
  const c = build((r) => { delete r.people; r.roles = [{ name: "tech-lead", account: "lead-bot" }, { name: "qa-lead", account: "lead-bot" }]; return r; });
  assert.match(checkPolicy(c).errors.join("\n"), /account "lead-bot" is also used by roles\.tech-lead/);
});

test("a key file that is not a .pem is an error", () => {
  const c = build((r) => { worker(r, 0).app = { ...APP, key_file: "/keys/a.txt" }; return r; });
  assert.match(checkPolicy(c).errors.join("\n"), /key_file must be a \.pem file/);
  const upper = build((r) => { worker(r, 0).app = { ...APP, key_file: "/keys/a.PEM" }; return r; });
  assert.doesNotMatch(checkPolicy(upper).errors.join("\n"), /must be a \.pem/);
});

test("identity app needs an app, identity machine-user needs an account", () => {
  assert.match(checkPolicy(build((r) => { worker(r, 0).identity = "app"; return r; })).errors.join("\n"), /identity is "app" but no "app"/);
  assert.match(checkPolicy(build((r) => { worker(r, 0).identity = "machine-user"; worker(r, 0).account = ""; return r; })).errors.join("\n"), /identity is "machine-user" but no "account"/);
});

test("a team worker with no app and no account gets a warning; solo mode does not", () => {
  const team = build((r) => { worker(r, 2).account = ""; return r; });
  assert.match(checkPolicy(team).warnings.join("\n"), /security-lead: no identity .* person's login/);
  assert.doesNotMatch(checkPolicy(build()).warnings.join("\n"), /no identity/);
  const solo = build((r) => { r.mode = "solo"; worker(r, 2).account = ""; return r; });
  assert.doesNotMatch(checkPolicy(solo).warnings.join("\n"), /no identity/);
  assert.equal(checkPolicy(team).errors.some((e) => /no identity/.test(e)), false, "a warning, not an error");
});

// ---- key file location ----

const withApp = (file) => build((r) => { worker(r, 0).app = { ...APP, key_file: file }; return r; });

test("a key file inside a git repository is an error, even when the file does not exist yet", () => {
  const repo = tmpDir();
  fs.mkdirSync(path.join(repo, ".git"));
  fs.mkdirSync(path.join(repo, "secrets"));
  for (const f of [path.join(repo, "secrets", "k.pem"), path.join(repo, "secrets", "new.pem")]) {
    if (f.endsWith("k.pem")) fs.writeFileSync(f, "x");
    assert.match(checkKeyFiles(withApp(f)).errors.join("\n"), /inside a git repository/, f);
  }
  const outside = path.join(tmpDir(), "k.pem");
  fs.writeFileSync(outside, "x");
  assert.deepEqual(checkKeyFiles(withApp(outside)).errors, []);
});

test("a git worktree (.git is a file) counts as a repository", () => {
  const repo = tmpDir();
  fs.writeFileSync(path.join(repo, ".git"), "gitdir: elsewhere");
  assert.match(checkKeyFiles(withApp(path.join(repo, "k.pem"))).errors.join("\n"), /inside a git repository/);
});

test("a key file inside the hub or config folder is an error", () => {
  const hub = tmpDir(), other = tmpDir();
  const inHub = path.join(hub, "keys", "k.pem");
  fs.mkdirSync(path.dirname(inHub));
  fs.writeFileSync(inHub, "x");
  assert.match(checkKeyFiles(withApp(inHub), { hub }).errors.join("\n"), /inside the hub or config folder/);
  assert.match(checkKeyFiles(withApp(inHub), { configDir: hub }).errors.join("\n"), /inside the hub or config folder/);
  assert.deepEqual(checkKeyFiles(withApp(inHub), { hub: other, configDir: other }).errors, []);
});

test("a path whose file and parent both do not exist is not checked", () => {
  const missing = path.join(tmpDir(), "no", "such", "dir", "k.pem");
  assert.deepEqual(checkKeyFiles(withApp(missing), { checkKeys: false }), { errors: [], warnings: [] });
});

test("the key contents are never read", () => {
  const dir = tmpDir();
  const key = path.join(dir, "k.pem");
  fs.writeFileSync(key, "SECRET-KEY-CONTENTS");
  const real = fs.readFileSync, open = fs.openSync;
  fs.readFileSync = (p, ...a) => { if (String(p) === key) throw new Error("key was read"); return real(p, ...a); };
  fs.openSync = (p, ...a) => { if (String(p) === key) throw new Error("key was opened"); return open(p, ...a); };
  try {
    const res = checkKeyFiles(withApp(key), { checkKeys: true });
    assert.doesNotMatch(JSON.stringify(res), /SECRET/);
  } finally { fs.readFileSync = real; fs.openSync = open; }
});

test("--check-keys: a missing file is an error; on POSIX a world-readable key is an error and a group-readable key a warning", () => {
  const c = withApp(path.join(tmpDir(), "missing.pem"));
  assert.match(checkKeyFiles(c, { checkKeys: true }).errors.join("\n"), /does not exist or cannot be read/);
  assert.deepEqual(checkKeyFiles(c, { checkKeys: false }).errors, [], "without the flag nothing is required to exist");
  const fake = (mode) => () => ({ mode });
  const file = withApp("/keys/a.pem");
  assert.match(checkKeyFiles(file, { checkKeys: true, platform: "linux", statImpl: fake(0o100644) }).errors.join("\n"), /readable by every user/);
  assert.deepEqual(checkKeyFiles(file, { checkKeys: true, platform: "linux", statImpl: fake(0o100600) }), { errors: [], warnings: [] });
  assert.match(checkKeyFiles(file, { checkKeys: true, platform: "linux", statImpl: fake(0o100640) }).warnings.join("\n"), /readable by its group/);
  assert.deepEqual(checkKeyFiles(file, { checkKeys: true, platform: "win32", statImpl: fake(0o100666) }), { errors: [], warnings: [] }, "Windows: existence only");
});

test("doctor reports key problems and accepts --check-keys", () => {
  const repo = tmpDir();
  fs.mkdirSync(path.join(repo, ".git"));
  const lines = [];
  const res = doctor({ config: withApp(path.join(repo, "k.pem")), log: (l) => lines.push(l) });
  assert.ok(res.errors.some((e) => /inside a git repository/.test(e)));
  assert.ok(lines.some((l) => l.startsWith("PROBLEM:")));
  const cli = spawnSync(process.execPath, ["tools/doctor.mjs", "--help"], { encoding: "utf8" });
  assert.match(cli.stdout, /--check-keys/);
});

test("resolveKeyPath expands ~ and makes the path absolute", () => {
  const home = path.join(tmpDir(), "fake-home");
  assert.equal(resolveKeyPath("~/k/a.pem", home), path.resolve(home, "k", "a.pem"));
  assert.ok(path.isAbsolute(resolveKeyPath("rel/a.pem")));
});

// ---- as-app ----

const appConfig = (extra) => build((r) => { worker(r, 1).app = { id: "4242", key_file: "/keys/q.pem", owner: "acme" }; return extra ? extra(r) : r; });
const childPrint = ["-e", "console.log('GH_TOKEN=' + (process.env.GH_TOKEN ? 'set' : 'missing') + ' GITHUB_TOKEN=' + (process.env.GITHUB_TOKEN ? 'set' : 'missing'))"];
const TOKEN = "ghs_FAKE_TOKEN_VALUE";

test("as-app starts the command with GH_TOKEN set and GITHUB_TOKEN removed, and never prints the token", async () => {
  const logs = [];
  const seen = [];
  const res = await runAs({
    config: appConfig(), role: "qa-lead", person: "dana-owner", command: [process.execPath, ...childPrint], stdio: "pipe", log: (l) => logs.push(l),
    getTokenImpl: async (o) => { seen.push(o); return TOKEN; }, env: { ...process.env, GITHUB_TOKEN: "person-token" },
  });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /GH_TOKEN=set GITHUB_TOKEN=missing/);
  assert.equal(seen[0].appId, "4242");
  assert.equal(seen[0].owner, "acme", "owner falls back to app.owner");
  assert.equal(path.isAbsolute(seen[0].keyFile), true);
  for (const out of [res.stdout, res.stderr, logs.join("\n")]) assert.equal(out.includes(TOKEN), false);
});

test("as-app gives the child the exact token, and passes the exit code through", async () => {
  const res = await runAs({
    config: appConfig(), role: "qa-lead", owner: "other-org", stdio: "pipe", getTokenImpl: async (o) => (o.owner === "other-org" ? TOKEN : "wrong"),
    command: [process.execPath, "-e", `process.exit(process.env.GH_TOKEN === ${JSON.stringify(TOKEN)} ? 7 : 1)`],
  });
  assert.equal(res.status, 7);
});

test("as-app refuses a worker with no app, and a missing owner or command", async () => {
  const noop = async () => { throw new Error("must not get a token"); };
  await assert.rejects(runAs({ config: appConfig(), role: "tech-lead", command: ["gh"], getTokenImpl: noop, owner: "acme" }), /no "app" in the config/);
  await assert.rejects(runAs({ config: appConfig((r) => { delete worker(r, 1).app.owner; return r; }), role: "qa-lead", command: ["gh"], getTokenImpl: noop }), /--owner/);
  await assert.rejects(runAs({ config: appConfig(), role: "qa-lead", command: [], getTokenImpl: noop }), /command to run after --/);
  await assert.rejects(runAs({ config: appConfig(), role: "nobody", command: ["gh"], getTokenImpl: noop }), /unknown role/);
});

test("as-app --dry-run prints the worker, App id, owner and command but gets no token", async () => {
  const logs = [];
  const res = await runAs({ config: appConfig(), role: "qa-lead", command: ["gh", "pr", "list"], dryRun: true, log: (l) => logs.push(l), getTokenImpl: async () => { throw new Error("no token in a dry run"); } });
  assert.equal(res.status, 0);
  const text = logs.join("\n");
  for (const s of ["qa-lead", "4242", "acme", "gh pr list"]) assert.ok(text.includes(s), s);
});

test("as-app from the command line: a worker with no app fails with exit 2 and no token on screen", () => {
  const dir = tmpDir();
  const cfg = path.join(dir, "c.json");
  fs.writeFileSync(cfg, JSON.stringify(raw()));
  const r = spawnSync(process.execPath, ["tools/as-app.mjs", "--config", cfg, "--role", "tech-lead", "--owner", "acme", "--", "gh", "--version"], { encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no "app" in the config/);
  const dry = spawnSync(process.execPath, ["tools/as-app.mjs", "--config", cfg, "--role", "tech-lead", "--owner", "acme", "--dry-run", "yes", "--", "gh"], { encoding: "utf8" });
  assert.equal(dry.status, 2);
  assert.match(dry.stderr, /unexpected argument "yes"/, "--dry-run takes only true or false, so a typo can not skip the dry run");
});

// ---- permissions ----

const ALL_ROLES = ["tech-lead", "ai-developer", "qa-lead", "security-lead", "researcher"];
const levelOf = (req, name) => req.permissions.find((p) => p.name === name)?.level;

test("no role ever asks for Administration, Secrets, Environments, Packages or an organization or account permission", () => {
  const banned = /administration|secrets|environments|packages|organization|account|members|billing|codespaces|dependabot/i;
  for (const role of ALL_ROLES) {
    const req = appRequestFor({ name: role, account: "x-bot", person: "" }, [{ repos: { a: "acme/a" }, lead: "x-bot", merge: "lead-after-conditions" }], "acme");
    for (const p of [...req.permissions, ...req.optional, ...PERMISSIONS[role], ...(OPTIONAL[role] ?? [])]) assert.doesNotMatch(p.name, banned, `${role}: ${p.name}`);
  }
  for (const n of ["Administration", "Secrets", "Environments", "Packages"]) assert.ok(NEVER.includes(n));
});

test("every role gets Metadata read", () => {
  for (const role of ALL_ROLES) assert.equal(levelOf(appRequestFor({ name: role }, [], "acme"), "Metadata"), "read", role);
});

test("a tech lead gets Contents write only when it leads a project whose merge is not owner-only", () => {
  const lead = { name: "tech-lead", account: "lead-bot" };
  const proj = (merge, leadName = "lead-bot") => ({ repos: { a: "acme/a" }, lead: leadName, merge });
  assert.equal(levelOf(appRequestFor(lead, [proj("owner-only")], "acme"), "Contents"), "read");
  assert.equal(levelOf(appRequestFor(lead, [], "acme"), "Contents"), "read");
  assert.equal(levelOf(appRequestFor(lead, [proj("lead-after-conditions")], "acme"), "Contents"), "write");
  assert.equal(levelOf(appRequestFor(lead, [proj("lead-on-owner-word")], "acme"), "Contents"), "write");
  assert.equal(levelOf(appRequestFor(lead, [proj("lead-on-owner-word", "someone-else")], "acme"), "Contents"), "read", "only a project it leads counts");
  assert.equal(levelOf(appRequestFor({ name: "qa-lead", account: "lead-bot" }, [proj("lead-on-owner-word")], "acme"), "Contents"), "read", "no other role gains write from merge power");
});

test("role permission sets match the design", () => {
  const spec = {
    "tech-lead": { Contents: "read", "Pull requests": "write", Issues: "write", Checks: "read", "Commit statuses": "read", Actions: "read" },
    "ai-developer": { Contents: "write", "Pull requests": "write", Issues: "write", Checks: "read", "Commit statuses": "read", Actions: "read" },
    "qa-lead": { Contents: "read", "Pull requests": "write", Issues: "write", Checks: "read", "Commit statuses": "read", Actions: "read" },
    "security-lead": { Contents: "write", "Pull requests": "write", Issues: "write", Checks: "read", "Commit statuses": "read", Actions: "read" },
    researcher: { Contents: "write", "Pull requests": "write", Issues: "write" },
  };
  for (const [role, want] of Object.entries(spec)) {
    const got = Object.fromEntries(appRequestFor({ name: role }, [], "acme").permissions.filter((p) => p.name !== "Metadata").map((p) => [p.name, p.level]));
    assert.deepEqual(got, want, role);
  }
});

test("Workflows write is optional for the ai-developer only, with its condition", () => {
  const dev = appRequestFor({ name: "ai-developer" }, [], "acme");
  assert.equal(levelOf(dev, "Workflows"), undefined, "not requested by default");
  assert.equal(dev.optional[0].name, "Workflows");
  assert.match(dev.optional[0].when, /only if it edits CI files, then every CI change is a pull request a person reads/);
  assert.deepEqual(appRequestFor({ name: "qa-lead" }, [], "acme").optional, []);
});

test("the request names the App, its repositories and where it can be installed", () => {
  const one = appRequestFor({ name: "qa-lead", person: "dana-owner" }, [{ repos: { a: "acme/a", b: "acme/b" } }, { repos: { c: "acme/a" } }], "Acme");
  assert.equal(one.appName, "acme-ai-qa-lead");
  assert.deepEqual(one.repos, ["acme/a", "acme/b"]);
  assert.equal(one.installOn, "Only on this account");
  const mixed = appRequestFor({ name: "qa-lead" }, [{ repos: { a: "acme/a", b: "dana-personal/b" } }], "acme");
  assert.equal(mixed.installOn, "Any account");
  const many = appRequestFor({ name: "ai-developer", person: "sam-dev", index: 1, sameRole: 3 }, [], "acme");
  assert.equal(many.appName, "acme-ai-ai-developer-sam-dev-2");
  assert.doesNotMatch(many.notes.join("\n"), /34 characters|allows 34/);
  const long = appRequestFor({ name: "security-lead", person: "samantha-longname", index: 0, sameRole: 2 }, [], "acme");
  assert.match(long.notes.join("\n"), /GitHub allows 34/);
});

// ---- onboard ----

test("the to-do list has an AI identities section per worker, with no secrets", () => {
  const c = appConfig();
  const t = todoText(c);
  assert.match(t, /## 3\. AI identities/);
  for (const s of ["acme-ai-tech-lead", "acme-ai-qa-lead", "acme-ai-security-lead", "Where can this be installed", "outside every repository", "only the App ID and the key path", "node tools/app-token.mjs", "test comment"]) assert.ok(t.includes(s), s);
  assert.doesNotMatch(t, /PRIVATE KEY|ghs_|\/keys\/q\.pem/);
  // the leading tech lead has merge power in this config, so it asks for Contents write
  assert.match(t.split("### qa-lead")[0], /Contents: write/);
  assert.match(t.split("### qa-lead")[1].split("###")[0], /Contents: read/);
});

test("START-WORKERS shows the as-app command only for a worker that has an app", () => {
  const text = startInstructions(appConfig(), "hub");
  const qa = text.split("## qa-lead")[1].split("## ")[0];
  assert.match(qa, /node tools\/as-app\.mjs --config hub\/qa-projects\.json --role qa-lead --person dana-owner --account qa-bot --owner acme --/);
  assert.doesNotMatch(text.split("## qa-lead")[0], /as-app/);
});

test("onboard keeps app and identity when it writes the config back", () => {
  const kit = tmpDir();
  fs.mkdirSync(path.join(kit, "templates", "hub"), { recursive: true });
  const { files } = plan({ config: appConfig((r) => { worker(r, 1).identity = "app"; return r; }), kitRoot: kit, hubPath: "hub" });
  const written = JSON.parse(files.find((f) => f.rel === "qa-projects.json").content);
  const w = written.people["dana-owner"].roles.find((x) => x.name === "qa-lead");
  assert.deepEqual(w.app, { id: "4242", key_file: "/keys/q.pem", owner: "acme" });
  assert.equal(w.identity, "app");
  assert.equal(validateConfig(written).errors.length, 0);
});
