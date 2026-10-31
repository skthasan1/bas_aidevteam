// Lists issue and pull request comments made since a stored timestamp that may need an answer: not by the owner's accounts, not by bots,
// not by the team's own AI comments (a comment that starts with one of config.ai_comment_prefixes). It only prints candidates; a person or the tech lead decides.
//   node tools/question-watch.mjs [project] [--config qa-projects.json] [--state-dir .state] [--since 2026-01-01T00:00:00Z] [--dry-run] [--no-save]
// Read-only: it only runs "gh api" GET requests. State: <state-dir>/question-watch-<project>.json holds the time of the last run.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "./lib/cli.mjs";
import { loadConfig, selectProjects, reposOf, ownerLogins } from "./lib/config.mjs";
import { createGh } from "./lib/gh.mjs";
import { readState, writeState } from "./lib/state.mjs";

const MAX_PAGES = 10;

export function isCandidate(comment, { owners, bots, prefixes }) {
  const login = (comment.user?.login ?? "").toLowerCase();
  if (!login) return false;
  if (comment.user?.type === "Bot" || login.endsWith("[bot]") || bots.includes(login)) return false;
  if (owners.has(login)) return false;
  const body = String(comment.body ?? "").trimStart().toLowerCase();
  if (prefixes.some((p) => body.startsWith(p.toLowerCase()))) return false;
  return true;
}

function fetchComments(gh, repo, kind, since) {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = gh.json(["api", `repos/${repo}/${kind}?since=${encodeURIComponent(since)}&per_page=100&page=${page}`]) ?? [];
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

export function questionWatch({ config, projectId, gh, stateDir = ".state", since, now = new Date(), save = true }) {
  const result = { candidates: [], errors: [], skipped: [] };
  const bots = config.bots.map((b) => b.toLowerCase());
  const prefixes = config.ai_comment_prefixes;
  for (const [id, project] of selectProjects(config, projectId)) {
    const file = `question-watch-${id}`;
    const state = readState(stateDir, file, null);
    const from = since || state?.lastRun || new Date(now.getTime() - 864e5).toISOString();
    const owners = ownerLogins(config, project);
    let ok = true;
    for (const repo of reposOf(project)) {
      for (const kind of ["issues/comments", "pulls/comments"]) {
        let list;
        try { list = fetchComments(gh, repo, kind, from); } catch (e) { result.errors.push(`${repo} (${kind}): ${e.message}`); ok = false; continue; }
        for (const c of list) {
          if (!isCandidate(c, { owners, bots, prefixes })) continue;
          result.candidates.push({ project: id, repo, kind, author: c.user.login, at: c.created_at, url: c.html_url, text: String(c.body ?? "").replace(/\s+/g, " ").trim().slice(0, 160) });
        }
      }
    }
    if (save && ok && !gh.dryRun) writeState(stateDir, file, { lastRun: now.toISOString() });
  }
  result.candidates.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return result;
}

export function formatQuestionWatch(r) {
  const out = [];
  out.push(r.candidates.length
    ? `${r.candidates.length} comment(s) that may need an answer:\n${r.candidates.map((c) => `${c.at} ${c.repo} ${c.author}: ${c.text}  ${c.url}`).join("\n")}`
    : "No comments to look at.");
  for (const e of r.errors) out.push(`ERROR ${e}`);
  return out.join("\n");
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2), ["dry-run", "no-save"]);
  try {
    const config = loadConfig(flags.config || "qa-projects.json");
    const gh = createGh({ dryRun: !!flags["dry-run"] });
    const r = questionWatch({ config, projectId: positional[0], gh, stateDir: flags["state-dir"] || ".state", since: typeof flags.since === "string" ? flags.since : undefined, save: !flags["no-save"] });
    console.log(formatQuestionWatch(r));
    if (r.errors.length) process.exitCode = 1;
  } catch (e) { console.error(e.message); process.exitCode = 2; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
