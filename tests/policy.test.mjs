import { test } from "node:test";
import assert from "node:assert/strict";
import { validateConfig } from "../tools/lib/config.mjs";
import { checkPolicy, mineView, powersOf, workersOf, checkRepoGuardrails } from "../tools/lib/policy.mjs";
import { doctor } from "../tools/doctor.mjs";
import { baseRaw, tmpDir } from "./helpers.mjs";
import fs from "node:fs";
import path from "node:path";

const build = (patch = (x) => x) => {
  const raw = baseRaw();
  raw.ai_accounts = ["lead-bot", "dev-bot-1", "dev-bot-2", "dev-bot-3"];
  raw.projects.notes.lead = "lead-bot";
  raw.projects.notes.merge = "lead-on-owner-word";
  raw.projects.notes.members = ["sam-dev"];
  raw.projects.tasks.lead = "lead-bot";
  const covers = { review: "role:tech-lead", test: "role:qa-lead", security: "role:security-lead", decision: "person:dana-owner" };
  raw.projects.notes.covers = { ...covers };
  raw.projects.tasks.covers = { ...covers };
  const { errors, config } = validateConfig(patch(raw));
  if (errors.length) throw new Error(errors.join("; "));
  return config;
};

test("a consistent team policy has no problems; merge defaults to owner-only", () => {
  const c = build();
  assert.deepEqual(checkPolicy(c).errors, []);
  assert.equal(c.projects.tasks.merge, "owner-only");
  assert.equal(c.mode, "team");
});

test("invalid mode, merge value and lead are rejected", () => {
  assert.throws(() => build((r) => ({ ...r, mode: "crowd" })), /mode must be/);
  assert.throws(() => build((r) => { r.projects.notes.merge = "anyone"; return r; }), /merge must be/);
  assert.throws(() => build((r) => { r.projects.notes.lead = "not a handle!"; return r; }), /lead must be/);
});

test("policy errors: no lead in team mode, lead not an AI account, lead is a person, watch merge but owner-only", () => {
  assert.match(checkPolicy(build((r) => { delete r.projects.tasks.lead; return r; })).errors.join("\n"), /needs one lead AI account/);
  assert.match(checkPolicy(build((r) => { r.projects.notes.lead = "stranger"; return r; })).errors.join("\n"), /not one of the organization's AI accounts/);
  assert.match(checkPolicy(build((r) => { r.ai_accounts.push("dana-owner"); r.projects.notes.lead = "dana-owner"; return r; })).errors.join("\n"), /also listed as a person/);
  assert.match(checkPolicy(build((r) => { r.projects.tasks.watch = "merge"; return r; })).errors.join("\n"), /never be allowed to merge/);
});

test("solo mode needs exactly one owner and no members", () => {
  const solo = (patch) => build((r) => patch({ ...r, mode: "solo" }));
  const e1 = checkPolicy(solo((r) => r)).errors.join("\n");
  assert.match(e1, /no members/);
  const ok = solo((r) => { r.projects.notes.members = []; return r; });
  assert.deepEqual(checkPolicy(ok).errors, []);
  assert.match(checkPolicy(solo((r) => { r.projects.notes.members = []; r.projects.notes.owners = ["a", "b"]; return r; })).errors.join("\n"), /exactly one owner/);
});

test("roles in a project and what the person's AI may do there", () => {
  const c = build();
  assert.equal(powersOf(c.projects.notes, "dana-owner").merge, "lead-on-owner-word");
  assert.equal(powersOf(c.projects.notes, "SAM-dev").role, "member");
  assert.equal(powersOf(c.projects.notes, "SAM-dev").merge, "never");
  assert.equal(powersOf(c.projects.notes, "stranger").review, false);
  assert.deepEqual(mineView(c, "sam-dev").map((r) => r.id), ["notes"]);
  assert.deepEqual(mineView(c, "dana-owner").map((r) => r.id), ["notes", "tasks"]);
});

test("a person may run several AI developers and skip other roles", () => {
  const c = build((r) => ({ ...r, people: { "sam-dev": { roles: [{ name: "ai-developer", account: "dev-bot-1" }, { name: "ai-developer", account: "dev-bot-2" }, { name: "ai-developer", account: "dev-bot-3" }] } } }));
  assert.equal(workersOf(c, "sam-dev").length, 3);
  assert.equal(workersOf(c, "someone-else").length, c.roles.length);
  const res = checkPolicy(c);
  assert.deepEqual(res.errors, []);
});

test("people errors: unknown role, shared account, unknown account", () => {
  assert.throws(() => build((r) => ({ ...r, people: { "sam-dev": { roles: ["wizard"] } } })), /unknown role/);
  const shared = build((r) => ({ ...r, people: { a: { roles: [{ name: "ai-developer", account: "dev-bot-1" }] }, b: { roles: [{ name: "ai-developer", account: "dev-bot-1" }] } } }));
  assert.match(checkPolicy(shared).errors.join("\n"), /one identity per AI worker/);
  const unknown = build((r) => ({ ...r, people: { a: { roles: [{ name: "ai-developer", account: "ghost-bot" }] } } }));
  assert.match(checkPolicy(unknown).errors.join("\n"), /not one of the organization's AI accounts/);
});

test("repo guardrails are found missing, then present", () => {
  const dir = tmpDir();
  assert.equal(checkRepoGuardrails(dir).errors.length, 3);
  fs.mkdirSync(path.join(dir, ".github/workflows"), { recursive: true });
  for (const f of [".github/pull_request_template.md", ".github/workflows/checks.yml", ".github/CODEOWNERS"]) fs.writeFileSync(path.join(dir, f), "x");
  assert.equal(checkRepoGuardrails(dir).errors.length, 0);
});

test("doctor reports problems and the person's view", () => {
  const lines = [];
  const res = doctor({ config: build(), me: "sam-dev", log: (l) => lines.push(l) });
  assert.deepEqual(res.errors, []);
  assert.ok(lines.some((l) => /notes: member/.test(l)));
  const bad = doctor({ config: build((r) => { delete r.projects.tasks.lead; return r; }), log: (l) => lines.push(l) });
  assert.equal(bad.errors.length, 1);
});

test("every function must be covered in every project; a check alone never covers one", () => {
  const miss = checkPolicy(build((r) => { delete r.projects.notes.covers.security; return r; })).errors.join(String.fromCharCode(10));
  assert.match(miss, /covers.security is missing/);
  assert.throws(() => build((r) => { r.projects.notes.covers.test = "check:ci"; return r; }), /must be "role:<role>" or "person:<handle>"/);
  assert.throws(() => build((r) => { r.projects.notes.covers.lunch = "role:tech-lead"; return r; }), /unknown function/);
});

test("a covering role must fit the function and be run by somebody; a person must belong to the project", () => {
  assert.match(checkPolicy(build((r) => { r.projects.notes.covers.test = "role:researcher"; return r; })).errors.join(String.fromCharCode(10)), /does not do test/);
  assert.match(checkPolicy(build((r) => { r.roles = ["tech-lead", "ai-developer"]; return r; })).errors.join(String.fromCharCode(10)), /nobody runs the role "qa-lead"/);
  assert.match(checkPolicy(build((r) => { r.projects.notes.covers.test = "person:stranger"; return r; })).errors.join(String.fromCharCode(10)), /not an owner or member/);
  assert.deepEqual(checkPolicy(build((r) => { r.projects.notes.covers.test = "person:sam-dev"; return r; })).errors, []);
});

test("the decision is always an owner, never an AI", () => {
  assert.match(checkPolicy(build((r) => { r.projects.notes.covers.decision = "role:tech-lead"; return r; })).errors.join(String.fromCharCode(10)), /decision must be a person/);
  assert.match(checkPolicy(build((r) => { r.projects.notes.covers.decision = "person:sam-dev"; return r; })).errors.join(String.fromCharCode(10)), /must be an owner/);
});
