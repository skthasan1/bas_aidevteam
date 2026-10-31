import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { onboard, fill, todoText } from "../tools/onboard.mjs";
import { makeConfig, tmpDir } from "./helpers.mjs";
import { loadConfig } from "../tools/lib/config.mjs";

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

test("a symlink inside the target that leads outside is refused before anything is written", (t) => {
  const kit = fakeKit(), outside = tmpDir(), target = tmpDir();
  try { fs.symlinkSync(outside, path.join(target, "briefs"), "junction"); } catch { t.skip("cannot create a link here"); return; }
  assert.throws(() => onboard({ config: config(), target, kitRoot: kit, apply: true, force: true, log: () => {} }), /outside the target/);
  assert.deepEqual(fs.readdirSync(outside), [], "nothing written through the link");
  assert.equal(fs.existsSync(path.join(target, "RUNBOOK.md")), false, "nothing written at all");
  // a link that stays inside the target is fine
  const inner = tmpDir(), t2 = tmpDir();
  fs.mkdirSync(path.join(t2, "real"));
  fs.symlinkSync(path.join(t2, "real"), path.join(t2, "briefs"), "junction");
  assert.doesNotThrow(() => onboard({ config: config(), target: t2, kitRoot: kit, apply: true, log: () => {} }));
  assert.ok(fs.existsSync(path.join(t2, "real", "tech-lead-startup.md")));
  void inner;
});

test("values put into .json templates are JSON-escaped", () => {
  const kit = fakeKit();
  fs.writeFileSync(path.join(kit, "templates", "hub", "note.json"), '{"org": "{{org}}", "owner": "<owner>"}');
  const cfg = makeConfig((r) => ({ ...r, organization: 'ac"me', owner: { name: 'Da"na', handles: ["dana-owner"] }, roles: ["tech-lead"] }));
  const target = path.join(tmpDir(), "hub");
  onboard({ config: cfg, target, kitRoot: kit, apply: true, log: () => {} });
  const parsed = JSON.parse(fs.readFileSync(path.join(target, "note.json"), "utf8"));
  assert.deepEqual(parsed, { org: 'ac"me', owner: 'Da"na' });
});

test("--force keeps a .bak copy of an overwritten qa-projects.json", () => {
  const kit = fakeKit(), target = tmpDir();
  fs.writeFileSync(path.join(target, "qa-projects.json"), "OLD CONFIG");
  onboard({ config: config(), target, kitRoot: kit, apply: true, force: true, log: () => {} });
  assert.equal(fs.readFileSync(path.join(target, "qa-projects.json.bak"), "utf8"), "OLD CONFIG");
  assert.match(fs.readFileSync(path.join(target, "qa-projects.json"), "utf8"), /"organization": "acme"/);
});

test("angle-bracket placeholders the tool knows are filled, the others are left alone", () => {
  const kit = fakeKit();
  fs.writeFileSync(path.join(kit, "templates", "hub", "RUNBOOK.md"), "hub <hub-path> org <org> owner <owner> repos <repo-list> role <role> on <date> because <reason>\n");
  fs.writeFileSync(path.join(kit, "roles", "tech-lead.md"), "role <role> hub <hub-path> repos <repo-list> topic <topic>\n");
  const target = path.join(tmpDir(), "hub");
  onboard({ config: config(), target, kitRoot: kit, apply: true, log: () => {} });
  assert.equal(fs.readFileSync(path.join(target, "RUNBOOK.md"), "utf8"), `hub ${target} org acme owner Dana repos acme/notes-web, acme/notes-api, acme/tasks role <role> on <date> because <reason>\n`);
  assert.equal(fs.readFileSync(path.join(target, "briefs", "tech-lead-startup.md"), "utf8"), `role tech-lead hub ${target} repos acme/notes-web, acme/notes-api, acme/tasks topic <topic>\n`);
});

test("no known placeholder remains unfilled in a hub generated from the real templates", () => {
  const cfg = loadConfig(path.resolve("examples/acme/qa-projects.json"));
  const target = path.join(tmpDir(), "hub");
  onboard({ config: cfg, target, apply: true, log: () => {} });
  const left = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { const rel = path.relative(target, p).split(path.sep).join("/"); const text = fs.readFileSync(p, "utf8"); const known = rel.startsWith("briefs/") ? /<(?:org|owner|hub-path|repo-list|role)>|\{\{[a-z_]+\}\}/ : /<(?:org|owner|hub-path|repo-list)>|\{\{[a-z_]+\}\}/; const m = text.match(known); if (m) left.push(`${rel}: ${m[0]}`); } } };
  walk(target);
  assert.deepEqual(left, []);
});
