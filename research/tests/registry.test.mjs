import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { emptyRegistry, addTest, setField, findTests, listTests, loadRegistry, saveRegistry, main } from "../tools/registry.mjs";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "reg-"));

test("add creates an entry with defaults", () => {
  const reg = emptyRegistry();
  const e = addTest(reg, { id: "R-1", idea: "quote text" });
  assert.equal(e.status, "planned");
  assert.deepEqual(e.tags, []);
  assert.equal(reg.tests.length, 1);
});

test("add refuses duplicate id, missing idea and bad status", () => {
  const reg = emptyRegistry();
  addTest(reg, { id: "R-1", idea: "x" });
  assert.throws(() => addTest(reg, { id: "R-1", idea: "y" }), /already exists/);
  assert.throws(() => addTest(reg, { id: "R-2" }), /idea is required/);
  assert.throws(() => addTest(reg, { id: "R-3", idea: "z", status: "done" }), /status must be/);
});

test("judged without an action line is refused on add and on set", () => {
  const reg = emptyRegistry();
  assert.throws(() => addTest(reg, { id: "R-1", idea: "x", status: "judged" }), /action line/);
  addTest(reg, { id: "R-2", idea: "x" });
  assert.throws(() => setField(reg, "R-2", { status: "judged" }), /action line/);
  assert.throws(() => setField(reg, "R-2", { status: "judged", action: "   " }), /action line/);
  assert.equal(reg.tests[0].status, "planned");
});

test("judged with an action line is accepted", () => {
  const reg = emptyRegistry();
  addTest(reg, { id: "R-1", idea: "x" });
  const e = setField(reg, "R-1", { status: "judged", action: "no action: dropped" });
  assert.equal(e.status, "judged");
  assert.equal(e.action, "no action: dropped");
});

test("set refuses unknown ids, unknown fields and id changes", () => {
  const reg = emptyRegistry();
  addTest(reg, { id: "R-1", idea: "x" });
  assert.throws(() => setField(reg, "R-9", { result: "r" }), /no test/);
  assert.throws(() => setField(reg, "R-1", { colour: "red" }), /cannot set/);
  assert.throws(() => setField(reg, "R-1", { id: "R-2" }), /cannot set/);
});

test("find matches all words in any field; list filters by status", () => {
  const reg = emptyRegistry();
  addTest(reg, { id: "R-1", idea: "Quote exact text", tags: "prompt,images" });
  addTest(reg, { id: "R-2", idea: "Handwriting look", status: "measured" });
  assert.equal(findTests(reg, "exact TEXT").length, 1);
  assert.equal(findTests(reg, "images").length, 1);
  assert.equal(findTests(reg, "exact handwriting").length, 0);
  assert.equal(listTests(reg, { status: "measured" }).length, 1);
});

test("cli: add, set, find and list work on a file and persist", () => {
  const file = path.join(tmp(), "registry.json");
  const out = [];
  const run = (...a) => main([...a, "--file", file], (l) => out.push(l));
  run("add", "--id", "R-1", "--idea", "Quote text", "--cost", "1.5", "--tags", "a,b");
  assert.equal(loadRegistry(file).tests[0].cost, 1.5);
  assert.throws(() => run("set", "R-1", "--status", "judged"), /action line/);
  run("set", "R-1", "--status", "judged", "--action", "issue: <org>/<repo>#1");
  assert.equal(loadRegistry(file).tests[0].status, "judged");
  out.length = 0;
  run("find", "nothing-like-this");
  assert.deepEqual(out, ["not run before"]);
  out.length = 0;
  run("list", "--status", "judged");
  assert.equal(out.length, 1);
});

test("read commands on a missing file fail with 'file not found' and create nothing", () => {
  const file = path.join(tmp(), "missing.json");
  for (const cmd of [["list"], ["find", "x"], ["set", "R-1", "--status", "measured"]]) {
    assert.throws(() => main([...cmd, "--file", file], () => {}), /file not found: /);
  }
  assert.ok(!fs.existsSync(file));
  main(["add", "--id", "R-1", "--idea", "x", "--file", file], () => {});
  assert.ok(fs.existsSync(file));
});

test("cli exits 1 with 'file not found' for list on a missing file", () => {
  const file = path.join(tmp(), "missing.json");
  const r = spawnSync(process.execPath, [path.resolve("research/tools/registry.mjs"), "list", "--file", file], { encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /file not found/);
});

test("unknown flags and flag values starting with -- are rejected", () => {
  const file = path.join(tmp(), "r.json");
  assert.throws(() => main(["add", "--id", "R-1", "--idea", "x", "--colour", "red", "--file", file], () => {}), /unknown flag: --colour/);
  assert.throws(() => main(["add", "--id", "R-1", "--idea", "--cost", "1", "--file", file], () => {}), /--idea needs a value/);
  assert.ok(!fs.existsSync(file));
});

test("save is atomic: no temp file is left and a failed write keeps the old file", () => {
  const d = tmp();
  const file = path.join(d, "r.json");
  const reg = emptyRegistry();
  addTest(reg, { id: "R-1", idea: "x" });
  saveRegistry(file, reg);
  assert.deepEqual(fs.readdirSync(d), ["r.json"]);
  const before = fs.readFileSync(file, "utf8");
  const circular = {};
  circular.self = circular;
  assert.throws(() => saveRegistry(file, circular));
  assert.equal(fs.readFileSync(file, "utf8"), before);
  assert.deepEqual(fs.readdirSync(d), ["r.json"]);
});

test("malformed JSON gives a clear error", () => {
  const file = path.join(tmp(), "r.json");
  fs.writeFileSync(file, "{ not json");
  assert.throws(() => loadRegistry(file), /not valid JSON/);
});
