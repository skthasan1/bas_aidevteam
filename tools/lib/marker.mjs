// The version marker a hub carries, so a later kit release can tell what the hub was built from.
//   .bas-aidevteam-version          the kit VERSION the hub was set up (or last upgraded) with
//   .bas-aidevteam-manifest.json    kit template file (relative path) -> sha256 of the content as written
// Used by onboard (writes them), upgrade (reads and refreshes them) and doctor (warns when they are missing or old).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const MARKER_FILE = ".bas-aidevteam-version";
export const MANIFEST_FILE = ".bas-aidevteam-manifest.json";

// Manifest keys always use forward slashes, so a hub made on Windows reads the same everywhere.
export const slash = (rel) => rel.split(path.sep).join("/");

export const sha256 = (content) => crypto.createHash("sha256").update(content).digest("hex");

// "1.2.3" -> [1, 2, 3]; anything else -> null.
export function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v ?? "").trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// -1, 0 or 1; both arguments must be valid versions.
export function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) throw new Error(`cannot compare versions "${a}" and "${b}"`);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

// The kit's VERSION file, or null when it is missing.
export function readKitVersion(kitRoot) {
  try { return fs.readFileSync(path.join(kitRoot, "VERSION"), "utf8").trim() || null; } catch { return null; }
}

// Manifest of the kit template files in a plan: relative path -> sha256 of the content as it will be written.
export function buildManifest(files) {
  const out = {};
  for (const f of [...files].filter((x) => x.source.startsWith("templates/hub/")).sort((a, b) => (a.rel < b.rel ? -1 : 1))) {
    out[slash(f.rel)] = sha256(typeof f.content === "string" ? Buffer.from(f.content) : f.content);
  }
  return out;
}

export const manifestText = (manifest) => JSON.stringify(manifest, null, 2) + "\n";

// Reads the marker of a hub folder. Never throws on a missing or damaged marker: the problem is returned as text.
export function readMarker(hubRoot) {
  const res = { version: null, manifest: null, problems: [] };
  const vf = path.join(hubRoot, MARKER_FILE), mf = path.join(hubRoot, MANIFEST_FILE);
  if (!fs.existsSync(vf)) res.problems.push(`${MARKER_FILE} not found`);
  else {
    const v = fs.readFileSync(vf, "utf8").trim();
    if (parseVersion(v)) res.version = v;
    else res.problems.push(`${MARKER_FILE} does not hold a version like 1.2.3`);
  }
  if (!fs.existsSync(mf)) res.problems.push(`${MANIFEST_FILE} not found`);
  else {
    try {
      const m = JSON.parse(fs.readFileSync(mf, "utf8"));
      if (!m || typeof m !== "object" || Array.isArray(m)) throw new Error("not an object");
      for (const [k, h] of Object.entries(m)) if (typeof h !== "string" || !/^[0-9a-f]{64}$/.test(h)) throw new Error(`bad hash for ${k}`);
      res.manifest = m;
    } catch (e) { res.problems.push(`${MANIFEST_FILE} is damaged (${e.message})`); }
  }
  return res;
}

// The released sections of a changelog: [{ version, text }] in file order. An "Unreleased" section is not a release and is skipped.
export function changelogSections(text) {
  const parts = String(text).split(/^(?=## )/m);
  const out = [];
  for (const p of parts) {
    const m = /^## (\d+\.\d+\.\d+)\b/.exec(p);
    if (m) out.push({ version: m[1], text: p.trimEnd() });
  }
  return out;
}

// What doctor says about a hub folder. { errors, warnings }.
export function checkHub(hub, kitVersion) {
  const errors = [], warnings = [];
  const root = path.resolve(hub);
  let st = null;
  try { st = fs.statSync(root); } catch { /* reported below */ }
  if (!st || !st.isDirectory()) { errors.push(`hub folder not found: ${hub}`); return { errors, warnings }; }
  const m = readMarker(root);
  if (!m.version) {
    warnings.push(`hub ${hub} has no usable version marker (${m.problems.join("; ")}): it was set up before the kit tracked versions, so tools/upgrade.mjs cannot tell what changed`);
  } else if (kitVersion && parseVersion(kitVersion) && compareVersions(m.version, kitVersion) < 0) {
    warnings.push(`hub ${hub} was set up with kit ${m.version}; this kit is ${kitVersion}. Preview the changes with: node tools/upgrade.mjs --hub ${hub}`);
  }
  if (m.version && !m.manifest) warnings.push(`hub ${hub}: ${m.problems.join("; ")}: upgrade cannot tell which files you edited`);
  return { errors, warnings };
}
