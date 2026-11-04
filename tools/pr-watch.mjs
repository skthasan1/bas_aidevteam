// Lists the pull requests of each watched project that are NEW or CHANGED (a new head commit) since the last run, so the reviewer looks only at what moved.
//   node tools/pr-watch.mjs [project] [--config qa-projects.json] [--state-dir .state] [--all] [--dry-run] [--no-save]
// Read-only: it only runs "gh pr list". It never reviews, approves or merges. State: <state-dir>/pr-watch-<project>.json (head commit of every PR already seen).
// Pull requests by dependency bots (and titles matching config.pr_watch.skip_titles) are listed apart as "not reviewed here".
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "./lib/cli.mjs";
import { loadConfig, selectProjects, reposOf } from "./lib/config.mjs";
import { createGh } from "./lib/gh.mjs";
import { readState, writeState } from "./lib/state.mjs";
import { compileAreas, t3Status, T3_HINT } from "./lib/t3.mjs";
import { securityLoginOf } from "./t3-check.mjs";

const FIELDS = "number,title,author,baseRefName,isDraft,headRefOid,additions,deletions,url,statusCheckRollup";

const RED = new Set(["FAILURE", "ERROR", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE"]);
const NEUTRAL = new Set(["SKIPPED", "NEUTRAL"]);

// A check run has conclusion/status; a commit status context has "state". Anything not yet finished is "pending".
export function checksOf(p) {
  const c = (p.statusCheckRollup || []).map((x) => String(x.conclusion || x.status || x.state || "").toUpperCase());
  if (!c.length) return "none";
  if (c.some((x) => RED.has(x))) return "RED";
  return c.every((x) => x === "SUCCESS" || NEUTRAL.has(x)) ? "green" : "pending";
}

// Exact match only: "[bot]" account names, a configured bot login, or gh's own is_bot flag. Never a substring ("dependabotfan" is a person).
export function isBotAuthor(author, names) {
  const login = String(author?.login ?? "").toLowerCase();
  if (!login) return false;
  return author?.is_bot === true || login.endsWith("[bot]") || names.has(login) || names.has(login.replace(/^app\//, ""));
}

export function prWatch({ config, projectId, gh, stateDir = ".state", all = false, save = true }) {
  const skipAuthors = new Set([...(config.pr_watch?.skip_authors ?? ["dependabot", "renovate"]), ...(config.bots ?? [])].map((s) => s.toLowerCase()));
  const skipTitles = (config.pr_watch?.skip_titles ?? []).map((s) => new RegExp(s, "i"));
  const result = { fresh: [], other: [], errors: [], skipped: [] };
  for (const [id, project] of selectProjects(config, projectId)) {
    if (project.watch === "off") { result.skipped.push(`${id}: watch is off`); continue; }
    const file = `pr-watch-${id}`;
    const seen = readState(stateDir, file);
    const next = {};
    for (const repo of reposOf(project)) {
      let list;
      try { list = gh.json(["pr", "list", "-R", repo, "--state", "open", "--limit", "100", "--json", FIELDS]) ?? []; }
      catch (e) { result.errors.push(`${repo}: ${e.message}`); for (const k of Object.keys(seen)) if (k.startsWith(`${repo}#`)) next[k] = seen[k]; continue; }
      for (const p of list) {
        const key = `${repo}#${p.number}`;
        // A draft is remembered as "draft:<sha>", not as seen: marking it ready with the same head shows it again (READY).
        next[key] = p.isDraft ? `draft:${p.headRefOid}` : p.headRefOid;
        const author = p.author?.login ?? "?";
        const line = `${key} [${p.baseRefName}] ${author}${p.isDraft ? " DRAFT" : ""} +${p.additions}/-${p.deletions} checks:${checksOf(p)} :: ${String(p.title).slice(0, 90)}  ${p.url}`;
        if (isBotAuthor(p.author, skipAuthors) || skipTitles.some((r) => r.test(p.title))) { result.other.push(line); continue; }
        const state = !(key in seen) ? "NEW" : seen[key] === next[key] ? "seen" : seen[key] === `draft:${p.headRefOid}` ? "READY" : "CHANGED";
        let t3 = "";
        // Opt in with config.security_read.enabled: a new or changed pull request in a security area is tagged with where the security read stands for its head.
        if ((all || state !== "seen") && config.security_read?.enabled === true) {
          try {
            const login = securityLoginOf(config);
            const s = login ? t3Status({ gh, repo, number: p.number, headSha: p.headRefOid, securityLogin: login, areas: compileAreas(config.security_read.areas ?? {}) }) : null;
            if (s && s.status !== "NOT_T3") t3 = `security areas [${s.areas.join(", ")}], security read: ${s.status} (${T3_HINT[s.status]})`;
          } catch (e) { result.errors.push(`${key}: security-read check failed: ${e.message}`); }
        }
        if (all || state !== "seen") result.fresh.push({ project: id, state, line, ...(t3 ? { t3 } : {}) });
      }
    }
    if (save && !gh.dryRun) writeState(stateDir, file, next);
  }
  return result;
}

export function formatPrWatch(r) {
  const out = [];
  out.push(r.fresh.length ? `${r.fresh.length} pull request(s) to review:\n${r.fresh.map((f) => `${f.state.padEnd(7)} ${f.line}${f.t3 ? `\n        ${f.t3}` : ""}`).join("\n")}` : "No new or changed pull requests.");
  if (r.other.length) out.push(`\nNot reviewed here (dependency bots and skipped titles): ${r.other.length}`);
  for (const s of r.skipped) out.push(`skipped ${s}`);
  for (const e of r.errors) out.push(`ERROR ${e}`);
  return out.join("\n");
}

async function main() {
  try {
    const { positional, flags } = parseArgs(process.argv.slice(2), ["all", "dry-run", "no-save"]);
    const config = loadConfig(flags.config || "qa-projects.json");
    const gh = createGh({ dryRun: !!flags["dry-run"] });
    const r = prWatch({ config, projectId: positional[0], gh, stateDir: flags["state-dir"] || ".state", all: !!flags.all, save: !flags["no-save"] });
    console.log(formatPrWatch(r));
    if (r.errors.length) process.exitCode = 1;
  } catch (e) { console.error(e.message); process.exitCode = 2; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
