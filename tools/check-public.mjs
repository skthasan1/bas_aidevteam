// Scans a folder before it is published and fails (exit 1) if it finds anything that should not be public:
// token patterns, private key blocks, e-mail addresses, local absolute paths, issue or pull request numbers (like "#" plus digits) outside code fences marked as examples,
// and any word on a deny list (private names).
//   node tools/check-public.mjs [folder] [--denylist path/to/list.json]
// Deny list: JSON {"terms": ["Name", ...]}, whole words, case-insensitive. Without --denylist it reads tools/public-denylist.json if present (git-ignored),
// otherwise tools/public-denylist.example.json (generic placeholders only). Keep the real list OUT of the published tree.
// Issue references: write examples inside a fenced block whose first line is ```example to allow them.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "./lib/cli.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKIP_DIRS = new Set([".git", "node_modules", ".private", ".state", ".watch"]);
const SKIP_FILES = new Set(["public-denylist.json"]);
const BINARY_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", ".gz", ".woff", ".woff2", ".ttf", ".mp4", ".webp"]);
const ISSUE_EXT = new Set([".md", ".txt", ".csv"]);
const SAFE_EMAIL_DOMAINS = ["example.com", "example.org", "example.net", "users.noreply.github.com"];

const PEM = "-----BEGIN ";
export const PATTERNS = [
  { id: "token", re: /\bghp_[A-Za-z0-9]{20,}/, why: "GitHub token" },
  { id: "token", re: /\bgithub_pat_[A-Za-z0-9_]{20,}/, why: "GitHub fine-grained token" },
  { id: "token", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/, why: "AWS access key id" },
  { id: "token", re: /\bsk-[A-Za-z0-9_-]{20,}/, why: "API key (sk- prefix)" },
  { id: "token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/, why: "Slack token" },
  { id: "private-key", re: new RegExp(`${PEM}(?:[A-Z]+ )*PRIVATE KEY-----`), why: "private key block" },
  { id: "local-path", re: /\b[A-Za-z]:\\(?:Users|Documents and Settings)\\[^\s\\]+/, why: "Windows local path" },
  { id: "local-path", re: /(?:^|[\s"'`(=])\/(?:Users|home)\/[A-Za-z0-9._-]+\//, why: "local home path" },
];
const EMAIL_RE = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g;
const ISSUE_RE = /(?<![\w&/])#\d{1,5}\b/;

export function loadDenylist(file) {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const terms = Array.isArray(raw) ? raw : raw.terms;
  if (!Array.isArray(terms) || !terms.every((t) => typeof t === "string")) throw new Error(`deny list ${file}: expected {"terms": [strings]}`);
  return terms.filter(Boolean);
}

// Phrases that may appear even though they contain a deny-listed word, e.g. the licence attribution line. JSON key "allowPhrases".
export function loadAllowPhrases(file) {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const a = Array.isArray(raw) ? [] : raw.allowPhrases;
  return Array.isArray(a) ? a.filter((s) => typeof s === "string" && s) : [];
}

export function defaultDenylistPath() {
  const real = path.join(HERE, "public-denylist.json");
  return fs.existsSync(real) ? real : path.join(HERE, "public-denylist.example.json");
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Scan one text; returns [{line, rule, detail}]
export function scanText(text, { ext = ".md", terms = [], allow = [] } = {}) {
  const findings = [];
  const termRes = terms.map((t) => ({ t, re: new RegExp(`(?<![A-Za-z0-9_])${escapeRe(t)}(?![A-Za-z0-9_])`, "i") }));
  const lines = text.split(/\r?\n/);
  let fence = null; // null | "example" | "code"
  lines.forEach((line, i) => {
    const n = i + 1;
    const f = /^\s*```(.*)$/.exec(line);
    if (f) { fence = fence ? null : (/example/i.test(f[1]) ? "example" : "code"); }
    for (const p of PATTERNS) if (p.re.test(line)) findings.push({ line: n, rule: p.id, detail: p.why });
    for (const m of line.matchAll(EMAIL_RE)) {
      const domain = m[1].toLowerCase();
      if (!SAFE_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) findings.push({ line: n, rule: "email", detail: "e-mail address" });
    }
    if (ISSUE_EXT.has(ext) && fence !== "example" && !f && ISSUE_RE.test(line)) findings.push({ line: n, rule: "issue-ref", detail: "issue or pull request number" });
    const termLine = allow.reduce((s, ph) => s.split(ph).join(" "), line);
    for (const { t, re } of termRes) if (re.test(termLine)) findings.push({ line: n, rule: "denylist", detail: `deny-listed word "${t}"` });
  });
  return findings;
}

function* files(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) yield* files(full); }
    else if (e.isFile() && !SKIP_FILES.has(e.name) && !e.name.startsWith("public-denylist")) yield full;
  }
}

export function scanFolder(folder, { terms = [], allow = [] } = {}) {
  const root = path.resolve(folder);
  const out = [];
  for (const file of files(root)) {
    const ext = path.extname(file).toLowerCase();
    if (BINARY_EXT.has(ext)) continue;
    const buf = fs.readFileSync(file);
    if (buf.includes(0)) continue;
    const rel = path.relative(root, file).split(path.sep).join("/");
    // the file name itself is part of what gets published
    for (const f of scanText(rel, { ext: "", terms, allow })) if (f.rule === "denylist") out.push({ file: rel, line: 0, rule: "denylist", detail: `${f.detail} (in file name)` });
    for (const f of scanText(buf.toString("utf8"), { ext, terms, allow })) out.push({ file: rel, ...f });
  }
  return out;
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  try {
    const folder = positional[0] || ".";
    if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) throw new Error(`not a folder: ${folder}`);
    const listPath = typeof flags.denylist === "string" ? flags.denylist : defaultDenylistPath();
    const terms = loadDenylist(listPath);
    const found = scanFolder(folder, { terms, allow: loadAllowPhrases(listPath) });
    for (const f of found) console.log(`${f.file}:${f.line}  ${f.rule}  ${f.detail}`);
    console.log(found.length ? `\nFAIL: ${found.length} finding(s). Deny list: ${path.basename(listPath)} (${terms.length} terms).` : `OK: nothing found in ${path.resolve(folder)}. Deny list: ${path.basename(listPath)} (${terms.length} terms).`);
    process.exitCode = found.length ? 1 : 0;
  } catch (e) { console.error(e.message); process.exitCode = 2; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
