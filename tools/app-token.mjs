// Gets a short-lived GitHub App installation token, so an AI can act as its own App instead of a person's login.
//   node tools/app-token.mjs --app-id 123456 --key-file <path to the .pem> --repo owner/name     prints a token (expires in an hour)
//   node tools/app-token.mjs --app-id 123456 --key-file <path> --owner <org or user>             same, for the installation on that owner
// Use it: GH_TOKEN=$(node tools/app-token.mjs ...) gh pr list -R owner/name
// The private key is read from the file you name and is never printed, logged or sent anywhere except as a signature. Only the token is printed.
// Tokens are cached (default ~/.kairo-app/cache, override with --cache-dir) until five minutes before they expire.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "./lib/cli.mjs";

const b64 = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");

// A JWT signed with the App's private key, valid for under ten minutes (GitHub's limit).
export function makeJwt(appId, keyPem, now = Math.floor(Date.now() / 1000)) {
  const head = b64({ alg: "RS256", typ: "JWT" });
  const body = b64({ iat: now - 60, exp: now + 540, iss: String(appId) });
  const sig = crypto.createSign("RSA-SHA256").update(`${head}.${body}`).sign(keyPem, "base64url");
  return `${head}.${body}.${sig}`;
}

const cachePath = (dir, appId, owner) => path.join(dir, `${appId}-${owner.toLowerCase()}.json`);

function readCache(file, now) {
  try {
    const c = JSON.parse(fs.readFileSync(file, "utf8"));
    if (typeof c.token === "string" && Date.parse(c.expires_at) - now > 5 * 60 * 1000) return c.token;
  } catch { /* no cache */ }
  return null;
}

async function api(fetchImpl, base, method, route, headers) {
  const res = await fetchImpl(`${base}${route}`, { method, headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "bas-aidevteam-app-token", ...headers } });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* not json */ }
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${method} ${route}: ${data.message ?? "no message"}`);
  return data;
}

// Returns an installation token for the owner of `repo` (owner/name) or for `owner`.
export async function getToken({ appId, keyFile, repo, owner, base = "https://api.github.com", fetchImpl = fetch, cacheDir = path.join(os.homedir(), ".kairo-app", "cache"), now = Date.now() }) {
  if (!appId || !/^\d+$/.test(String(appId))) throw new Error("--app-id must be the App's numeric ID");
  if (!keyFile) throw new Error("--key-file <path to the .pem> is required");
  if (!repo && !owner) throw new Error("give --repo owner/name or --owner <org or user>");
  if (repo && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error("--repo must look like owner/name");
  const who = owner ?? repo.split("/")[0];
  const cache = cachePath(cacheDir, appId, who);
  const cached = readCache(cache, now);
  if (cached) return cached;
  let pem;
  try { pem = fs.readFileSync(keyFile, "utf8"); } catch (e) { throw new Error(`cannot read the key file ${keyFile}: ${e.code ?? "error"}`); }
  const jwt = makeJwt(appId, pem, Math.floor(now / 1000));
  const auth = { Authorization: `Bearer ${jwt}` };
  const inst = repo ? await api(fetchImpl, base, "GET", `/repos/${repo}/installation`, auth) : await api(fetchImpl, base, "GET", `/users/${owner}/installation`, auth).catch(() => api(fetchImpl, base, "GET", `/orgs/${owner}/installation`, auth));
  const tok = await api(fetchImpl, base, "POST", `/app/installations/${inst.id}/access_tokens`, auth);
  if (!tok.token) throw new Error("GitHub returned no token");
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cache, JSON.stringify({ token: tok.token, expires_at: tok.expires_at }), { mode: 0o600 });
  return tok.token;
}

async function main() {
  try {
    const { flags } = parseArgs(process.argv.slice(2), ["help"]);
    if (flags.help) {
      console.log(["Usage: node tools/app-token.mjs --app-id <id> --key-file <pem> (--repo owner/name | --owner <org-or-user>) [--cache-dir <dir>]",
        "Prints a GitHub App installation token (valid one hour). The key is read from the file and never printed."].join(String.fromCharCode(10)));
      return;
    }
    const s = (k) => (typeof flags[k] === "string" ? flags[k] : undefined);
    const token = await getToken({ appId: s("app-id"), keyFile: s("key-file"), repo: s("repo"), owner: s("owner"), cacheDir: s("cache-dir") });
    process.stdout.write(token + String.fromCharCode(10));
  } catch (e) { console.error(e.message); process.exitCode = 2; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
