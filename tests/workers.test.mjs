import { test } from "node:test";
import assert from "node:assert/strict";
import { validateConfig } from "../tools/lib/config.mjs";
import { checkPolicy } from "../tools/lib/policy.mjs";
import { listWorkers, vscodeSettings, startInstructions, contrast, paletteFor } from "../tools/lib/workers.mjs";
import { plan } from "../tools/onboard.mjs";
import { baseRaw } from "./helpers.mjs";

const build = (patch = (x) => x) => {
  const raw = baseRaw();
  raw.ai_accounts = ["lead-bot", "dev-bot-1", "dev-bot-2"];
  raw.projects.notes.lead = "lead-bot";
  raw.projects.tasks.lead = "lead-bot";
  const { errors, config } = validateConfig(patch(raw));
  if (errors.length) throw new Error(errors.join("; "));
  return config;
};
const two = (extra = {}) => build((r) => ({ ...r, people: { "dana-owner": { roles: [{ name: "ai-developer", account: "dev-bot-1", surface: "editor", ...extra }, { name: "ai-developer", account: "dev-bot-2", surface: "editor" }] } } }));

test("every palette color takes white text at AA contrast", () => {
  for (const role of ["tech-lead", "ai-developer", "qa-lead", "security-lead", "researcher"])
    for (const c of paletteFor(role)) assert.ok(contrast(c, "#ffffff") >= 4.5, `${role} ${c}`);
  assert.ok(contrast("#ffffff", "#000000") > 20);
});

test("workers of one role get different colors; an explicit color wins", () => {
  const w = listWorkers(two());
  assert.notEqual(w[0].color, w[1].color);
  assert.equal(listWorkers(two({ color: "#123456" }))[0].color, "#123456");
});

test("surface and color are validated", () => {
  assert.throws(() => build((r) => ({ ...r, people: { a: { roles: [{ name: "ai-developer", surface: "cloud" }] } } })), /surface must be one of/);
  assert.throws(() => build((r) => ({ ...r, people: { a: { roles: [{ name: "ai-developer", color: "red" }] } } })), /#rrggbb/);
});

test("a background worker needs headless set", () => {
  const c = build((r) => ({ ...r, runner: { command: "x", args: [], prompt_via: "arg" }, people: { a: { roles: [{ name: "qa-lead", account: "dev-bot-1", surface: "background" }] } } }));
  assert.match(checkPolicy(c).errors.join(" "), /surface is "background" but headless is not set/);
});

test("VS Code settings carry the color and the worker label", () => {
  const [w] = listWorkers(two());
  const s = vscodeSettings(w);
  assert.equal(s["workbench.colorCustomizations"]["titleBar.activeBackground"], w.color);
  assert.match(s["window.title"], /ai-developer - dev-bot-1/);
});

test("start instructions follow the chosen surface", () => {
  const c = build((r) => ({ ...r, runner: { command: "x", args: [], prompt_via: "arg" }, people: { a: { roles: [{ name: "ai-developer", account: "dev-bot-1", surface: "editor", folder: "/w/a" }, { name: "qa-lead", account: "dev-bot-2", surface: "terminal", folder: "/w/b" }, { name: "security-lead", surface: "background", headless: "read-only" }, "researcher"] } } }));
  const t = startInstructions(c, "/hub");
  assert.match(t, /Open the folder `\/w\/a` in its own editor window/);
  assert.match(t, /`cd \/w\/b`/);
  assert.match(t, /run-role\.mjs --config \/hub\/qa-projects\.json --hub \/hub --role security-lead --person a/);
  assert.match(t, /not chosen yet/);
});

test("onboard writes settings files only for editor workers, and a start file", () => {
  const c = two();
  const { files } = plan({ config: c, hubPath: "/hub" });
  const rels = files.map((f) => f.rel);
  assert.ok(rels.includes("START-WORKERS.md"));
  assert.equal(rels.filter((r) => /^workers\/.+\/vscode-settings\.json$/.test(r)).length, 2);
  const none = plan({ config: build(), hubPath: "/hub" }).files.map((f) => f.rel);
  assert.equal(none.filter((r) => r.startsWith("workers/")).length, 0);
});
