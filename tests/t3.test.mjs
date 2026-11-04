import { test } from "node:test";
import assert from "node:assert/strict";
import { compileAreas, t3Areas, parseSecurityRead, t3Status } from "../tools/lib/t3.mjs";
import { t3Check, formatT3, securityLoginOf } from "../tools/t3-check.mjs";
import { prWatch, formatPrWatch } from "../tools/pr-watch.mjs";
import { validateConfig } from "../tools/lib/config.mjs";
import { baseRaw, makeConfig, tmpDir } from "./helpers.mjs";

const HEAD = "a".repeat(40);

// A fake gh: files and comments are keyed by pull request number.
function fakeGh({ files = {}, comments = {}, head = HEAD, prs = [] } = {}) {
  const calls = [];
  const gh = {
    dryRun: false,
    calls,
    run(args) {
      calls.push(args);
      if (args[0] === "pr" && args[1] === "view") return `${head}\n`;
      if (args[0] === "api" && /\/pulls\/(\d+)\/files$/.test(args[1])) return (files[args[1].match(/pulls\/(\d+)\//)[1]] ?? []).join("\n");
      if (args[0] === "api" && /\/issues\/(\d+)\/comments$/.test(args[1])) return (comments[args[1].match(/issues\/(\d+)\//)[1]] ?? []).join("\n");
      throw new Error(`unexpected gh call ${args.join(" ")}`);
    },
    json(args) { calls.push(args); return prs; },
  };
  return gh;
}

test("areas: security paths are found, documents alone are not", () => {
  assert.deepEqual(t3Areas(["src/auth/session.ts"]).sort(), ["sign-in/session"]);
  assert.ok(t3Areas(["db/migrations/001.sql"]).includes("database schema"));
  assert.ok(t3Areas([".github/workflows/ci.yml"]).includes("deploy/release"));
  assert.ok(t3Areas(["lib/billing/stripe.ts"]).includes("payments/money"));
  assert.deepEqual(t3Areas(["docs/auth-design.md", "README.md", "src/ui/button.tsx"]), []);
});

test("areas: a team can add its own", () => {
  const areas = compileAreas({ "customer data": "(^|/)exports?/" });
  assert.deepEqual(t3Areas(["src/exports/csv.ts"], areas), ["customer data"]);
});

test("parseSecurityRead: only the first line counts, the last answer wins, a new head makes it stale", () => {
  const r = (b, h = HEAD) => parseSecurityRead(b, h);
  assert.equal(r([]).status, "NONE");
  assert.equal(r([`Security read by Sam (security AI, Dana's AI assistant): CLEARED at ${HEAD}`]).status, "CLEARED");
  assert.equal(r([`Security read by Sam (x): CLEARED at ${HEAD}`, `Security read by Sam (x): FINDINGS at ${HEAD}: a medium`]).status, "FINDINGS");
  assert.equal(r([`Security read by Sam (x): CLEARED at ${"b".repeat(40)}`]).status, "STALE");
  assert.equal(r([`Security read by Sam (x): CLEARED at ${HEAD.slice(0, 8)}`]).status, "CLEARED"); // an abbreviated sha that matches
  assert.equal(r(["Looks fine to me, cleared"]).status, "NONE");
  assert.equal(r([`Some text\nSecurity read by Sam (x): CLEARED at ${HEAD}`]).status, "NONE"); // not on the first line
});

test("t3Status: not a security change, no read, cleared, stale", () => {
  const files = { 1: ["src/ui/a.tsx"], 2: ["src/auth/login.ts"], 3: ["src/auth/login.ts"], 4: ["src/auth/login.ts"] };
  const comments = { 3: [`Security read by Sam (x): CLEARED at ${HEAD}`], 4: [`Security read by Sam (x): CLEARED at ${"c".repeat(40)}`] };
  const gh = fakeGh({ files, comments });
  const s = (n) => t3Status({ gh, repo: "acme/web", number: n, headSha: HEAD, securityLogin: "sec-bot" }).status;
  assert.equal(s(1), "NOT_T3");
  assert.equal(s(2), "NONE");
  assert.equal(s(3), "CLEARED");
  assert.equal(s(4), "STALE");
});

test("t3Status only reads: no call is a write, and the login cannot inject into the filter", () => {
  const gh = fakeGh({ files: { 7: ["src/auth/x.ts"] } });
  t3Status({ gh, repo: "acme/web", number: 7, headSha: HEAD, securityLogin: 'x"||true||"' });
  const filter = gh.calls.find((c) => c.includes("--jq") && c[1].includes("/comments"));
  assert.ok(filter, "comments call made");
  assert.ok(!filter[filter.indexOf("--jq") + 1].includes('"||'));
});

test("t3Check: exit 0 for cleared or not a security change, 1 otherwise; the login comes from the config role", () => {
  const config = makeConfig((raw) => ({ ...raw, roles: [{ name: "tech-lead", account: "lead-bot" }, { name: "security-lead", account: "sec-bot" }] }));
  assert.equal(securityLoginOf(config), "sec-bot");
  assert.equal(securityLoginOf(config, "other"), "other");
  const none = fakeGh({ files: { 5: ["src/auth/x.ts"] } });
  const r1 = t3Check({ config, gh: none, repo: "acme/web", number: 5 });
  assert.equal(r1.exit, 1);
  assert.match(formatT3("acme/web", 5, r1), /security read: NONE/);
  const ok = fakeGh({ files: { 5: ["src/auth/x.ts"] }, comments: { 5: [`Security read by Sec (x): CLEARED at ${HEAD}`] } });
  assert.equal(t3Check({ config, gh: ok, repo: "acme/web", number: 5 }).exit, 0);
  const plain = fakeGh({ files: { 5: ["src/ui/x.tsx"] } });
  assert.equal(t3Check({ config, gh: plain, repo: "acme/web", number: 5 }).exit, 0);
  assert.throws(() => t3Check({ config: makeConfig(), gh: plain, repo: "acme/web", number: 5 }), /no security role account/);
});

test("config: security_read is validated", () => {
  const bad = (sr) => validateConfig({ ...baseRaw(), security_read: sr }).errors.join(" ");
  assert.match(bad("yes"), /security_read must be an object/);
  assert.match(bad({ enabled: "yes" }), /enabled must be true or false/);
  assert.match(bad({ areas: { x: "(" } }), /not a valid regular expression/);
  assert.equal(bad({ enabled: true, areas: { x: "^y/" } }), "");
});

test("pr-watch tags a security-area pull request only when security_read is enabled", () => {
  const pr = { number: 9, title: "login change", author: { login: "dev-a" }, baseRefName: "develop", isDraft: false, headRefOid: HEAD, additions: 3, deletions: 1, url: "u", statusCheckRollup: [] };
  const mk = (enabled) => makeConfig((raw) => ({ ...raw, roles: [{ name: "security-lead", account: "sec-bot" }], security_read: { enabled }, projects: { notes: { ...raw.projects.notes, repos: { web: "acme/notes-web" } }, tasks: raw.projects.tasks } }));
  const gh = fakeGh({ prs: [pr], files: { 9: ["src/auth/login.ts"] } });
  const on = prWatch({ config: mk(true), projectId: "notes", gh, stateDir: tmpDir() });
  assert.match(formatPrWatch(on), /security areas \[sign-in\/session\], security read: NONE/);
  const off = prWatch({ config: mk(false), projectId: "notes", gh: fakeGh({ prs: [pr], files: { 9: ["src/auth/login.ts"] } }), stateDir: tmpDir() });
  assert.doesNotMatch(formatPrWatch(off), /security read/);
});
