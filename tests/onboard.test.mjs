import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { onboard, fill, todoText } from "../tools/onboard.mjs";
import { makeConfig, tmpDir } from "./helpers.mjs";

function fakeKit() {
  const kit = tmpDir();
  fs.mkdirSync(path.join(kit, "templates", "hub", "queue"), { recursive: true });
  fs.mkdirSync(path.join(kit, "roles"));
  fs.writeFileSync(path.join(kit, "templates", "hub", "RUNBOOK.md"), "# Runbook for {{org}}\nOwner: {{owner_name}} ({{owner_handles}})\nProjects: {{projects}}\n");
  fs.writeFileSync(path.join(kit, "templates", "hub", "queue", "queue.md"), "queue for {{org}}\n");
  fs.writeFileSync(path.join(kit, "roles", "tech-lead.md"), "You are the {{role}} of {{org}}. Account: {{role_account}}. Unknown: {{nope}}\n");
  fs.writeFileSync(path.join(kit, "roles", "qa-lead.md"), "You are the {{role}}.\n");
  return kit;
}
const quiet = () => { const lines = []; return { lines, log: (l) => lines.push(l) }; };
const config = () => makeConfig((r) => ({ ...r, roles: { "tech-lead": { account: "acme-tl" }, "qa-lead": {}, researcher: {} } }));

test("fill replaces known placeholders and leaves unknown ones", () => {
  assert.equal(fill("{{org}} {{ x }} {{y}}", { org: "acme", x: "1" }), "acme 1 {{y}}");
});

test("dry run writes nothing", () => {
  const kit = fakeKit(), target = path.join(tmpDir(), "hub");
  const q = quiet();
  const res = onboard({ config: config(), target, kitRoot: kit, log: q.log });
  assert.deepEqual(res.written, []);
  assert.equal(fs.existsSync(target), false);
  const text = q.lines.join("\n");
  assert.match(text, /DRY RUN/);
  assert.match(text, /create\s+briefs\/tech-lead-startup\.md/);
  assert.match(text, /ONBOARDING-TODO\.md/);
  assert.match(res.warnings.join(), /roles\/researcher\.md not found/);
});

test("apply writes templates, config, briefs and the to-do list", () => {
  const kit = fakeKit(), target = path.join(tmpDir(), "hub");
  const res = onboard({ config: config(), target, kitRoot: kit, apply: true, log: quiet().log });
  assert.ok(res.written.includes("RUNBOOK.md"));
  assert.equal(fs.readFileSync(path.join(target, "RUNBOOK.md"), "utf8"), "# Runbook for acme\nOwner: Dana (dana-owner)\nProjects: Acme Notes, Acme Tasks\n");
  assert.equal(fs.readFileSync(path.join(target, "queue", "queue.md"), "utf8"), "queue for acme\n");
  assert.equal(fs.readFileSync(path.join(target, "briefs", "tech-lead-startup.md"), "utf8"), "You are the tech-lead of acme. Account: acme-tl. Unknown: {{nope}}\n");
  assert.ok(fs.existsSync(path.join(target, "briefs", "qa-lead-startup.md")));
  assert.ok(!fs.existsSync(path.join(target, "briefs", "researcher-startup.md")));
  const written = JSON.parse(fs.readFileSync(path.join(target, "qa-projects.json"), "utf8"));
  assert.equal(written.projects.notes.watch, "review");
  const todo = fs.readFileSync(path.join(target, "ONBOARDING-TODO.md"), "utf8");
  assert.match(todo, /acme\/notes-web: protect the default/);
  assert.match(todo, /never creates accounts/);
  assert.doesNotMatch(todo, /security-lead/);
});

test("an existing file blocks the whole run unless --force", () => {
  const kit = fakeKit(), target = tmpDir();
  fs.writeFileSync(path.join(target, "RUNBOOK.md"), "mine");
  const q = quiet();
  const res = onboard({ config: config(), target, kitRoot: kit, apply: true, log: q.log });
  assert.deepEqual(res.blocked, ["RUNBOOK.md"]);
  assert.deepEqual(res.written, []);
  assert.equal(fs.readFileSync(path.join(target, "RUNBOOK.md"), "utf8"), "mine");
  assert.equal(fs.existsSync(path.join(target, "ONBOARDING-TODO.md")), false, "nothing written when blocked");

  const forced = onboard({ config: config(), target, kitRoot: kit, apply: true, force: true, log: quiet().log });
  assert.ok(forced.written.includes("RUNBOOK.md"));
  assert.match(fs.readFileSync(path.join(target, "RUNBOOK.md"), "utf8"), /Runbook for acme/);
});

test("a target is required and an empty kit only warns", () => {
  assert.throws(() => onboard({ config: config(), target: "", kitRoot: fakeKit(), log: () => {} }), /--target/);
  const empty = tmpDir();
  const res = onboard({ config: config(), target: path.join(tmpDir(), "h"), kitRoot: empty, log: () => {} });
  assert.match(res.warnings.join(), /templates\/hub is empty/);
});

test("the to-do list mentions every repository and enabled role", () => {
  const t = todoText(config());
  for (const s of ["acme/notes-api", "acme/tasks", "tech-lead", "qa-lead", "researcher", "acme-tl"]) assert.ok(t.includes(s), s);
});
