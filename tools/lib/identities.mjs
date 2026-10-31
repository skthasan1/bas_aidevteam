// AI identities: the GitHub App permission set for each role, as data, and the request a person fills in when creating the App.
// Rules that never bend: no Administration, Secrets, Environments or Packages, and no organization or account permission, for any role.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { reposOf } from "./config.mjs";
import { effectiveWorkers, roleIn } from "./policy.mjs";

const lower = (s) => String(s).toLowerCase();

// Permissions every role gets.
const BASE = [{ name: "Metadata", level: "read" }];
const rw = (name, level) => ({ name, level });
const CHECKS = [rw("Checks", "read"), rw("Commit statuses", "read"), rw("Actions", "read")];

export const PERMISSIONS = {
  "tech-lead": [rw("Contents", "read"), rw("Pull requests", "write"), rw("Issues", "write"), ...CHECKS],
  "ai-developer": [rw("Contents", "write"), rw("Pull requests", "write"), rw("Issues", "write"), ...CHECKS],
  "qa-lead": [rw("Contents", "read"), rw("Pull requests", "write"), rw("Issues", "write"), ...CHECKS],
  // Audit results go to the security repository by pull request.
  "security-lead": [rw("Contents", "write"), rw("Pull requests", "write"), rw("Issues", "write"), ...CHECKS],
  // Research results go to the research repository by pull request.
  researcher: [rw("Contents", "write"), rw("Pull requests", "write"), rw("Issues", "write")],
};

// Optional extras, with the condition under which a person may add them.
export const OPTIONAL = {
  "ai-developer": [{ name: "Workflows", level: "write", when: "only if it edits CI files, then every CI change is a pull request a person reads" }],
};

// Why a role has the write it has, so the request can say it.
export const WHY = {
  "ai-developer": "pushes branches for its pull requests",
  "security-lead": "audit results go to the security repository by pull request",
  researcher: "research results go to the research repository by pull request",
};

// Never requested, for any role.
export const NEVER = ["Administration", "Secrets", "Environments", "Packages", "any organization permission", "any account permission"];

// Roles that also work in a repository outside the projects' own repositories.
const EXTRA_REPO = { "security-lead": "the security repository", researcher: "the research repository" };

// The projects (as [id, project]) a worker's person owns or belongs to. A worker with no person belongs to the whole organization.
export function projectsOfWorker(config, worker) {
  const all = Object.entries(config.projects);
  return worker.person ? all.filter(([, p]) => roleIn(p, worker.person) !== "none") : all;
}

// Does some project this worker leads allow a lead to merge? Then a tech lead needs Contents write.
export const leadsWithMerge = (worker, projects) => projects.some((p) => worker.account && p.lead && lower(p.lead) === lower(worker.account) && p.merge && p.merge !== "owner-only");

// What to ask for when creating a worker's GitHub App. `projects` are project objects (not pairs).
export function appRequestFor(worker, projects = [], org = "") {
  const role = worker.name ?? worker.role;
  if (!PERMISSIONS[role]) throw new Error(`unknown role "${role}"`);
  let perms = PERMISSIONS[role].map((p) => ({ ...p }));
  const notes = [];
  if (WHY[role]) notes.push(`Contents write: ${WHY[role]}.`);
  if (role === "tech-lead" && leadsWithMerge(worker, projects)) {
    perms = perms.map((p) => (p.name === "Contents" ? { ...p, level: "write" } : p));
    notes.push("Contents write: a project this lead leads lets it merge (lead-after-conditions or lead-on-owner-word). Branch protection and the merge rules still apply.");
  }
  const repos = [...new Set(projects.flatMap((p) => reposOf(p)))];
  const owners = new Set(repos.map((r) => lower(r.split("/")[0])));
  const baseName = `${org ? lower(org) : "<org>"}-ai-${role}`;
  const appName = worker.sameRole > 1 ? `${baseName}-${lower(worker.person || "x")}-${(worker.index ?? 0) + 1}` : baseName;
  if (appName.length > 34) notes.push(`The suggested name is ${appName.length} characters; GitHub allows 34, so shorten it.`);
  if (EXTRA_REPO[role]) notes.push(`Also select ${EXTRA_REPO[role]}.`);
  return {
    role,
    appName,
    description: `${role} AI worker${worker.person ? ` for ${worker.person}` : ""}${org ? ` at ${org}` : ""}. Acts only as this App; every comment is signed.`,
    permissions: [...BASE, ...perms],
    optional: (OPTIONAL[role] ?? []).map((p) => ({ ...p })),
    never: NEVER,
    repos,
    // Any account when the repositories sit under more than one owner (a personal account and an organization), else only this account.
    installOn: owners.size > 1 ? "Any account" : "Only on this account",
    notes,
  };
}

// The nearest folder that exists, as its real path, starting at the key file itself or its parent; null when neither exists.
function realStart(file) {
  for (const p of [file, path.dirname(file)]) { try { return fs.realpathSync(p); } catch { /* try the parent */ } }
  return null;
}
const inside = (child, parent) => { const r = path.relative(parent, child); return r === "" || (!r.startsWith("..") && !path.isAbsolute(r)); };

// Where each worker's App key file sits, and (with checkKeys) whether it exists and who can read it. Never reads the key.
// A key must stay outside every git repository and outside the hub and config folders, which are meant to be shared or committed.
export function checkKeyFiles(config, { configDir = "", hub = "", checkKeys = false, platform = process.platform, statImpl = fs.statSync, home = os.homedir() } = {}) {
  const errors = [];
  const warnings = [];
  const walls = [configDir, hub].filter(Boolean).map((d) => { try { return fs.realpathSync(path.resolve(d)); } catch { return path.resolve(d); } });
  for (const w of effectiveWorkers(config)) {
    if (!w.app || !w.app.key_file) continue;
    const file = resolveKeyPath(w.app.key_file, home);
    const start = realStart(file);
    if (start) {
      const real = fs.existsSync(file) ? start : path.join(start, path.basename(file));
      for (let dir = path.dirname(real); ; dir = path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, ".git"))) { errors.push(`${w.at}.app.key_file is inside a git repository (${dir}); keep the key outside every repository`); break; }
        if (path.dirname(dir) === dir) break;
      }
      for (const wall of walls) if (inside(real, wall)) { errors.push(`${w.at}.app.key_file is inside the hub or config folder (${wall}); keep the key outside it`); break; }
    }
    if (checkKeys) {
      let st;
      try { st = statImpl(file); } catch { errors.push(`${w.at}.app.key_file does not exist or cannot be read: ${file}`); continue; }
      if (platform !== "win32") {
        if (st.mode & 0o004) errors.push(`${w.at}.app.key_file is readable by every user on this machine; run chmod 600 on it`);
        else if (st.mode & 0o040) warnings.push(`${w.at}.app.key_file is readable by its group; chmod 600 is safer`);
      }
    }
  }
  return { errors, warnings };
}

// The path of a key file as the tools use it: "~/" means the home folder; the result is absolute.
export function resolveKeyPath(file, home = os.homedir()) {
  const f = String(file);
  return path.resolve(f === "~" || f.startsWith("~/") || f.startsWith("~\\") ? path.join(home, f.slice(1)) : f);
}
