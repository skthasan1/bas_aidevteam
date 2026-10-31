// Research check. Node 20+, no dependencies. Fails (exit 1) when:
//   - a judged registry entry has no action line,
//   - a blind evidence spec has no usable review block,
//   - a media file sits in the research folder (media never go into git).
//   node check-research.mjs [--registry research/registry/registry.json] [--evidence <dir of specs>] [--root <research folder>]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRegistry } from "./registry.mjs";
import { reviewProblems } from "./lib/review.mjs";

export const MEDIA_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tif", ".tiff", ".heic", ".mp4", ".webm", ".mov", ".avi", ".mkv", ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"]);

function walk(dir, files = []) {
  if (!dir || !fs.existsSync(dir)) return files;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}

export function checkRegistry(file) {
  if (!file || !fs.existsSync(file)) return [];
  const problems = [];
  let reg;
  try { reg = loadRegistry(file); } catch (err) { return [`${file}: ${err.message}`]; }
  for (const t of reg.tests) {
    const action = typeof t.action === "string" ? t.action.trim() : "";
    if (t.status === "judged" && !action) problems.push(`${file}: ${t.id} is judged but has no action line (issue reference or "no action: <reason>")`);
  }
  return problems;
}

export function checkEvidence(dir) {
  const problems = [];
  for (const f of walk(dir).filter((x) => x.endsWith(".json"))) {
    let spec;
    try { spec = JSON.parse(fs.readFileSync(f, "utf8")); } catch { problems.push(`${f}: not valid JSON`); continue; }
    if (spec && spec.blind !== undefined && typeof spec.blind !== "boolean") {
      problems.push(`${f}: "blind" must be true or false, not ${JSON.stringify(spec.blind)}`);
      continue;
    }
    if (spec && spec.blind === true) {
      for (const p of reviewProblems(spec)) problems.push(`${f}: blind spec: ${p}`);
    }
  }
  return problems;
}

export function checkMedia(root) {
  return walk(root)
    .filter((f) => MEDIA_EXT.has(path.extname(f).toLowerCase()))
    .map((f) => `${f}: media file in the research folder (media never go into git)`);
}

const KEY_WORDS = new Set(["key", "answerkey", "decode", "unblind"]);

// A file whose name looks like a blind key (answer-key.json, decode.csv, unblind.txt) must not sit next to a blind sheet.
export function checkKeyNames(dir) {
  return walk(dir)
    .filter((f) => {
      const stem = path.basename(f).toLowerCase().replace(/\.[a-z0-9]+$/, "");
      return stem.split(/[^a-z]+/).some((t) => KEY_WORDS.has(t)) || KEY_WORDS.has(stem.replace(/[^a-z]/g, ""));
    })
    .map((f) => `${f}: file name looks like a blind key (keep keys outside the repository and outside the review folder)`);
}

export function checkResearch({ registry, evidence, root }) {
  return [...new Set([
    ...checkRegistry(registry), ...checkEvidence(evidence),
    ...checkMedia(root), ...checkMedia(evidence),
    ...checkKeyNames(root), ...checkKeyNames(evidence),
  ])];
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = arg("root") || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const problems = checkResearch({ registry: arg("registry"), evidence: arg("evidence"), root });
  if (problems.length) {
    problems.forEach((p) => console.error(`FAIL ${p}`));
    process.exit(1);
  }
  console.log("research check: ok");
}
