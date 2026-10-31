import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { onboard } from "../tools/onboard.mjs";
import { upgrade, diffHint } from "../tools/upgrade.mjs";
import { doctor } from "../tools/doctor.mjs";
import { sha256, changelogSections, compareVersions } from "../tools/lib/marker.mjs";
import { makeConfig, tmpDir } from "./helpers.mjs";

const w = (kit, rel, text) => { const p = path.join(kit, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
const read = (hub, rel) => fs.readFileSync(path.join(hub, rel), "utf8");
const quiet = () => { const lines = []; return { lines, log: (l) => lines.push(l) }; };
// A config that also loads from disk (a lead per project), because upgrade reads the hub's own qa-projects.json.
const config = () => makeConfig((r) => ({
  ...r,
  ai_accounts: ["acme-bot", "acme-tl"],
  roles: { "tech-lead": { account: "acme-tl" } },
  projects: Object.fromEntries(Object.entries(r.projects).map(([k, p]) => [k, { ...p, lead: "acme-tl" }])),
}));

// A small kit at version 0.1.0.
function fakeKit() {
  const kit = tmpDir();
  w(kit, "VERSION", "0.1.0\n");
  w(kit, "CHANGELOG.md", "# Changelog\n\n## Unreleased\n\nNot released yet.\n\n## 0.1.0 - first\n\nFirst.\n");
  w(kit, "templates/hub/RUNBOOK.md", "# Runbook for {{org}}\nline two\n");
  w(kit, "templates/hub/queue/queue.md", "queue for {{org}}\n");
  w(kit, "templates/hub/notes.md", "notes\n");
  w(kit, "roles/tech-lead.md", "You are the {{role}}.\n");
  return kit;
}
// Sets a hub up from the kit (version 0.1.0).
function setup() {
  const kit = fakeKit(), hub = path.join(tmpDir(), "hub");
  onboard({ config: config(), target: hub, apply: true, kitRoot: kit, log: () => {} });
  return { kit, hub };
}
// Makes the kit a newer release: 0.2.0 with a changed RUNBOOK, a changed notes, a new file and no queue.
function release(kit) {
  w(kit, "VERSION", "0.2.0\n");
  w(kit, "CHANGELOG.md", "# Changelog\n\n## Unreleased\n\nLater.\n\n## 0.2.0 - second\n\nSecond change.\n\n## 0.1.0 - first\n\nFirst.\n");
  w(kit, "templates/hub/RUNBOOK.md", "# Runbook for {{org}}\nline two changed\n");
  w(kit, "templates/hub/notes.md", "notes v2\n");
  w(kit, "templates/hub/learning/new.md", "new file for {{org}}\n");
  fs.rmSync(path.join(kit, "templates/hub/queue/queue.md"));
}
const snapshot = (dir) => {
  const out = {};
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out[path.relative(dir, p)] = fs.readFileSync(p, "utf8"); } };
  walk(dir);
  return out;
};

test("onboard writes the version marker and a manifest of the template files as written", () => {
  const { hub } = setup();
  assert.equal(read(hub, ".bas-aidevteam-version"), "0.1.0\n");
  const manifest = JSON.parse(read(hub, ".bas-aidevteam-manifest.json"));
  assert.deepEqual(Object.keys(manifest), ["RUNBOOK.md", "notes.md", "queue/queue.md"]);
  assert.equal(manifest["RUNBOOK.md"], sha256(read(hub, "RUNBOOK.md")));
  assert.match(read(hub, "RUNBOOK.md"), /Runbook for acme/, "the hash is of the filled text, not the raw template");
  assert.equal(manifest["queue/queue.md"], sha256(read(hub, "queue/queue.md")));
  assert.equal(manifest["qa-projects.json"], undefined, "the config is never a tracked template file");
});

test("onboard dry run lists the marker and writes nothing", () => {
  const kit = fakeKit(), target = path.join(tmpDir(), "hub"), q = quiet();
  onboard({ config: config(), target, kitRoot: kit, log: q.log });
  assert.match(q.lines.join("\n"), /\.bas-aidevteam-version/);
  assert.match(q.lines.join("\n"), /\.bas-aidevteam-manifest\.json/);
  assert.equal(fs.existsSync(target), false);
});

test("upgrade dry run writes nothing and reports versions, changelog and each file status", () => {
  const { kit, hub } = setup();
  release(kit);
  const before = snapshot(hub), q = quiet();
  const res = upgrade({ hub, kitRoot: kit, log: q.log });
  assert.deepEqual(snapshot(hub), before);
  assert.deepEqual(res.written, []);
  const text = q.lines.join("\n");
  assert.match(text, /Installed kit version: 0\.1\.0/);
  assert.match(text, /Available kit version: 0\.2\.0/);
  assert.match(text, /Second change/);
  assert.doesNotMatch(text, /First\./, "only sections newer than the installed version");
  assert.doesNotMatch(text, /Later\./, "an unreleased section is not shown");
  assert.match(text, /updated in kit\s+RUNBOOK\.md/);
  assert.match(text, /new in kit\s+learning\/new\.md/);
  assert.match(text, /removed in kit\s+queue\/queue\.md/);
});

test("apply updates files you did not edit, and refreshes the marker and manifest", () => {
  const { kit, hub } = setup();
  release(kit);
  const q = quiet();
  upgrade({ hub, apply: true, kitRoot: kit, log: q.log });
  assert.match(read(hub, "RUNBOOK.md"), /line two changed/);
  assert.match(read(hub, "RUNBOOK.md"), /Runbook for acme/);
  assert.equal(read(hub, "learning/new.md"), "new file for acme\n");
  assert.equal(read(hub, ".bas-aidevteam-version"), "0.2.0\n");
  const manifest = JSON.parse(read(hub, ".bas-aidevteam-manifest.json"));
  assert.equal(manifest["RUNBOOK.md"], sha256(read(hub, "RUNBOOK.md")));
  assert.equal(manifest["learning/new.md"], sha256("new file for acme\n"));
  assert.equal(manifest["queue/queue.md"], undefined, "a removed file leaves the manifest");
  assert.equal(fs.existsSync(path.join(hub, "queue/queue.md")), true, "a file removed in the kit is never deleted from the hub");
  assert.match(q.lines.join("\n"), /run\s+node tools\/doctor\.mjs/);
});

test("a file you edited is never overwritten: the kit text goes to .kit-new", () => {
  const { kit, hub } = setup();
  fs.writeFileSync(path.join(hub, "RUNBOOK.md"), "# my own runbook\nline two\n");
  release(kit);
  const q = quiet();
  upgrade({ hub, apply: true, kitRoot: kit, log: q.log });
  assert.equal(read(hub, "RUNBOOK.md"), "# my own runbook\nline two\n");
  assert.match(read(hub, "RUNBOOK.md.kit-new"), /line two changed/);
  assert.match(q.lines.join("\n"), /edited in your hub\s+RUNBOOK\.md/);
  assert.match(q.lines.join("\n"), /first difference at line 1/);
  const manifest = JSON.parse(read(hub, ".bas-aidevteam-manifest.json"));
  assert.notEqual(manifest["RUNBOOK.md"], sha256(read(hub, "RUNBOOK.md")), "the manifest keeps the old hash so the file stays marked as edited");
  assert.equal(read(hub, "notes.md"), "notes v2\n", "the other, untouched file still updates");
});

test("an edited file the kit did not change needs no .kit-new", () => {
  const { kit, hub } = setup();
  fs.writeFileSync(path.join(hub, "notes.md"), "my notes\n");
  release(kit);
  w(kit, "templates/hub/notes.md", "notes\n");
  upgrade({ hub, apply: true, kitRoot: kit, log: () => {} });
  assert.equal(read(hub, "notes.md"), "my notes\n");
  assert.equal(fs.existsSync(path.join(hub, "notes.md.kit-new")), false);
});

test("an existing .kit-new stops the apply unless --force", () => {
  const { kit, hub } = setup();
  fs.writeFileSync(path.join(hub, "RUNBOOK.md"), "mine\n");
  fs.writeFileSync(path.join(hub, "RUNBOOK.md.kit-new"), "old suggestion\n");
  release(kit);
  assert.throws(() => upgrade({ hub, apply: true, kitRoot: kit, log: () => {} }), /already exist/);
  assert.equal(read(hub, "RUNBOOK.md.kit-new"), "old suggestion\n");
  assert.equal(read(hub, ".bas-aidevteam-version"), "0.1.0\n", "nothing was written");
  upgrade({ hub, apply: true, force: true, kitRoot: kit, log: () => {} });
  assert.match(read(hub, "RUNBOOK.md.kit-new"), /line two changed/);
});

test("a new kit file that collides with a file of yours goes to .kit-new", () => {
  const { kit, hub } = setup();
  release(kit);
  w(hub, "learning/new.md", "mine\n");
  upgrade({ hub, apply: true, kitRoot: kit, log: () => {} });
  assert.equal(read(hub, "learning/new.md"), "mine\n");
  assert.equal(read(hub, "learning/new.md.kit-new"), "new file for acme\n");
});

test("a file you deleted from the hub is not brought back", () => {
  const { kit, hub } = setup();
  fs.rmSync(path.join(hub, "notes.md"));
  release(kit);
  upgrade({ hub, apply: true, kitRoot: kit, log: () => {} });
  assert.equal(fs.existsSync(path.join(hub, "notes.md")), false);
});

test("upgrade never touches the config, notes, queue entries or runs", () => {
  const { kit, hub } = setup();
  w(hub, "runs/2026-01-01.md", "a run\n");
  w(hub, "briefings/today.md", "briefing\n");
  const cfg = read(hub, "qa-projects.json");
  release(kit);
  upgrade({ hub, apply: true, kitRoot: kit, log: () => {} });
  assert.equal(read(hub, "qa-projects.json"), cfg);
  assert.equal(read(hub, "runs/2026-01-01.md"), "a run\n");
  assert.equal(read(hub, "briefings/today.md"), "briefing\n");
  assert.equal(fs.existsSync(path.join(hub, "qa-projects.json.bak")), false);
});

test("a symlink inside the hub cannot lead a write outside it", (t) => {
  const { kit, hub } = setup();
  const outside = tmpDir();
  try { fs.symlinkSync(outside, path.join(hub, "learning"), "junction"); } catch { t.skip("cannot create a link here"); return; }
  release(kit);
  assert.throws(() => upgrade({ hub, apply: true, kitRoot: kit, log: () => {} }), /outside the hub/);
  assert.deepEqual(fs.readdirSync(outside), []);
  assert.equal(read(hub, "RUNBOOK.md").includes("changed"), false, "nothing was written before the check failed");
});

test("an unknown hub folder, a hub without a marker and a damaged manifest fail clearly", () => {
  const kit = fakeKit();
  assert.throws(() => upgrade({ hub: path.join(tmpDir(), "nope"), kitRoot: kit, log: () => {} }), /hub folder not found/);
  assert.throws(() => upgrade({ kitRoot: kit, log: () => {} }), /--hub/);
  const plain = tmpDir();
  assert.throws(() => upgrade({ hub: plain, kitRoot: kit, log: () => {} }), /\.bas-aidevteam-version not found/);
  const { hub } = setup();
  fs.writeFileSync(path.join(hub, ".bas-aidevteam-manifest.json"), "{ not json");
  assert.throws(() => upgrade({ hub, kitRoot: kit, log: () => {} }), /damaged/);
  fs.writeFileSync(path.join(hub, ".bas-aidevteam-manifest.json"), JSON.stringify({ "RUNBOOK.md": "zzz" }));
  assert.throws(() => upgrade({ hub, kitRoot: kit, log: () => {} }), /damaged/);
});

test("a hub marked newer than the kit is refused unless --force", () => {
  const { kit, hub } = setup();
  fs.writeFileSync(path.join(hub, ".bas-aidevteam-version"), "0.9.0\n");
  assert.throws(() => upgrade({ hub, kitRoot: kit, log: () => {} }), /newer than this kit/);
  assert.doesNotThrow(() => upgrade({ hub, force: true, kitRoot: kit, log: () => {} }));
});

test("doctor --hub warns for a missing marker and an older version, and fails for an unknown folder", () => {
  const { kit, hub } = setup();
  release(kit);
  let q = quiet();
  let res = doctor({ config: config(), hub, kitRoot: kit, log: q.log });
  assert.deepEqual(res.errors.filter((e) => /hub/.test(e)), []);
  assert.match(res.warnings.join("\n"), /set up with kit 0\.1\.0; this kit is 0\.2\.0/);
  const bare = tmpDir();
  res = doctor({ config: config(), hub: bare, kitRoot: kit, log: () => {} });
  assert.match(res.warnings.join("\n"), /no usable version marker/);
  res = doctor({ config: config(), hub: path.join(bare, "nope"), kitRoot: kit, log: () => {} });
  assert.match(res.errors.join("\n"), /hub folder not found/);
  upgrade({ hub, apply: true, kitRoot: kit, log: () => {} });
  res = doctor({ config: config(), hub, kitRoot: kit, log: () => {} });
  assert.deepEqual(res.warnings, [], "an upgraded hub is clean");
  assert.deepEqual(doctor({ config: config(), kitRoot: kit, log: () => {} }).warnings, [], "without --hub nothing is checked");
});

test("helpers: versions, changelog sections and the diff hint", () => {
  assert.equal(compareVersions("0.1.0", "0.10.0"), -1);
  assert.equal(compareVersions("1.0.0", "0.99.9"), 1);
  assert.throws(() => compareVersions("x", "1.0.0"));
  assert.deepEqual(changelogSections("# C\n\n## Unreleased\nx\n\n## 0.2.0 - a\nb\n\n## 0.1.0 - c\nd\n").map((s) => s.version), ["0.2.0", "0.1.0"]);
  assert.match(diffHint("a\nb\n", "a\nc\n"), /first difference at line 2: yours "b" \/ kit "c"/);
});
