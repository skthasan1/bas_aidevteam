// Sets up a hub folder for an organization from a config file.
//   node tools/onboard.mjs --config qa-projects.json --target ../my-hub            DRY RUN: prints the plan, writes nothing
//   node tools/onboard.mjs --config qa-projects.json --target ../my-hub --apply    writes the files
//   add --force to overwrite files that already exist (without it, an existing file stops the run before anything is written)
// With --apply it writes ONLY inside the target folder: a copy of templates/hub/*, the config as qa-projects.json,
// one start-up brief per enabled role (briefs/<role>-startup.md, from roles/<role>.md with placeholders filled) and ONBOARDING-TODO.md,
// the list of steps only a person can do. It never creates accounts, never reads or writes a token and never changes repository settings.
// Placeholders filled in templates and role files: {{org}} {{owner_name}} {{owner_handles}} {{role}} {{role_account}} {{projects}} {{repos}}
// and the angle-bracket ones the kit text uses: <org>, <owner> (the owner's name), <hub-path> (the --target path as given), <repo-list>,
// and <role> (start-up briefs only: in the hub layouts <role> is for whoever fills the layout in). Anything the tool cannot know
// (<date>, <reason>, <topic>, <amount>, <worktree-path> ...) is left as it is for a person or session to fill.
// Safety: it refuses a path that resolves (through a symlink) outside the target, JSON-escapes values put into .json files,
// and with --force keeps qa-projects.json.bak when it overwrites an existing qa-projects.json. Yes/no flags accept only true or false.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "./lib/cli.mjs";
import { loadConfig, reposOf } from "./lib/config.mjs";

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEXT_EXT = new Set([".md", ".txt", ".json", ".csv", ".yml", ".yaml", ".html", ".mjs", ".js"]);

function walk(dir, base = dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, base));
    else if (e.isFile()) out.push(path.relative(base, full));
  }
  return out.sort();
}

const jsonEscape = (v) => JSON.stringify(String(v)).slice(1, -1);

// Fills {{name}} from vars and <name> for the known non-empty entries of `angle`. Unknown placeholders stay as they are.
// With json: true the inserted values are JSON-escaped (for text that sits inside a JSON string).
export function fill(text, vars, { angle = {}, json = false } = {}) {
  const esc = json ? jsonEscape : String;
  return text
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k) => (k in vars ? esc(vars[k]) : m))
    .replace(/<([a-z][a-z-]*)>/g, (m, k) => (Object.hasOwn(angle, k) && angle[k] ? esc(angle[k]) : m));
}

// The angle-bracket placeholders onboard knows. <role> is only known for a role's own brief.
export function angleFor(config, role, hubPath) {
  const repos = [...new Set(Object.values(config.projects).flatMap(reposOf))];
  return { org: config.organization, owner: config.owner.name, "hub-path": hubPath, "repo-list": repos.join(", "), ...(role ? { role: role.name } : {}) };
}

function varsFor(config, role) {
  const repos = [...new Set(Object.values(config.projects).flatMap(reposOf))];
  return {
    org: config.organization || "<org>",
    owner_name: config.owner.name || "the owner",
    owner_handles: config.owner.handles.join(", ") || "<owner-handle>",
    role: role?.name ?? "",
    role_account: role?.account || `<${role?.name ?? "role"}-account>`,
    projects: Object.values(config.projects).map((p) => p.name).join(", "),
    repos: repos.join(", "),
  };
}

export function todoText(config) {
  const org = config.organization || "<org>";
  const repos = [...new Set(Object.values(config.projects).flatMap(reposOf))];
  const L = [];
  L.push(`# Onboarding to-do for ${org}`, "", "Purpose: the steps only a person can do. The onboarding tool never creates accounts, never touches tokens and never changes repository settings.", "");
  L.push("## 1. Accounts", "");
  for (const r of config.roles) L.push(`- [ ] Create a separate GitHub account (or GitHub App) for the ${r.name} role${r.account ? ` (planned name: ${r.account})` : ""}. One identity per AI; never share a login.`);
  L.push("- [ ] Add each account to the organization with the least access that works (read for most repos, write only where the role pushes branches).", "");
  L.push("## 2. Tokens and keys", "");
  L.push("- [ ] For each role account, create a fine-grained token limited to the listed repositories. Store it where the role's session reads it (for example the gh CLI login of that machine user). Do not paste a token into any file in this folder or into a chat.");
  L.push("- [ ] Decide who pays for any model or cloud keys, and give each session only its own. Spending needs a named person's yes in the session that will spend.", "");
  L.push("## 3. Repository settings (per repository)", "");
  for (const repo of repos) {
    L.push(`- [ ] ${repo}: protect the default and production branches (pull request required, at least one approval, no force-push, no deletion).`);
    L.push(`- [ ] ${repo}: add the pull request template, issue templates, CODEOWNERS and the baseline CI workflow from templates/repo, then make the checks required once they are green.`);
    L.push(`- [ ] ${repo}: create the labels (priority, area, severity) from templates/repo.`);
  }
  L.push("", "## 4. Projects", "");
  for (const [id, p] of Object.entries(config.projects)) L.push(`- [ ] ${p.name} (${id}): confirm owners (${p.owners.join(", ")}), testing status (${p.testing}) and watch mode (${p.watch}).`);
  L.push("", "## 5. First run", "");
  L.push("- [ ] Install Node 20 or newer and the gh CLI on the machine that runs the watches; sign in as the tech lead's account.");
  L.push("- [ ] Run each watch once with --dry-run, then without it, and read the output together.");
  L.push("- [ ] Open one session per enabled role and paste its start-up brief from briefs/.", "");
  return L.join("\n");
}

// Builds the list of files to write: { rel, content, source }
export function plan({ config, kitRoot = KIT_ROOT, hubPath = "" }) {
  const files = [];
  const warnings = [];
  const tplDir = path.join(kitRoot, "templates", "hub");
  const rootVars = varsFor(config, null);
  const rootAngle = angleFor(config, null, hubPath);
  const tpls = walk(tplDir);
  if (!tpls.length) warnings.push("templates/hub is empty or missing: nothing to copy");
  for (const rel of tpls) {
    if (rel === "qa-projects.json") continue;
    const raw = fs.readFileSync(path.join(tplDir, rel));
    const ext = path.extname(rel).toLowerCase();
    const content = TEXT_EXT.has(ext) ? fill(raw.toString("utf8"), rootVars, { angle: rootAngle, json: ext === ".json" }) : raw;
    files.push({ rel, content, source: `templates/hub/${rel}` });
  }
  const { ai_accounts, bots, ai_comment_prefixes, ...rest } = config;
  files.push({ rel: "qa-projects.json", content: JSON.stringify({ ...rest, roles: config.roles.map((r) => ({ name: r.name, account: r.account })), bots, ai_comment_prefixes, ai_accounts }, null, 2) + "\n", source: "config" });
  for (const role of config.roles) {
    const src = path.join(kitRoot, "roles", `${role.name}.md`);
    if (!fs.existsSync(src)) { warnings.push(`roles/${role.name}.md not found: no start-up brief for ${role.name}`); continue; }
    files.push({ rel: `briefs/${role.name}-startup.md`, content: fill(fs.readFileSync(src, "utf8"), varsFor(config, role), { angle: angleFor(config, role, hubPath) }), source: `roles/${role.name}.md` });
  }
  files.push({ rel: "ONBOARDING-TODO.md", content: todoText(config), source: "generated" });
  const dupes = files.map((f) => f.rel).filter((r, i, a) => a.indexOf(r) !== i);
  if (dupes.length) warnings.push(`duplicate target paths: ${[...new Set(dupes)].join(", ")}`);
  return { files, warnings };
}

const isLink = (p) => { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } };

// realpath of a path that may not exist yet: resolve the nearest existing ancestor, then re-append the missing part.
// A dangling symlink counts as existing, so the write cannot follow it.
function realWithTail(p) {
  let cur = p;
  const tail = [];
  for (;;) {
    try { return path.join(fs.realpathSync(cur), ...tail.reverse()); } catch {
      if (isLink(cur)) return path.join(path.resolve(path.dirname(cur), fs.readlinkSync(cur)), ...tail.reverse());
      const up = path.dirname(cur);
      if (up === cur) return p;
      tail.push(path.basename(cur));
      cur = up;
    }
  }
}

export function onboard({ config, target, apply = false, force = false, kitRoot = KIT_ROOT, log = console.log }) {
  if (!target) throw new Error("--target <hub folder> is required");
  const root = path.resolve(target);
  const { files, warnings } = plan({ config, kitRoot, hubPath: target });
  const realRoot = realWithTail(root);
  const rows = files.map((f) => {
    const dest = path.resolve(root, f.rel);
    if (dest !== root && !dest.startsWith(root + path.sep)) throw new Error(`refusing to write outside the target: ${f.rel}`);
    // A symlink inside the target must not lead the write somewhere else: resolve the real parent and the file itself.
    const realDest = realWithTail(dest);
    if (realDest !== realRoot && !realDest.startsWith(realRoot + path.sep)) throw new Error(`refusing to write outside the target (a symlink leads elsewhere): ${f.rel}`);
    return { ...f, dest, exists: fs.existsSync(dest) || isLink(dest) };
  });
  log(`${apply ? "APPLY" : "DRY RUN"}: target ${root}`);
  for (const w of warnings) log(`warning: ${w}`);
  for (const r of rows) log(`${r.exists ? (force && apply ? "overwrite" : "EXISTS   ") : "create   "} ${r.rel}  (${r.source})`);
  const blocked = rows.filter((r) => r.exists);
  if (blocked.length && !force) {
    log(`\n${blocked.length} file(s) already exist. Nothing ${apply ? "was written" : "would be written"}. Use --force to overwrite them.`);
    return { written: [], blocked: blocked.map((r) => r.rel), warnings };
  }
  if (!apply) { log("\nDry run: nothing written. Add --apply to write these files."); return { written: [], blocked: [], warnings }; }
  const written = [];
  for (const r of rows) {
    fs.mkdirSync(path.dirname(r.dest), { recursive: true });
    if (r.rel === "qa-projects.json" && fs.existsSync(r.dest)) {
      fs.copyFileSync(r.dest, `${r.dest}.bak`);
      log(`kept a copy of the old qa-projects.json as qa-projects.json.bak`);
    }
    fs.writeFileSync(r.dest, r.content);
    written.push(r.rel);
  }
  log(`\nWrote ${written.length} file(s). Next: open ONBOARDING-TODO.md.`);
  return { written, blocked: [], warnings };
}

async function main() {
  let flags;
  try {
    const parsed = parseArgs(process.argv.slice(2), ["apply", "force", "help"]);
    flags = parsed.flags;
    if (parsed.positional.length) throw new Error(`unexpected argument "${parsed.positional[0]}" (yes/no flags take no value except true or false)`);
  } catch (e) { console.error(e.message); process.exitCode = 2; return; }
  if (flags.help) {
    console.log(["Usage: node tools/onboard.mjs --config <file> --target <hub folder> [--apply] [--force]",
      "  --config  your organization config (default: qa-projects.json); start from examples/acme/qa-projects.json",
      "  --target  the hub folder to create",
      "  --apply   write the files (without it: dry run, nothing is written)",
      "  --force   overwrite files that already exist"].join(String.fromCharCode(10)));
    return;
  }
  try {
    const config = loadConfig(typeof flags.config === "string" ? flags.config : "qa-projects.json");
    const res = onboard({ config, target: typeof flags.target === "string" ? flags.target : undefined, apply: !!flags.apply, force: !!flags.force });
    if (res.blocked.length) process.exitCode = 1;
  } catch (e) { console.error(e.message); process.exitCode = 2; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
