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
  assert.deepEqual(createGh({ runner: fakeRunner(() => '[{"a":1}]') }).json(["pr", "list"]), [{ a: 1 }]);
  assert.equal(createGh({ runner: fakeRunner(() => "  ") }).json(["pr", "list"]), null);
  const gh = createGh({ runner: fakeRunner(() => { const e = new Error("boom"); e.stderr = "not signed in"; throw e; }) });
  assert.throws(() => gh.run(["pr", "list"]), (e) => e instanceof GhError && /not signed in/.test(e.message));
});

test("input is forwarded to the runner", () => {
  const runner = fakeRunner(() => "ok");
  createGh({ runner }).run(["issue", "create"], { input: "body", write: true });
  assert.equal(runner.calls[0].input, "body");
});

test("read-only by default: only the allowlisted subcommands run", () => {
  const runner = fakeRunner(() => "[]");
  const gh = createGh({ runner });
  for (const a of [["pr", "list"], ["pr", "view", "5"], ["pr", "diff", "5"], ["pr", "checks", "5"], ["issue", "list"], ["issue", "view", "5"], ["api", "repos/a/b/issues"], ["api", "-X", "GET", "repos/a/b"], ["api", "--method=get", "x"]]) gh.run(a);
  assert.equal(runner.calls.length, 9);
  const before = runner.calls.length;
  for (const a of [["pr", "merge", "5"], ["pr", "review", "5", "--approve"], ["pr", "comment", "5"], ["issue", "create"], ["repo", "delete", "x"], ["auth", "token"], [], ["api"].concat(["-X", "POST", "x"]), ["api", "--method", "DELETE", "x"], ["api", "-XPATCH", "x"], ["api", "--method=PUT", "x"], ["api", "x", "-f", "a=b"], ["api", "x", "-F", "a=b"], ["api", "x", "--field", "a=b"], ["api", "x", "--raw-field=a=b"], ["api", "x", "--input", "f.json"]]) {
    assert.throws(() => gh.run(a), GhError, JSON.stringify(a));
  }
  assert.equal(runner.calls.length, before, "a refused command never reaches the runner");
  assert.throws(() => createGh({ dryRun: true, runner, log: () => {} }).run(["pr", "merge", "1"]), GhError, "also refused in dry run");
});

test("{ write: true } is the only way to run a write command", () => {
  const runner = fakeRunner(() => "ok");
  const gh = createGh({ runner });
  assert.equal(gh.run(["pr", "merge", "5"], { write: true }), "ok");
  assert.equal(gh.run(["api", "-X", "POST", "x"], { write: true }), "ok");
  assert.throws(() => gh.run(["pr", "merge", "5"], { write: "yes" }), GhError, "only the boolean true counts");
});
