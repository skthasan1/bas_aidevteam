import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { checkRegistry, checkEvidence, checkMedia, checkResearch } from "../tools/check-research.mjs";

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
