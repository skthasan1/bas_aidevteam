import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseArgs } from "../tools/lib/cli.mjs";
import { readState, writeState } from "../tools/lib/state.mjs";
import { tmpDir } from "./helpers.mjs";

test("yes/no flags accept only true or false", () => {
  const b = ["apply", "force"];
  assert.equal(parseArgs(["--apply"], b).flags.apply, true);
  assert.equal(parseArgs(["--apply=true"], b).flags.apply, true);
  assert.equal(parseArgs(["--apply=false"], b).flags.apply, false);
  assert.equal(parseArgs(["--apply", "false", "--force"], b).flags.apply, false);
  for (const bad of ["--apply=false2", "--force=no", "--apply=0", "--force="]) assert.throws(() => parseArgs([bad], b), /yes\/no flag/, bad);
  // a word after a yes/no flag that is not true/false is not swallowed as its value
  const r = parseArgs(["--apply", "0"], b);
  assert.equal(r.flags.apply, true);
  assert.deepEqual(r.positional, ["0"]);
  // value flags are unchanged
  assert.equal(parseArgs(["--target=x", "--config", "y"], b).flags.target, "x");
});

test("the onboard command refuses --apply=false style typos instead of applying", () => {
  const tool = path.resolve("tools/onboard.mjs");
  const run = (...a) => spawnSync(process.execPath, [tool, ...a], { encoding: "utf8" });
  const dir = tmpDir();
  const cfg = path.resolve("examples/acme/qa-projects.json");
  const target = path.join(dir, "hub");
  assert.equal(run("--config", cfg, "--target", target, "--apply=no").status, 2);
  assert.equal(run("--config", cfg, "--target", target, "--apply", "0").status, 2, "a stray word is an error, not an apply");
  assert.equal(fs.existsSync(target), false);
  assert.equal(run("--config", cfg, "--target", target, "--apply=false").status, 0);
  assert.equal(fs.existsSync(target), false, "--apply=false is a dry run");
});

test("readState returns the fallback unless the file holds a plain object", () => {
  const dir = tmpDir();
  for (const [name, text] of [["arr", "[1,2]"], ["nul", "null"], ["num", "5"], ["str", '"x"'], ["bad", "{oops"]]) {
    fs.writeFileSync(path.join(dir, `${name}.json`), text);
    assert.deepEqual(readState(dir, name, { fb: 1 }), { fb: 1 }, name);
  }
  assert.equal(readState(dir, "missing", null), null);
  writeState(dir, "ok", { a: 1 });
  assert.deepEqual(readState(dir, "ok"), { a: 1 });
});
