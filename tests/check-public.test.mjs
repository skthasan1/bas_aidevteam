import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { scanText, scanFolder, loadDenylist } from "../tools/check-public.mjs";
import { tmpDir } from "./helpers.mjs";

// Fixtures are assembled at run time so this file itself holds no token-like text.
const ghp = "ghp_" + "a1B2c3D4e5F6g7H8i9J0".repeat(2);
const pat = "github_pat_" + "A1b2C3d4E5f6G7h8I9j0K1";
const aws = "AKIA" + "ABCDEFGHIJKLMNOP";
const sk = "sk-" + "abcdefghijklmnopqrstuvwx";
const slack = "xoxb-" + "123456789012-abcdef";
const pem = "-----BEGIN " + "RSA PRIVATE KEY-----";
const winPath = "C:" + "\\Users\\someone\\project";
const homePath = "see /ho" + "me/someone/project/file";
const mail = "someone@" + "company.org";
const issue = "fixes #" + "123 today";
const rules = (text, opts) => scanText(text, opts).map((f) => f.rule);

test("token patterns are found", () => {
  for (const t of [ghp, pat, aws, sk, slack, pem]) assert.ok(rules(`value ${t} here`).some((r) => r === "token" || r === "private-key"), t.slice(0, 8));
});

test("emails, local paths and issue references are found", () => {
  assert.deepEqual(rules(`write to ${mail}`), ["email"]);
  assert.deepEqual(rules(winPath), ["local-path"]);
  assert.deepEqual(rules(homePath), ["local-path"]);
  assert.deepEqual(rules(issue), ["issue-ref"]);
});

test("negatives: safe text passes", () => {
  const text = [
    "Use the example address dana@example.com or bot@users.noreply.github.com.",
    "Color #123456 is not a reference in css, and #a1b2 neither.",
    "Heading level # 1 and C# 9 and issue-12.",
    "A token looks like ghp_ followed by characters; short sk-x is fine.",
    "Paths like /usr/local/bin and ./relative are fine.",
  ].join("\n");
  assert.deepEqual(scanText(text, { ext: ".md" }), []);
});

test("issue references are allowed inside a fence marked example, not in other fences", () => {
  const ok = "```example\nsee #" + "42\n```\n";
  assert.deepEqual(rules(ok), []);
  const bad = "```text\nsee #" + "42\n```\n";
  assert.deepEqual(rules(bad), ["issue-ref"]);
  const after = "```example\nx\n```\nafter #" + "7\n";
  assert.deepEqual(rules(after), ["issue-ref"]);
  assert.deepEqual(rules("see #" + "42", { ext: ".json" }), []);
});

test("deny list matches whole words, case-insensitively", () => {
  const terms = ["Dana", "Acme Secret"];
  assert.deepEqual(rules("dana wrote this", { terms }), ["denylist"]);
  assert.deepEqual(rules("the ACME SECRET plan", { terms }), ["denylist"]);
  assert.deepEqual(rules("Danaher and abdana", { terms }), []);
});

test("scanFolder reports file and line, scans file names, skips ignored folders", () => {
  const dir = tmpDir();
  fs.mkdirSync(path.join(dir, "docs"));
  fs.mkdirSync(path.join(dir, ".private"));
  fs.mkdirSync(path.join(dir, "node_modules"));
  fs.writeFileSync(path.join(dir, "docs", "a.md"), `fine\n${ghp}\n`);
  fs.writeFileSync(path.join(dir, "docs", "dana-notes.md"), "clean\n");
  fs.writeFileSync(path.join(dir, ".private", "secret.md"), `${ghp}\n`);
  fs.writeFileSync(path.join(dir, "node_modules", "x.md"), `${ghp}\n`);
  fs.writeFileSync(path.join(dir, "image.png"), Buffer.from([0, 1, 2]));
  const found = scanFolder(dir, { terms: ["dana"] });
  assert.deepEqual(found.map((f) => `${f.file}:${f.line}:${f.rule}`).sort(), ["docs/a.md:2:token", "docs/dana-notes.md:0:denylist"]);
});

test("loadDenylist reads {terms} or an array and rejects bad shapes", () => {
  const dir = tmpDir();
  const a = path.join(dir, "a.json"), b = path.join(dir, "b.json"), c = path.join(dir, "c.json");
  fs.writeFileSync(a, JSON.stringify({ terms: ["x", "y"] }));
  fs.writeFileSync(b, JSON.stringify(["z"]));
  fs.writeFileSync(c, JSON.stringify({ terms: [1] }));
  assert.deepEqual(loadDenylist(a), ["x", "y"]);
  assert.deepEqual(loadDenylist(b), ["z"]);
  assert.throws(() => loadDenylist(c), /expected/);
});

test("the command line exits 1 on findings, 0 when clean, 2 on bad input", () => {
  const tool = path.resolve("tools/check-public.mjs");
  const dir = tmpDir();
  const list = path.join(dir, "list.json");
  fs.writeFileSync(list, JSON.stringify({ terms: ["dana"] }));
  const clean = path.join(dir, "clean"); fs.mkdirSync(clean);
  fs.writeFileSync(path.join(clean, "a.md"), "nothing here\n");
  const dirty = path.join(dir, "dirty"); fs.mkdirSync(dirty);
  fs.writeFileSync(path.join(dirty, "a.md"), "Dana was here\n");
  const run = (...a) => spawnSync(process.execPath, [tool, ...a], { encoding: "utf8" });
  assert.equal(run(clean, "--denylist", list).status, 0);
  const bad = run(dirty, "--denylist", list);
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /a\.md:1 {2}denylist/);
  assert.equal(run(path.join(dir, "missing")).status, 2);
});

test("the example deny list ships with placeholders only and the real one is git-ignored", () => {
  const ex = loadDenylist(path.resolve("tools/public-denylist.example.json"));
  assert.ok(ex.every((t) => /^Example|^example-/.test(t)));
  assert.match(fs.readFileSync(path.resolve(".gitignore"), "utf8"), /^tools\/public-denylist\.json$/m);
});

test("more token, key, path, URL and encoded-email patterns", () => {
  const found = (text) => rules(text);
  assert.ok(found("v " + "gho_" + "a1B2c3D4e5F6g7H8i9J0k1").includes("token"));
  assert.ok(found("v " + "ghs_" + "a1B2c3D4e5F6g7H8i9J0k1").includes("token"));
  assert.ok(found("v " + "ghu_" + "a1B2c3D4e5F6g7H8i9J0k1").includes("token"));
  assert.ok(found("v " + "sk_" + "live_" + "abcdEFGH1234").includes("token"));
  assert.ok(found("v " + "AI" + "za" + "A".repeat(35)).includes("token"));
  assert.ok(found("-----BEGIN " + "PGP PRIVATE KEY BLOCK-----").includes("private-key"));
  assert.deepEqual(found("path C:" + "/Us" + "ers/someone/project"), ["local-path"]);
  assert.deepEqual(found("path /mn" + "t/c/Users/someone/x"), ["local-path"]);
  assert.deepEqual(found("cd /ho" + "me/someone"), ["local-path"]);
  assert.deepEqual(found("see https://github." + "com/acme/app/pull/12 now"), ["issue-ref"]);
  assert.deepEqual(found("see https://github." + "com/acme/app/issues/7"), ["issue-ref"]);
  assert.deepEqual(found("mail someone%40" + "company.org please"), ["email"]);
  assert.deepEqual(found("mail dana%40example.com"), []);
  // short or lookalike text is still fine
  assert.deepEqual(found("gho_short and AIza-short and /home/<name> and sk_live_x"), []);
});

test("an underscore is a word boundary for deny-listed terms", () => {
  assert.deepEqual(rules("Dana_Smith wrote it, also dana-smith and DANA_", { terms: ["Dana"] }), ["denylist"]);
  assert.deepEqual(rules("Danaher", { terms: ["Dana"] }), []);
});

test("scanFolder: UTF-16 files are decoded, binaries and symlinks are skipped with a warning", (t) => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, "wide.txt"), Buffer.from("﻿" + "token " + ghp + "\n", "utf16le"));
  fs.writeFileSync(path.join(dir, "pic.png"), Buffer.from([0, 1, 2]));
  const outside = tmpDir();
  fs.writeFileSync(path.join(outside, "x.md"), ghp);
  let linked = true;
  try { fs.symlinkSync(outside, path.join(dir, "link"), "junction"); } catch { linked = false; }
  const warnings = [];
  const found = scanFolder(dir, { warnings });
  assert.deepEqual(found.map((f) => `${f.file}:${f.rule}`), ["wide.txt:token"]);
  assert.ok(warnings.some((w) => /binary file skipped: pic\.png/.test(w)));
  if (linked) assert.ok(warnings.some((w) => /symlink skipped: link/.test(w)));
  else t.diagnostic("symlink part skipped");
});

test("scanFolder: only the given deny list file is skipped, and .private/.state/.watch only at the root", () => {
  const dir = tmpDir();
  fs.mkdirSync(path.join(dir, "tools")); fs.mkdirSync(path.join(dir, ".private")); fs.mkdirSync(path.join(dir, "sub", ".private"), { recursive: true });
  fs.writeFileSync(path.join(dir, "tools", "public-denylist.json"), "Dana is listed here\n");
  fs.writeFileSync(path.join(dir, "tools", "public-denylist-notes.md"), "Dana again\n");
  fs.writeFileSync(path.join(dir, ".private", "a.md"), "Dana\n");
  fs.writeFileSync(path.join(dir, "sub", ".private", "b.md"), "Dana\n");
  const key = (f) => `${f.file}`;
  const own = path.join(dir, "tools", "public-denylist.json");
  assert.deepEqual(scanFolder(dir, { terms: ["Dana"], skipFile: own }).map(key).sort(), ["sub/.private/b.md", "tools/public-denylist-notes.md"]);
  assert.deepEqual(scanFolder(dir, { terms: ["Dana"] }).map(key).sort(), ["sub/.private/b.md", "tools/public-denylist-notes.md", "tools/public-denylist.json"]);
});

test("with only the example deny list the command warns and fails unless --allow-example", () => {
  // run a copy of the tool in a folder that has just the example list, so a real tools/public-denylist.json cannot interfere
  const kit = tmpDir();
  fs.mkdirSync(path.join(kit, "tools", "lib"), { recursive: true });
  for (const f of ["check-public.mjs", "public-denylist.example.json", "lib/cli.mjs"]) fs.copyFileSync(path.resolve("tools", f), path.join(kit, "tools", f));
  const clean = path.join(kit, "scan"); fs.mkdirSync(clean);
  fs.writeFileSync(path.join(clean, "a.md"), "nothing here\n");
  const run = (...a) => spawnSync(process.execPath, [path.join(kit, "tools", "check-public.mjs"), clean, ...a], { encoding: "utf8" });
  const refused = run();
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /only the example deny list/);
  assert.equal(run("--allow-example").status, 0);
});
