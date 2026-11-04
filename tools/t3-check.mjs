// Merge gate for the security read: does this pull request need one, and has the security role cleared its CURRENT head?
//   node tools/t3-check.mjs <owner/repo> <number> [--config qa-projects.json] [--security-login <login>]
// Exit 0 = not a security-area change, or the security role cleared the exact head. Exit 1 = a read is missing, stale or has findings (do not merge).
// Exit 2 = usage or a gh failure. Read-only: only "gh pr view" and "gh api" GETs. See docs/PROTOCOL.md section 5.3.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "./lib/cli.mjs";
import { loadConfig } from "./lib/config.mjs";
import { createGh } from "./lib/gh.mjs";
import { listWorkers } from "./lib/workers.mjs";
import { compileAreas, t3Status, T3_HINT } from "./lib/t3.mjs";

export function securityLoginOf(config, flag) {
  if (flag) return String(flag);
  const w = listWorkers(config).find((x) => x.name === "security-lead" && x.account);
  return w ? String(w.account) : "";
}

export function t3Check({ config, gh, repo, number, securityLogin }) {
  const head = String(gh.run(["pr", "view", String(number), "-R", repo, "--json", "headRefOid", "--jq", ".headRefOid"]) || "").trim();
  const login = securityLoginOf(config, securityLogin);
  if (!login) throw new Error("no security role account found: set one in the config or pass --security-login");
  const areas = compileAreas(config.security_read?.areas ?? {});
  const s = t3Status({ gh, repo, number, headSha: head, securityLogin: login, areas });
  return { head, ...s, exit: s.status === "NOT_T3" || s.status === "CLEARED" ? 0 : 1 };
}

export function formatT3(repo, number, r) {
  if (r.status === "NOT_T3") return `${repo}#${number}: not a security-area change (${r.files.length} files)`;
  return `${repo}#${number}: security areas [${r.areas.join(", ")}], head ${r.head.slice(0, 8)}, security read: ${r.status}${r.sha ? ` (read ${r.sha.slice(0, 8)})` : ""}\n${T3_HINT[r.status]}`;
}

function main() {
  try {
    const { positional, flags } = parseArgs(process.argv.slice(2), []);
    const [repo, number] = positional;
    if (!repo || !/^\d+$/.test(number || "")) { console.error("usage: node tools/t3-check.mjs <owner/repo> <number> [--config file] [--security-login login]"); process.exitCode = 2; return; }
    const config = loadConfig(flags.config || "qa-projects.json");
    const r = t3Check({ config, gh: createGh(), repo, number, securityLogin: flags["security-login"] });
    console.log(formatT3(repo, number, r));
    process.exitCode = r.exit;
  } catch (e) { console.error(e.message); process.exitCode = 2; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
