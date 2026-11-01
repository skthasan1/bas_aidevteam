// Brings an existing hub up to this kit's version without losing the person's own edits.
//   node tools/upgrade.mjs --hub ../my-hub             DRY RUN: prints what changed in the kit and what would happen to each file
//   node tools/upgrade.mjs --hub ../my-hub --apply     updates the safe files, writes <name>.kit-new next to edited ones
//   add --force to overwrite a <name>.kit-new that already exists, or to run with a hub marked newer than this kit
// Per kit template file: unchanged / updated in kit (hub copy untouched by you: safe to update) / edited in your hub
// (its hash differs from the manifest: NEVER overwritten, the kit's new text goes to <name>.kit-new) / new in kit / removed in kit
// (never deleted: you decide). It never touches qa-projects.json, briefs, notes, queue, briefings or runs, writes only inside the
// hub (realpath containment check like onboard) and reads no secret. Afterwards run doctor, as you would run an audit after an upgrade.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "./lib/cli.mjs";
import { loadConfig } from "./lib/config.mjs";
import { MARKER_FILE, MANIFEST_FILE, changelogSections, compareVersions, manifestText, parseVersion, readKitVersion, readMarker, sha256, slash } from "./lib/marker.mjs";
import { plan, realWithTail } from "./onboard.mjs";

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEW_SUFFIX = ".kit-new";

// A short hint about where two text files first differ.
export function diffHint(hubText, kitText) {
  const a = hubText.split(/\r?\n/), b = kitText.split(/\r?\n/);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const cut = (s) => (s === undefined ? "(end of file)" : s.length > 70 ? s.slice(0, 67) + "..." : s);
  return `yours has ${a.length} lines, the kit ${b.length}; first difference at line ${i + 1}: yours "${cut(a[i])}" / kit "${cut(b[i])}"`;
}

export function upgrade({ hub, apply = false, force = false, config: configFile, kitRoot = KIT_ROOT, log = console.log }) {
  if (!hub) throw new Error("--hub <hub folder> is required");
  const root = path.resolve(hub);
  let st = null;
  try { st = fs.statSync(root); } catch { /* reported below */ }
  if (!st || !st.isDirectory()) throw new Error(`hub folder not found: ${hub}`);
  const realRoot = realWithTail(root);
  // Every path read or written must stay inside the hub, also through a symlink.
  const inside = (rel) => {
    const dest = path.resolve(root, rel);
    if (dest !== root && !dest.startsWith(root + path.sep)) throw new Error(`refusing to touch a path outside the hub: ${rel}`);
    const real = realWithTail(dest);
    if (real !== realRoot && !real.startsWith(realRoot + path.sep)) throw new Error(`refusing to touch a path outside the hub (a symlink leads elsewhere): ${rel}`);
    return dest;
  };

  const marker = readMarker(root);
  if (!marker.version || !marker.manifest) {
    throw new Error(`${hub} is not a hub this tool can upgrade: ${marker.problems.join("; ")}. A hub made before version tracking has no marker: run onboard into a new folder and copy your own files across.`);
  }
  const kitVersion = readKitVersion(kitRoot);
  if (!kitVersion || !parseVersion(kitVersion)) throw new Error("the kit has no valid VERSION file");
  const order = compareVersions(marker.version, kitVersion);
  if (order > 0 && !force) throw new Error(`the hub is marked ${marker.version}, newer than this kit (${kitVersion}). Update the kit first, or use --force.`);

  let config;
  const configPath = configFile ? path.resolve(configFile) : inside("qa-projects.json");
  try { config = loadConfig(configPath); } catch (e) { throw new Error(`cannot read the hub's config ${configPath} (${e.message}): the kit text is filled in from it. If your config is not <hub>/qa-projects.json, pass --config <file>.`); }
  const kitFiles = new Map();
  for (const f of plan({ config, kitRoot, hubPath: hub }).files) {
    if (f.source.startsWith("templates/hub/")) kitFiles.set(slash(f.rel), { content: f.content, hash: sha256(typeof f.content === "string" ? Buffer.from(f.content) : f.content) });
  }

  log(`${apply ? "APPLY" : "DRY RUN"}: hub ${root}`);
  log(`Installed kit version: ${marker.version}`);
  log(`Available kit version: ${kitVersion}`);
  const sections = order < 0 ? changelogSections(fs.existsSync(path.join(kitRoot, "CHANGELOG.md")) ? fs.readFileSync(path.join(kitRoot, "CHANGELOG.md"), "utf8") : "").filter((s) => compareVersions(s.version, marker.version) > 0 && compareVersions(s.version, kitVersion) <= 0) : [];
  if (sections.length) { log("\nChanges since your version:\n"); for (const s of sections) log(s.text + "\n"); }
  else log(order === 0 ? "\nSame version: only template text changed since you set up (if anything) is listed below." : "\nNo newer changelog sections.");

  const rows = []; // { rel, status, note, write?: "file" | "kit-new", content }
  const newManifest = { ...marker.manifest };
  const read = (rel) => { const p = inside(rel); return fs.existsSync(p) ? fs.readFileSync(p) : null; };
  for (const [rel, k] of [...kitFiles].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const recorded = marker.manifest[rel];
    const have = read(rel);
    const haveHash = have ? sha256(have) : null;
    if (recorded === undefined) {
      if (!have) rows.push({ rel, status: "new in kit", note: "will be created", write: "file", content: k.content });
      else if (haveHash === k.hash) { rows.push({ rel, status: "unchanged", note: "you already have this file" }); newManifest[rel] = k.hash; }
      else rows.push({ rel, status: "new in kit", note: `a file of that name already exists in your hub; the kit's version goes to ${rel}${NEW_SUFFIX}`, write: "kit-new", content: k.content, hint: diffHint(have.toString("utf8"), String(k.content)) });
    } else if (!have) {
      rows.push({ rel, status: "deleted in your hub", note: "you removed it; left alone" });
    } else if (haveHash === k.hash) {
      rows.push({ rel, status: "unchanged", note: haveHash === recorded ? "" : "your edit already matches the kit" });
      newManifest[rel] = k.hash;
    } else if (haveHash === recorded) {
      rows.push({ rel, status: "updated in kit", note: "your copy is untouched: safe to update", write: "file", content: k.content });
    } else if (k.hash === recorded) {
      rows.push({ rel, status: "edited in your hub", note: "the kit text did not change, nothing to merge" });
    } else {
      rows.push({ rel, status: "edited in your hub", note: `kept as it is; the kit's new text goes to ${rel}${NEW_SUFFIX}`, write: "kit-new", content: k.content, hint: diffHint(have.toString("utf8"), String(k.content)) });
    }
  }
  for (const rel of Object.keys(marker.manifest).sort()) {
    if (!kitFiles.has(rel)) { rows.push({ rel, status: "removed in kit", note: "the kit no longer ships it; your copy stays, delete it yourself if you do not need it" }); delete newManifest[rel]; }
  }
  for (const r of rows) {
    log(`${r.status.padEnd(20)} ${r.rel}${r.note ? "  - " + r.note : ""}`);
    if (r.hint) log(`${"".padEnd(21)}${r.hint}`);
  }

  // Check every path we would write before writing anything.
  for (const r of rows) if (r.write) inside(r.write === "kit-new" ? r.rel + NEW_SUFFIX : r.rel);
  for (const f of [MARKER_FILE, MANIFEST_FILE]) inside(f);
  const blocked = rows.filter((r) => r.write === "kit-new" && fs.existsSync(inside(r.rel + NEW_SUFFIX)));
  if (blocked.length && !force) {
    const names = blocked.map((r) => r.rel + NEW_SUFFIX).join(", ");
    if (apply) throw new Error(`${names} already exist${blocked.length === 1 ? "s" : ""} from an earlier upgrade. Merge or delete ${blocked.length === 1 ? "it" : "them"}, or use --force to overwrite. Nothing was written.`);
    log(`\nwarning: ${names} already exist; --apply would stop unless you merge or delete them, or add --force.`);
  }
  if (!apply) {
    log("\nDry run: nothing written. Add --apply to update the safe files and write .kit-new files for the edited ones.");
    return { rows, written: [] };
  }

  const written = [];
  const put = (rel, content) => { const p = inside(rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); written.push(rel); };
  for (const r of rows) {
    if (r.write === "file") { put(r.rel, r.content); newManifest[r.rel] = kitFiles.get(r.rel).hash; }
    else if (r.write === "kit-new") put(r.rel + NEW_SUFFIX, r.content);
  }
  const sorted = Object.fromEntries(Object.entries(newManifest).sort((a, b) => (a[0] < b[0] ? -1 : 1)));
  put(MANIFEST_FILE, manifestText(sorted));
  put(MARKER_FILE, `${kitVersion}\n`);
  const kn = rows.filter((r) => r.write === "kit-new").length;
  log(`\nWrote ${written.length} file(s); the hub is now marked ${kitVersion}.${kn ? ` ${kn} file(s) of yours were kept: compare each with its ${NEW_SUFFIX} copy, merge what you want, then delete the ${NEW_SUFFIX} file.` : ""}`);
  log(`Next: run  node tools/doctor.mjs --config ${configPath} --hub ${hub}  to check the setup after the upgrade.`);
  return { rows, written };
}

function main() {
  let flags;
  try {
    const parsed = parseArgs(process.argv.slice(2), ["apply", "force", "help"]);
    flags = parsed.flags;
    if (parsed.positional.length) throw new Error(`unexpected argument "${parsed.positional[0]}" (yes/no flags take no value except true or false)`);
  } catch (e) { console.error(e.message); process.exitCode = 2; return; }
  if (flags.help) {
    console.log(["Usage: node tools/upgrade.mjs --hub <hub folder> [--config <file>] [--apply] [--force]",
      "  --config your organization config, if it is not <hub>/qa-projects.json (read only)",
      "  --hub    the hub folder made by onboard (it must hold .bas-aidevteam-version)",
      "  --apply  update the safe files and write .kit-new files (without it: dry run, nothing is written)",
      "  --force  overwrite an existing .kit-new file, or upgrade a hub marked newer than this kit",
      "A file you edited is never overwritten. qa-projects.json and your notes, queue, briefings and runs are never touched."].join(String.fromCharCode(10)));
    return;
  }
  try { upgrade({ hub: typeof flags.hub === "string" ? flags.hub : undefined, config: typeof flags.config === "string" ? flags.config : undefined, apply: !!flags.apply, force: !!flags.force }); } catch (e) { console.error(e.message); process.exitCode = 2; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
