// Checks that the setup works without a person watching: the policy in the config, and optionally one repository's guardrail files.
//   node tools/doctor.mjs --config qa-projects.json [--repo <folder>] [--me <handle>]
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./lib/config.mjs";
import { checkPolicy, checkRepoGuardrails, mineView, workersOf } from "./lib/policy.mjs";
import { parseArgs } from "./lib/cli.mjs";

export function doctor({ config, repo, me, log = console.log }) {
  const results = [checkPolicy(config)];
  if (repo) results.push(checkRepoGuardrails(repo));
  const errors = results.flatMap((r) => r.errors);
  const warnings = results.flatMap((r) => r.warnings);
  if (me) {
    log(`Projects for ${me}:`);
    const w = workersOf(config, me);
    log(`  AI workers: ${w.length ? w.map((x) => x.name + (x.account ? " (" + x.account + ")" : "")).join(", ") : "(none)"}`);
    for (const r of mineView(config, me)) log(`  ${r.id}: ${r.role}, lead ${r.lead || "(none)"}, merge ${r.merge} - ${r.note}`);
  }
  for (const w of warnings) log(`warning: ${w}`);
  for (const e of errors) log(`PROBLEM: ${e}`);
  log(errors.length ? `\n${errors.length} problem(s) found.` : `\nOK: ${Object.keys(config.projects).length} project(s) in ${config.mode} mode, policy consistent.`);
  return { errors, warnings };
}

function main() {
  let flags;
  try { ({ flags } = parseArgs(process.argv.slice(2), ["help"])); } catch (e) { console.error(e.message); process.exitCode = 2; return; }
  if (flags.help) {
    console.log(["Usage: node tools/doctor.mjs --config <file> [--repo <folder>] [--me <handle>]",
      "  --config  your organization config (default: qa-projects.json)",
      "  --repo    also check that a repository folder has the template, the checks workflow and CODEOWNERS",
      "  --me      also list the projects this person owns or belongs to, with their role and merge power"].join(String.fromCharCode(10)));
    return;
  }
  try {
    const config = loadConfig(typeof flags.config === "string" ? flags.config : "qa-projects.json");
    const res = doctor({ config, repo: typeof flags.repo === "string" ? flags.repo : undefined, me: typeof flags.me === "string" ? flags.me : undefined });
    if (res.errors.length) process.exitCode = 1;
  } catch (e) { console.error(e.message); process.exitCode = 2; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
