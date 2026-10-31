import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { checkRegistry, checkEvidence, checkMedia, checkKeyNames, checkResearch } from "../tools/check-research.mjs";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "chk-"));
const write = (dir, name, content) => {
  const f = path.join(dir, name);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, typeof content === "string" ? content : JSON.stringify(content));
  return f;
};
const validReview = { compare: "Two ways.", questions: ["Which is better?"], guess: "Which is new?" };

test("registry: judged without action fails, with action passes", () => {
  const d = tmp();
  const bad = write(d, "bad.json", { tests: [{ id: "R-1", status: "judged", action: "" }, { id: "R-2", status: "planned" }] });
  const good = write(d, "good.json", { tests: [{ id: "R-1", status: "judged", action: "no action: dropped" }] });
  const problems = checkRegistry(bad);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /R-1/);
  assert.deepEqual(checkRegistry(good), []);
});

test("evidence: blind spec without review fails; with review passes; non-blind ignored", () => {
  const d = tmp();
  write(d, "blind-bad.json", { blind: true, sections: [] });
  write(d, "blind-partial.json", { blind: true, review: { compare: "x", questions: [] } });
  write(d, "blind-good.json", { blind: true, review: validReview });
  write(d, "named.json", { sections: [] });
  const problems = checkEvidence(d);
  assert.ok(problems.some((p) => p.includes("blind-bad.json")));
  assert.ok(problems.some((p) => p.includes("blind-partial.json") && /questions/.test(p)));
  assert.ok(!problems.some((p) => p.includes("blind-good.json") || p.includes("named.json")));
});

test("media: media files in the research folder fail; text files pass", () => {
  const d = tmp();
  write(d, "notes.md", "text");
  assert.deepEqual(checkMedia(d), []);
  write(d, "sub/picture.PNG", "x");
  write(d, "clip.mp4", "x");
  assert.equal(checkMedia(d).length, 2);
});

test("checkResearch combines all three checks", () => {
  const d = tmp();
  const reg = write(d, "r.json", { tests: [{ id: "R-1", status: "judged" }] });
  const ev = path.join(d, "ev");
  write(ev, "s.json", { blind: true });
  write(d, "x.jpg", "x");
  assert.equal(checkResearch({ registry: reg, evidence: ev, root: d }).length, 3);
});

test("cli exits 1 on a problem and 0 when clean", () => {
  const d = tmp();
  const reg = write(d, "r.json", { tests: [{ id: "R-1", status: "judged" }] });
  const script = path.resolve("research/tools/check-research.mjs");
  const bad = spawnSync(process.execPath, [script, "--registry", reg, "--root", d], { encoding: "utf8" });
  assert.equal(bad.status, 1);
  fs.writeFileSync(reg, JSON.stringify({ tests: [{ id: "R-1", status: "judged", action: "no action: x" }] }));
  const out = execFileSync(process.execPath, [script, "--registry", reg, "--root", d], { encoding: "utf8" });
  assert.match(out, /ok/);
});

test("registry: malformed JSON is a clear problem, not a stack trace (also on the CLI)", () => {
  const d = tmp();
  const bad = write(d, "bad.json", "{ nope");
  const problems = checkRegistry(bad);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /not valid JSON/);
  const r = spawnSync(process.execPath, [path.resolve("research/tools/check-research.mjs"), "--registry", bad, "--root", d], { encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /FAIL .*not valid JSON/);
  assert.doesNotMatch(r.stderr, /\n\s+at /);
});

test("evidence: a non-boolean blind value is rejected", () => {
  const d = tmp();
  write(d, "s1.json", { blind: "true", sections: [] });
  write(d, "s2.json", { blind: 1, sections: [] });
  write(d, "s3.json", { blind: false, sections: [] });
  const problems = checkEvidence(d);
  assert.ok(problems.some((p) => p.includes("s1.json") && /"blind" must be true or false/.test(p)));
  assert.ok(problems.some((p) => p.includes("s2.json")));
  assert.ok(!problems.some((p) => p.includes("s3.json")));
});

test("key-like file names are flagged; ordinary names are not", () => {
  const d = tmp();
  for (const n of ["answer-key.json", "decode.csv", "Unblind.txt", "sheet_key.md"]) write(d, n, "x");
  for (const n of ["monkey.md", "keyboard.md", "notes.md"]) write(d, n, "x");
  const hits = checkKeyNames(d).map((p) => path.basename(p.split(": ")[0]));
  assert.deepEqual(hits.sort(), ["Unblind.txt", "answer-key.json", "decode.csv", "sheet_key.md"].sort());
});

test("checkResearch scans the evidence directory for media and key files, once each", () => {
  const d = tmp();
  const ev = path.join(d, "ev");
  write(ev, "photo.png", "x");
  write(ev, "answer-key.json", { x: 1 });
  assert.equal(checkResearch({ evidence: ev, root: d }).length, 2);
  const ev2 = path.join(tmp(), "ev");
  write(ev2, "clip.mp4", "x");
  assert.equal(checkResearch({ evidence: ev2, root: tmp() }).length, 1);
});
