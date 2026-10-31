import { test } from "node:test";
import assert from "node:assert/strict";
import { validateConfig, parseConfig, selectProjects, reposOf, ownerLogins, loadConfig } from "../tools/lib/config.mjs";
import { baseRaw, makeConfig } from "./helpers.mjs";

test("a valid config normalises defaults", () => {
  const c = makeConfig();
  assert.equal(c.roles.length, 5);
  assert.equal(c.projects.tasks.default, "acme/tasks");
  assert.deepEqual(reposOf(c.projects.notes), ["acme/notes-web", "acme/notes-api"]);
  assert.ok(c.bots.includes("dependabot[bot]"));
});

test("roles accept an object with enabled flags and accounts", () => {
  const c = makeConfig((r) => ({ ...r, roles: { "tech-lead": { account: "acme-tl" }, "qa-lead": { enabled: false }, researcher: true } }));
  assert.deepEqual(c.roles.map((x) => x.name), ["tech-lead", "researcher"]);
  assert.equal(c.roles[0].account, "acme-tl");
});

test("errors are reported for bad input", () => {
  const cases = [
    [(r) => ({ ...r, projects: {} }), /at least one project/],
    [(r) => { r.projects.notes.repos.web = "not-a-repo"; return r; }, /not owner\/repo/],
    [(r) => { r.projects.notes.testing = "maybe"; return r; }, /testing must be/],
    [(r) => { r.projects.notes.watch = "always"; return r; }, /watch must be/],
    [(r) => { r.projects.notes.owners = []; return r; }, /at least one handle/],
    [(r) => ({ ...r, roles: ["wizard"] }), /unknown role/],
    [(r) => ({ ...r, bots: "x" }), /bots must be/],
    [(r) => { r.projects.Bad_Id = r.projects.tasks; return r; }, /project id/],
  ];
  for (const [patch, re] of cases) {
    const { errors, config } = validateConfig(patch(baseRaw()));
    assert.equal(config, null);
    assert.match(errors.join("\n"), re);
  }
  assert.deepEqual(validateConfig([]).errors, ["config must be a JSON object"]);
});

test("a missing watch gives a warning and is treated as off", () => {
  const raw = baseRaw();
  delete raw.projects.tasks.watch;
  const { warnings, config } = validateConfig(raw);
  assert.match(warnings.join(), /treated as off/);
  assert.equal(config.projects.tasks.watch, "off");
});

test("parseConfig and loadConfig fail with readable messages", () => {
  assert.throws(() => parseConfig("{nope"), /not valid JSON/);
  assert.throws(() => parseConfig("{}"), /invalid config/);
  assert.throws(() => loadConfig("does-not-exist.json"), /cannot read config/);
});

test("selectProjects skips watch off unless a project is named", () => {
  const c = makeConfig();
  assert.deepEqual(selectProjects(c).map(([id]) => id), ["notes"]);
  assert.deepEqual(selectProjects(c, "tasks").map(([id]) => id), ["tasks"]);
  assert.throws(() => selectProjects(c, "zzz"), /unknown project/);
});

test("ownerLogins merges owner, project owners and AI accounts in lower case", () => {
  const c = makeConfig();
  const s = ownerLogins(c, c.projects.notes);
  assert.ok(s.has("dana-owner") && s.has("acme-bot"));
});

test("the acme example config is valid", () => {
  const c = loadConfig(new URL("../examples/acme/qa-projects.json", import.meta.url));
  assert.deepEqual(c.roles.map((r) => r.name), ["tech-lead", "ai-developer", "qa-lead", "researcher"]);
});
