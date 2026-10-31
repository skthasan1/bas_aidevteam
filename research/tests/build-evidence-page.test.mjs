import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildPage } from "../tools/build-evidence-page.mjs";

const named = {
  title: "Example",
  board: { rows: [{ idea: "Quote text", verdict: "adopt", evidence: "3 of 3", owner: "Dev", action: "issue: <org>/<repo>#1" }] },
  sections: [{ tag: "T1", title: "Text", cost: "$0.30", items: [{ kind: "image", path: "media/T1-A.png", caption: "A: vague" }] }],
};
const blind = {
  title: "Sheet",
  blind: true,
  board: { rows: [{ idea: "SECRET-IDEA", verdict: "adopt", evidence: "e" }] },
  review: { compare: "Two ways.", questions: ["Which is better?"], guess: "Which is new?", people: 3 },
  sections: [{ tag: "T1", title: "Pairs", cost: "$9.99", items: [
    { kind: "image", path: "media/x1.png", caption: "A: vague" },
    { kind: "image", path: "media/x2.png", caption: "B: exact" },
  ] }],
};

test("non-blind page: decision board comes before the test blocks, with chips and costs", () => {
  const { html } = buildPage(named);
  assert.ok(html.indexOf("Decision board") > -1);
  assert.ok(html.indexOf("Decision board") < html.indexOf("T1: Text"));
  assert.match(html, /class="chip adopt"/);
  assert.match(html, /\$0\.30/);
});

test("media are referenced by relative path, never embedded", () => {
  const { html } = buildPage(named);
  assert.match(html, /src="media\/T1-A\.png"/);
  assert.doesNotMatch(html, /data:/);
});

test("blind page: neutral names, no board, no costs, no variant captions, review block, empty score table", () => {
  const { html } = buildPage(blind);
  assert.match(html, /How to review/);
  assert.match(html, /t1-1/);
  assert.match(html, /t1-2/);
  assert.doesNotMatch(html, /A: vague|B: exact|SECRET-IDEA|Decision board|9\.99/);
  assert.match(html, /<table class="score">/);
  assert.equal((html.match(/<tr><td class="blank">/g) || []).length, 3);
  assert.ok(html.indexOf("How to review") < html.indexOf("Pairs"));
});

test("blind page without a review block fails to build", () => {
  const { review, ...noReview } = blind;
  assert.throws(() => buildPage(noReview), /review block/);
  assert.throws(() => buildPage({ ...blind, review: { compare: "x", questions: [], guess: "g" } }), /questions/);
});

test("blind page warns when a path gives the variant away", () => {
  const spec = { ...blind, sections: [{ title: "P", items: [{ kind: "image", path: "media/pic-A.png" }, { kind: "image", path: "media/t1-2.png" }] }] };
  const { warnings } = buildPage(spec);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /pic-A\.png/);
});

test("text is escaped", () => {
  const { html } = buildPage({ ...named, title: "<script>x</script>" });
  assert.doesNotMatch(html, /<script>x<\/script>/);
});

test("cli writes a file; a bad blind spec exits 1", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "bep-"));
  const script = path.resolve("research/tools/build-evidence-page.mjs");
  const good = path.join(d, "good.json");
  const bad = path.join(d, "bad.json");
  fs.writeFileSync(good, JSON.stringify(named));
  fs.writeFileSync(bad, JSON.stringify({ blind: true, sections: [] }));
  const ok = spawnSync(process.execPath, [script, good, path.join(d, "out.html")], { encoding: "utf8" });
  assert.equal(ok.status, 0);
  assert.ok(fs.existsSync(path.join(d, "out.html")));
  const no = spawnSync(process.execPath, [script, bad, path.join(d, "bad.html")], { encoding: "utf8" });
  assert.equal(no.status, 1);
  assert.ok(!fs.existsSync(path.join(d, "bad.html")));
});

test("the shipped example spec builds", () => {
  const spec = JSON.parse(fs.readFileSync(path.resolve("research/templates/evidence-spec.example.json"), "utf8"));
  assert.doesNotThrow(() => buildPage(spec));
  assert.doesNotThrow(() => buildPage({ ...spec, blind: true }));
});
