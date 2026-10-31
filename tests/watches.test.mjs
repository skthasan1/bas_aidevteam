import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createGh } from "../tools/lib/gh.mjs";
import { prWatch, formatPrWatch } from "../tools/pr-watch.mjs";
import { questionWatch, isCandidate } from "../tools/question-watch.mjs";
import { mergeWatch, formatMergeWatch } from "../tools/merge-watch.mjs";
import { makeConfig, fakeRunner, tmpDir } from "./helpers.mjs";

const pr = (number, sha, extra = {}) => ({ number, title: `change ${number}`, author: { login: "dev-a" }, baseRefName: "develop", isDraft: false, headRefOid: sha, additions: 3, deletions: 1, url: `https://example.test/pr/${number}`, statusCheckRollup: [{ conclusion: "SUCCESS" }], ...extra });

test("pr-watch lists NEW then CHANGED, remembers state, never calls a write command", () => {
  const dir = tmpDir();
  const config = makeConfig();
  let prs = [pr(1, "aaa"), pr(2, "bbb", { author: { login: "dependabot[bot]" } })];
  const runner = fakeRunner(() => JSON.stringify(prs));
  const gh = createGh({ runner });

  let r = prWatch({ config, gh, stateDir: dir });
  assert.equal(r.fresh.length, 2); // 2 repos x pr 1 (dependabot one goes to other)
  assert.ok(r.fresh.every((f) => f.state === "NEW"));
  assert.equal(r.other.length, 2);
  assert.match(formatPrWatch(r), /2 pull request\(s\) to review/);

  r = prWatch({ config, gh, stateDir: dir });
  assert.equal(r.fresh.length, 0);
  assert.match(formatPrWatch(r), /No new or changed/);

  prs = [pr(1, "ccc")];
  r = prWatch({ config, gh, stateDir: dir });
  assert.ok(r.fresh.every((f) => f.state === "CHANGED"));

  r = prWatch({ config, gh, stateDir: dir, all: true });
  assert.equal(r.fresh.length, 2);

  for (const c of runner.calls) {
    assert.equal(c.args[0], "pr");
    assert.equal(c.args[1], "list");
    assert.ok(!c.args.some((a) => /merge|approve|review$/.test(a)));
  }
  assert.ok(runner.calls.every((c) => !c.args.includes("tasks") && !c.args.includes("acme/tasks")), "watch off project is skipped");
});

test("pr-watch dry run saves nothing and reports gh errors", () => {
  const dir = tmpDir();
  const config = makeConfig();
  const lines = [];
  const r = prWatch({ config, gh: createGh({ dryRun: true, log: (l) => lines.push(l), runner: fakeRunner(() => "") }), stateDir: dir });
  assert.equal(r.fresh.length, 0);
  assert.equal(lines.length, 2);
  assert.equal(fs.readdirSync(dir).length, 0);
  const bad = prWatch({ config, gh: createGh({ runner: fakeRunner(() => { throw new Error("no auth"); }) }), stateDir: dir });
  assert.equal(bad.errors.length, 2);
  assert.match(formatPrWatch(bad), /ERROR acme\/notes-web/);
});

test("question-watch filters owner, bot and AI-prefixed comments", () => {
  const ctx = { owners: new Set(["dana-owner"]), bots: ["dependabot[bot]"], prefixes: ["Reviewed by"] };
  const c = (login, body, type = "User") => ({ user: { login, type }, body });
  assert.equal(isCandidate(c("outsider", "How do I run this?"), ctx), true);
  assert.equal(isCandidate(c("Dana-Owner", "thanks"), ctx), false);
  assert.equal(isCandidate(c("some-app[bot]", "x", "Bot"), ctx), false);
  assert.equal(isCandidate(c("dependabot[bot]", "x"), ctx), false);
  assert.equal(isCandidate(c("outsider", "  reviewed by tech lead (Dana's AI assistant)"), ctx), false);
  assert.equal(isCandidate({ user: null, body: "x" }, ctx), false);
});

test("question-watch uses the stored timestamp and updates it", () => {
  const dir = tmpDir();
  const config = makeConfig();
  const seenUrls = [];
  const runner = fakeRunner((args) => {
    seenUrls.push(args[1]);
    return JSON.stringify([
      { user: { login: "outsider", type: "User" }, body: "Is this supported?", created_at: "2026-01-02T10:00:00Z", html_url: "https://example.test/c/1" },
      { user: { login: "dana-owner", type: "User" }, body: "yes", created_at: "2026-01-02T11:00:00Z", html_url: "https://example.test/c/2" },
    ]);
  });
  const gh = createGh({ runner });
  const now = new Date("2026-01-03T00:00:00Z");
  let r = questionWatch({ config, gh, stateDir: dir, now });
  assert.equal(r.candidates.length, 4); // 2 repos x (issues + pulls) x 1 candidate
  assert.ok(seenUrls[0].includes("since=2026-01-02T00%3A00%3A00.000Z"), "first run defaults to 24 hours back");
  assert.ok(runner.calls.every((c) => c.args[0] === "api" && !c.args.includes("-X")), "only GET requests");

  seenUrls.length = 0;
  questionWatch({ config, gh, stateDir: dir, now: new Date("2026-01-04T00:00:00Z") });
  assert.ok(seenUrls[0].includes("since=2026-01-03T00%3A00%3A00.000Z"), "second run uses the stored time");

  seenUrls.length = 0;
  questionWatch({ config, gh, stateDir: dir, since: "2025-12-01T00:00:00Z", save: false });
  assert.ok(seenUrls[0].includes("since=2025-12-01"));
});

test("question-watch does not advance the timestamp when gh fails", () => {
  const dir = tmpDir();
  const config = makeConfig();
  const r = questionWatch({ config, gh: createGh({ runner: fakeRunner(() => { throw new Error("rate limit"); }) }), stateDir: dir });
  assert.equal(r.errors.length, 4);
  assert.equal(fs.existsSync(path.join(dir, "question-watch-notes.json")), false);
});

test("merge-watch lists recent merges, flags QA pending and new conflicts", () => {
  const dir = tmpDir();
  const config = makeConfig();
  const now = new Date("2026-01-03T12:00:00Z");
  let conflict = "CONFLICTING";
  const runner = fakeRunner((args) => {
    if (args.includes("merged")) {
      return JSON.stringify([
        { number: 7, title: "Add export", mergedAt: "2026-01-03T09:00:00Z", mergedBy: { login: "dana-owner" }, author: { login: "dev-a" }, url: "https://example.test/pr/7", baseRefName: "develop", body: "QA: pending" },
        { number: 6, title: "Fix typo", mergedAt: "2026-01-03T08:00:00Z", mergedBy: { login: "dana-owner" }, author: { login: "dev-a" }, url: "https://example.test/pr/6", baseRefName: "develop", body: "QA done on full commit" },
        { number: 5, title: "Old", mergedAt: "2025-12-01T08:00:00Z", mergedBy: null, author: { login: "dev-a" }, url: "u", baseRefName: "develop", body: "QA pending" },
      ]);
    }
    return JSON.stringify([{ number: 9, title: "Wide refactor", mergeable: conflict, url: "https://example.test/pr/9", baseRefName: "develop" }]);
  });
  const gh = createGh({ runner });
  let r = mergeWatch({ config, gh, stateDir: dir, now });
  assert.equal(r.merges.length, 4);
  assert.equal(r.pendingQa.length, 2);
  assert.ok(r.conflicts.every((c) => c.isNew));
  assert.match(formatMergeWatch(r), /BECAME CONFLICTING/);
  assert.match(formatMergeWatch(r), /by dana-owner/);

  r = mergeWatch({ config, gh, stateDir: dir, now });
  assert.ok(r.conflicts.every((c) => !c.isNew));
  assert.match(formatMergeWatch(r), /still conflicting/);

  conflict = "MERGEABLE";
  r = mergeWatch({ config, gh, stateDir: dir, now });
  assert.equal(r.conflicts.length, 0);

  for (const c of runner.calls) assert.deepEqual(c.args.slice(0, 2), ["pr", "list"]);
});
