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
    { kind: "image", path: "media/t1-1.png", caption: "A: vague" },
    { kind: "image", path: "media/t1-2.png", caption: "B: exact" },
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

const withItems = (...paths) => ({ ...blind, sections: [{ title: "P", items: paths.map((p) => ({ kind: "image", path: p })) }] });

test("blind page fails when a path is not a neutral name", () => {
  assert.throws(() => buildPage(withItems("media/pic-A.png")), /neutral name/);
  assert.throws(() => buildPage(withItems("media/photo.png")), /neutral name/);
  assert.doesNotThrow(() => buildPage(withItems("media/t1-1.png", "t1-2.mp4")));
});

test("blind page fails when a path contains a hint word, even with a neutral tail", () => {
  assert.throws(() => buildPage(withItems("control/t1-1.png")), /hint word "control"/);
  assert.throws(() => buildPage(withItems("variant/t1-1.png")), /hint word "variant"/);
});

test("blind page fails when visible text carries a hint word", () => {
  for (const field of ["title", "heading", "lede"]) {
    assert.throws(() => buildPage({ ...blind, [field]: "The new wording" }), new RegExp(`${field} contains the hint word "new"`));
  }
  const sec = (extra) => ({ ...blind, sections: [{ title: "P", ...extra, items: [{ kind: "image", path: "media/t1-1.png" }] }] });
  assert.throws(() => buildPage(sec({ title: "Baseline" })), /section 1 title/);
  assert.throws(() => buildPage(sec({ text: "Variant shown here" })), /section 1 text/);
  assert.throws(() => buildPage(sec({ question: "Is the old one worse?" })), /section 1 question/);
  assert.doesNotThrow(() => buildPage(sec({ text: "Plain wording", question: "Is the sign right?" })));
});

test("every page fails on a media path with a URL scheme, '..' or a leading slash", () => {
  const bads = ["javascript:alert(1)", "data:image/png;base64,AAAA", "http://example.com/x.png", "../secret/x.png", "media/../x.png", "/etc/x.png", "C:\\x.png"];
  for (const bad of bads) {
    const one = { kind: "image", path: bad };
    assert.throws(() => buildPage({ ...named, sections: [{ title: "P", items: [one] }] }), /media path/, bad);
    assert.throws(() => buildPage({ ...blind, sections: [{ title: "P", items: [one] }] }), /media path/, bad);
  }
});

test("unknown verdicts fall back to Inconclusive; there is no hidden Found chip", () => {
  const { html } = buildPage({ ...named, board: { rows: [{ idea: "i", verdict: "found" }] } });
  assert.match(html, /class="chip inconclusive"/);
  assert.doesNotMatch(html, /Found/);
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
  const noText = { ...spec, blind: true, sections: spec.sections.map(({ text, ...s }) => s) };
  assert.doesNotThrow(() => buildPage(noText));
  assert.ok(!("layout" in spec.sections[0]));
});
