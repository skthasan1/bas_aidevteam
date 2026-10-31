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

const FIELDS = "number,title,author,baseRefName,isDraft,headRefOid,additions,deletions,url,statusCheckRollup";

function checksOf(p) {
  const c = (p.statusCheckRollup || []).map((x) => x.conclusion || x.status);
  if (!c.length) return "none";
  if (c.some((x) => x === "FAILURE")) return "RED";
  return c.every((x) => x === "SUCCESS" || x === "NEUTRAL") ? "green" : "pending";
}

export function prWatch({ config, projectId, gh, stateDir = ".state", all = false, save = true }) {
  const skipAuthors = (config.pr_watch?.skip_authors ?? ["dependabot", "renovate"]).map((s) => s.toLowerCase());
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
        next[key] = p.headRefOid;
        const author = p.author?.login ?? "?";
        const line = `${key} [${p.baseRefName}] ${author}${p.isDraft ? " DRAFT" : ""} +${p.additions}/-${p.deletions} checks:${checksOf(p)} :: ${String(p.title).slice(0, 90)}  ${p.url}`;
        if (skipAuthors.some((a) => author.toLowerCase().includes(a)) || skipTitles.some((r) => r.test(p.title))) { result.other.push(line); continue; }
        const state = !(key in seen) ? "NEW" : seen[key] !== p.headRefOid ? "CHANGED" : "seen";
        if (all || state !== "seen") result.fresh.push({ project: id, state, line });
      }
    }
    if (save && !gh.dryRun) writeState(stateDir, file, next);
  }
  return result;
}

export function formatPrWatch(r) {
  const out = [];
  out.push(r.fresh.length ? `${r.fresh.length} pull request(s) to review:\n${r.fresh.map((f) => `${f.state.padEnd(7)} ${f.line}`).join("\n")}` : "No new or changed pull requests.");
  if (r.other.length) out.push(`\nNot reviewed here (dependency bots and skipped titles): ${r.other.length}`);
  for (const s of r.skipped) out.push(`skipped ${s}`);
  for (const e of r.errors) out.push(`ERROR ${e}`);
  return out.join("\n");
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2), ["all", "dry-run", "no-save"]);
  try {
    const config = loadConfig(flags.config || "qa-projects.json");
    const gh = createGh({ dryRun: !!flags["dry-run"] });
    const r = prWatch({ config, projectId: positional[0], gh, stateDir: flags["state-dir"] || ".state", all: !!flags.all, save: !flags["no-save"] });
    console.log(formatPrWatch(r));
    if (r.errors.length) process.exitCode = 1;
  } catch (e) { console.error(e.message); process.exitCode = 2; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
