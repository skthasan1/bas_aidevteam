// Runs one command as a worker's own GitHub App, so what it does on GitHub is attributed to that App and not to a person.
//   node tools/as-app.mjs --config qa-projects.json --role qa-lead [--person dana-owner] [--account acme-qa-bot] --owner acme -- gh pr list -R acme/notes-web
// It finds the worker, gets a one-hour installation token (tools/app-token.mjs), and starts the command with GH_TOKEN set to it.
// The command is started directly (never through a shell); GITHUB_TOKEN is removed from its environment so the two cannot clash.
// Output and exit code pass through. The token is never printed. --dry-run true shows what would run without getting a token.
// --owner is the organization or user the App is installed on; it may be left out when the worker's app.owner is set in the config.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getToken } from "./app-token.mjs";
import { parseArgs } from "./lib/cli.mjs";
import { loadConfig } from "./lib/config.mjs";
import { resolveKeyPath } from "./lib/identities.mjs";
import { findWorker } from "./run-role.mjs";

// Returns { status, stdout, stderr }. getTokenImpl and spawnImpl can be replaced in tests.
export async function runAs({ config, role, person, account, owner, command, dryRun = false, getTokenImpl = getToken, spawnImpl = spawnSync, env = process.env, stdio = "inherit", log = console.log }) {
  if (!Array.isArray(command) || command.length === 0) throw new Error("give the command to run after --, for example: -- gh pr list -R owner/name");
  const worker = findWorker(config, { role, person, account });
  const label = `${worker.role}${worker.person ? ` for ${worker.person}` : ""}${worker.account ? ` (${worker.account})` : ""}`;
  if (!worker.app) throw new Error(`the ${label} worker has no "app" in the config; add its App {id, key_file} (see docs/IDENTITIES.md), or run the command yourself`);
  const who = owner || worker.app.owner;
  if (!who) throw new Error("give --owner <org or user the App is installed on>, or set app.owner for this worker in the config");
  if (dryRun) {
    log(`DRY RUN: would run as ${label}`);
    log(`  App ID: ${worker.app.id}`);
    log(`  Owner: ${who}`);
    log(`  Command: ${command.join(" ")}`);
    return { status: 0, stdout: "", stderr: "" };
  }
  const token = await getTokenImpl({ appId: worker.app.id, keyFile: resolveKeyPath(worker.app.key_file), owner: who });
  const childEnv = { ...env, GH_TOKEN: token };
  delete childEnv.GITHUB_TOKEN;
  const r = spawnImpl(command[0], command.slice(1), { env: childEnv, stdio, encoding: "utf8", shell: false });
  if (r.error) throw new Error(`could not start "${command[0]}": ${r.error.code ?? r.error.message}`);
  return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

async function main() {
  const argv = process.argv.slice(2);
  const cut = argv.indexOf("--");
  const own = cut < 0 ? argv : argv.slice(0, cut);
  const command = cut < 0 ? [] : argv.slice(cut + 1);
  let flags;
  try {
    const parsed = parseArgs(own, ["help", "dry-run"]);
    flags = parsed.flags;
    if (parsed.positional.length) throw new Error(`unexpected argument "${parsed.positional[0]}" (put the command after --)`);
  } catch (e) { console.error(e.message); process.exitCode = 2; return; }
  if (flags.help) {
    console.log(["Usage: node tools/as-app.mjs --config <file> --role <role> [--person <handle>] [--account <login>] --owner <org-or-user> [--dry-run true] -- <command> [args...]",
      "Runs the command with GH_TOKEN set to a one-hour token of the worker's own GitHub App. The token is never printed."].join(String.fromCharCode(10)));
    return;
  }
  try {
    const s = (k) => (typeof flags[k] === "string" ? flags[k] : undefined);
    const config = loadConfig(s("config") ?? "qa-projects.json");
    const res = await runAs({ config, role: s("role"), person: s("person"), account: s("account"), owner: s("owner"), command, dryRun: !!flags["dry-run"] });
    process.exitCode = res.status;
  } catch (e) { console.error(e.message); process.exitCode = 2; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
