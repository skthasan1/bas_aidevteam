// Lists recent merges of each watched project with who merged and when, flags merges whose pull request body says QA is still pending,
// and flags open pull requests that BECAME conflicting since the last run.
//   node tools/merge-watch.mjs [project] [--config qa-projects.json] [--state-dir .state] [--hours 24] [--dry-run] [--no-save]
// Read-only: it only runs "gh pr list". It never merges or comments. State: <state-dir>/merge-watch-<project>.json (pull requests already known to conflict).
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "./lib/cli.mjs";
import { loadConfig, selectProjects, reposOf } from "./lib/config.mjs";
import { createGh } from "./lib/gh.mjs";
import { readState, writeState } from "./lib/state.mjs";

const DEFAULT_QA_PENDING = "\\bQA\\b[^\\n]{0,20}\\bpending\\b|\\bpending\\b[^\\n]{0,10}\\bQA\\b|\\bQA pending\\b";

export function mergeWatch({ config, projectId, gh, stateDir = ".state", hours = 24, now = new Date(), save = true }) {
  const result = { merges: [], pendingQa: [], conflicts: [], errors: [], skipped: [] };
  const qaRe = new RegExp(config.merge_watch?.qa_pending_pattern || DEFAULT_QA_PENDING, "i");
  const cutoff = now.getTime() - hours * 36e5;
  for (const [id, project] of selectProjects(config, projectId)) {
    const file = `merge-watch-${id}`;
    const known = new Set(readState(stateDir, file, {}).conflicting ?? []);
    const nowConflicting = [];
    let ok = true;
    for (const repo of reposOf(project)) {
      try {
        const merged = gh.json(["pr", "list", "-R", repo, "--state", "merged", "--limit", "50", "--json", "number,title,mergedAt,mergedBy,author,url,baseRefName,body"]) ?? [];
        for (const p of merged) {
          if (!p.mergedAt || new Date(p.mergedAt).getTime() < cutoff) continue;
          const row = { project: id, repo, number: p.number, title: String(p.title).slice(0, 90), mergedBy: p.mergedBy?.login ?? "?", author: p.author?.login ?? "?", at: p.mergedAt, base: p.baseRefName, url: p.url };
          result.merges.push(row);
          if (qaRe.test(String(p.body ?? ""))) result.pendingQa.push(row);
        }
        const open = gh.json(["pr", "list", "-R", repo, "--state", "open", "--limit", "100", "--json", "number,title,mergeable,url,baseRefName"]) ?? [];
        for (const p of open) {
          if (p.mergeable !== "CONFLICTING") continue;
          const key = `${repo}#${p.number}`;
          nowConflicting.push(key);
          result.conflicts.push({ project: id, repo, number: p.number, title: String(p.title).slice(0, 90), url: p.url, isNew: !known.has(key) });
        }
      } catch (e) { result.errors.push(`${repo}: ${e.message}`); ok = false; }
    }
    if (save && ok && !gh.dryRun) writeState(stateDir, file, { conflicting: nowConflicting });
  }
  result.merges.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return result;
}

export function formatMergeWatch(r) {
  const out = [];
  out.push(r.merges.length ? `${r.merges.length} recent merge(s):\n${r.merges.map((m) => `${m.at} ${m.repo}#${m.number} into ${m.base} by ${m.mergedBy} (author ${m.author}) :: ${m.title}  ${m.url}`).join("\n")}` : "No recent merges.");
  if (r.pendingQa.length) out.push(`\nMerged while QA was pending (${r.pendingQa.length}):\n${r.pendingQa.map((m) => `${m.repo}#${m.number} ${m.url}`).join("\n")}`);
  if (r.conflicts.length) out.push(`\nOpen pull requests in conflict (${r.conflicts.length}):\n${r.conflicts.map((c) => `${c.isNew ? "BECAME CONFLICTING" : "still conflicting"} ${c.repo}#${c.number} :: ${c.title}  ${c.url}`).join("\n")}`);
  for (const e of r.errors) out.push(`ERROR ${e}`);
  return out.join("\n");
}

async function main() {
  try {
    const { positional, flags } = parseArgs(process.argv.slice(2), ["dry-run", "no-save"]);
    const config = loadConfig(flags.config || "qa-projects.json");
    const gh = createGh({ dryRun: !!flags["dry-run"] });
    const hours = flags.hours ? Number(flags.hours) : 24;
    if (!(hours > 0)) throw new Error("--hours must be a positive number");
    const r = mergeWatch({ config, projectId: positional[0], gh, stateDir: flags["state-dir"] || ".state", hours, save: !flags["no-save"] });
    console.log(formatMergeWatch(r));
    if (r.errors.length) process.exitCode = 1;
  } catch (e) { console.error(e.message); process.exitCode = 2; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
