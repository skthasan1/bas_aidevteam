import { test } from "node:test";
import assert from "node:assert/strict";
import { createGh, GhError } from "../tools/lib/gh.mjs";
import { fakeRunner } from "./helpers.mjs";

test("dry run prints the command and does not call the runner", () => {
  const runner = fakeRunner(() => "should not run");
  const lines = [];
  const gh = createGh({ dryRun: true, runner, log: (l) => lines.push(l) });
  assert.equal(gh.run(["pr", "list", "-R", "acme/x", "--search", "a b; rm -rf /"]), null);
  assert.equal(runner.calls.length, 0);
  assert.match(lines[0], /^\[dry-run\] gh pr list -R acme\/x --search "a b; rm -rf \/"$/);
});

test("arguments are passed as an array, never joined into a shell string", () => {
  const runner = fakeRunner(() => "[]");
  const gh = createGh({ runner });
  gh.run(["issue", "list", "--search", "x; echo hi"]);
  assert.equal(runner.calls[0].cmd, "gh");
  assert.deepEqual(runner.calls[0].args, ["issue", "list", "--search", "x; echo hi"]);
});

test("a string instead of an array is refused", () => {
  const gh = createGh({ runner: fakeRunner(() => "") });
  assert.throws(() => gh.run("pr list"), TypeError);
  assert.throws(() => gh.run(["pr", 5]), TypeError);
});

test("json parses output, returns null on empty, wraps failures", () => {
  assert.deepEqual(createGh({ runner: fakeRunner(() => '[{"a":1}]') }).json(["x"]), [{ a: 1 }]);
  assert.equal(createGh({ runner: fakeRunner(() => "  ") }).json(["x"]), null);
  const gh = createGh({ runner: fakeRunner(() => { const e = new Error("boom"); e.stderr = "not signed in"; throw e; }) });
  assert.throws(() => gh.run(["pr", "list"]), (e) => e instanceof GhError && /not signed in/.test(e.message));
});

test("input is forwarded to the runner", () => {
  const runner = fakeRunner(() => "ok");
  createGh({ runner }).run(["issue", "create"], { input: "body" });
  assert.equal(runner.calls[0].input, "body");
});
