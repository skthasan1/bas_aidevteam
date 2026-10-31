import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPanel } from "../tools/panel.mjs";
import { makeEnv, waitFor, FAKE_TOKEN } from "./runner-helpers.mjs";

const KIT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Starts a panel on an ephemeral port and returns a request helper. cookie/origin/host can be overridden or removed per call.
async function open(envOpts = {}, prepare = () => {}) {
  const env = makeEnv(envOpts);
  prepare(env);
  const panel = createPanel({ configFile: env.configFile, hub: env.hub, port: 0 });
  const port = await panel.listen();
  const good = { cookie: `bas_panel=${panel.token}`, origin: `http://127.0.0.1:${port}`, host: `127.0.0.1:${port}` };
  const call = (method, p, { body, headers = {}, raw, auth = true, json = true, origin = true } = {}) => new Promise((resolve, reject) => {
    const h = { host: good.host, ...(auth ? { cookie: good.cookie } : {}), ...(method === "POST" && origin ? { origin: good.origin } : {}), ...(method === "POST" && json ? { "content-type": "application/json" } : {}), ...headers };
    for (const k of Object.keys(h)) if (h[k] === undefined) delete h[k];
    const data = raw ?? (body === undefined ? undefined : JSON.stringify(body));
    const r = http.request({ host: "127.0.0.1", port, method, path: p, headers: { ...h, ...(data ? { "content-length": Buffer.byteLength(data) } : {}) } }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let j = null;
        try { j = JSON.parse(text); } catch { /* not json */ }
        resolve({ status: res.statusCode, headers: res.headers, text, json: j });
      });
    });
    r.on("error", reject);
    r.end(data);
  });
  const stop = () => panel.close();
  return { env, panel, port, call, stop, good };
}

const task = { role: "ai-developer", task: "Fix the flaky test" };

test("listens on 127.0.0.1 only", async () => {
  const p = await open();
  try { assert.equal(p.panel.server.address().address, "127.0.0.1"); } finally { await p.stop(); }
});

test("a token is required for every request", async () => {
  const p = await open();
  try {
    for (const url of ["/", "/app.js", "/style.css", "/api/state", "/api/runs/2026-01-01-ai-developer-1/log"]) {
      const r = await p.call("GET", url, { auth: false });
      assert.equal(r.status, 401, url);
    }
    assert.equal((await p.call("GET", "/api/state", { auth: false, headers: { cookie: "bas_panel=wrong" } })).status, 401);
    assert.equal((await p.call("GET", "/api/state", { auth: false, headers: { "x-panel-token": "wrong" } })).status, 401);
    assert.equal((await p.call("GET", "/?token=wrong", { auth: false })).status, 401);
    const post = await p.call("POST", "/api/run/preview", { auth: false, body: task });
    assert.equal(post.status, 401);
    // the token in a query does not authorize an API call
    assert.equal((await p.call("GET", `/api/state?token=${p.panel.token}`, { auth: false })).status, 401);
    // the right header or cookie does
    assert.equal((await p.call("GET", "/api/state", { auth: false, headers: { "x-panel-token": p.panel.token } })).status, 200);
    assert.equal((await p.call("GET", "/api/state")).status, 200);
  } finally { await p.stop(); }
});

test("the first load trades the query token for an HttpOnly SameSite=Strict cookie", async () => {
  const p = await open();
  try {
    const r = await p.call("GET", `/?token=${p.panel.token}`, { auth: false });
    assert.equal(r.status, 302);
    assert.equal(r.headers.location, "/");
    const cookie = String(r.headers["set-cookie"]);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.ok(cookie.includes(p.panel.token));
    const page = await p.call("GET", "/", { auth: false, headers: { cookie: cookie.split(";")[0] } });
    assert.equal(page.status, 200);
    assert.match(page.text, /<title>Team control panel<\/title>/);
  } finally { await p.stop(); }
});

test("a Host header that is not this server is rejected (DNS rebinding)", async () => {
  const p = await open();
  try {
    for (const host of ["evil.example.com", `evil.example.com:${p.port}`, `127.0.0.1:${p.port + 1}`, "127.0.0.1", `[::1]:${p.port}`]) {
      const r = await p.call("GET", "/api/state", { headers: { host } });
      assert.equal(r.status, 403, host);
    }
    assert.equal((await p.call("GET", "/api/state", { headers: { host: `localhost:${p.port}` } })).status, 200);
  } finally { await p.stop(); }
});

test("POST needs a matching Origin and a JSON content type", async () => {
  const p = await open();
  try {
    assert.equal((await p.call("POST", "/api/run/preview", { body: task, origin: false })).status, 403);
    assert.equal((await p.call("POST", "/api/run/preview", { body: task, headers: { origin: "http://evil.example.com" } })).status, 403);
    assert.equal((await p.call("POST", "/api/run/preview", { body: task, headers: { origin: "null" } })).status, 403);
    assert.equal((await p.call("POST", "/api/run/preview", { body: task, headers: { origin: `http://127.0.0.1:${p.port + 1}` } })).status, 403);
    assert.equal((await p.call("POST", "/api/run/preview", { body: task, json: false, headers: { "content-type": "text/plain" } })).status, 415);
    assert.equal((await p.call("POST", "/api/run/preview", { body: task, json: false, headers: { "content-type": "application/x-www-form-urlencoded" } })).status, 415);
    assert.equal((await p.call("POST", "/api/run/preview", { body: task, headers: { origin: `http://localhost:${p.port}` } })).status, 200);
    assert.equal((await p.call("PUT", "/api/state")).status, 405);
    assert.equal((await p.call("POST", "/api/run/preview", { raw: "{not json" })).status, 400);
    assert.equal((await p.call("POST", "/api/run/preview", { raw: "x".repeat(70000) })).status, 413);
  } finally { await p.stop(); }
});

test("responses carry the security headers, no CORS headers, and the page loads nothing external", async () => {
  const p = await open();
  try {
    for (const url of ["/", "/app.js", "/style.css", "/api/state", "/nothing"]) {
      const r = await p.call("GET", url, { headers: { origin: "http://evil.example.com" } });
      assert.match(r.headers["content-security-policy"], /default-src 'self'/, url);
      assert.equal(r.headers["x-content-type-options"], "nosniff", url);
      assert.equal(r.headers["cache-control"], "no-store", url);
      assert.equal(Object.keys(r.headers).filter((k) => k.startsWith("access-control-")).length, 0, url);
    }
    assert.doesNotMatch(r0(await p.call("GET", "/api/state")), /unsafe-inline|unsafe-eval/);
    for (const f of ["index.html", "app.js", "style.css"]) {
      const text = fs.readFileSync(path.join(KIT, "tools", "panel", f), "utf8");
      assert.doesNotMatch(text, /https?:\/\/|src="\/\/|@import|<style|onclick=|innerHTML/i, f);
    }
    assert.doesNotMatch((await p.call("GET", "/")).text, /<script>[^<]|<style/);
  } finally { await p.stop(); }
});
const r0 = (r) => String(r.headers["content-security-policy"]);

test("a run id with path tricks is rejected and nothing outside the hub is read", async () => {
  const p = await open({}, (env) => {
    fs.writeFileSync(path.join(env.root, "outside.log"), "OUTSIDE SECRET");
    fs.writeFileSync(path.join(env.hub, "inside.log"), "INSIDE NOT A RUN");
    fs.mkdirSync(path.join(env.hub, "runs"));
  });
  try {
    for (const id of ["..%2Foutside", "..%2F..%2Foutside", "%2e%2e%2Foutside", "2026-01-01-ai-developer-1%2F..%2F..%2Foutside", "..%5Coutside", "2026-01-01-ai-developer-1%00", "inside", "2026-01-01-AI-1"]) {
      const r = await p.call("GET", `/api/runs/${id}/log`);
      assert.equal(r.status, 400, id);
      assert.doesNotMatch(r.text, /SECRET|INSIDE/);
    }
    assert.equal((await p.call("GET", "/api/runs/2026-01-01-ai-developer-1/log")).status, 404);
    // static paths cannot leave the three served files
    for (const url of ["/../package.json", "/%2e%2e/package.json", "/panel/app.js", "/index.html", "/..%5Cpackage.json", "//etc/passwd"]) {
      const r = await p.call("GET", url);
      assert.equal(r.status, 404, url);
      assert.doesNotMatch(r.text, /bas-aidevteam/);
    }
    // a symlinked log or note that points outside the hub is not followed
    const link = path.join(p.env.hub, "runs", "2026-01-01-ai-developer-9.log");
    let linked = true;
    try { fs.symlinkSync(path.join(p.env.root, "outside.log"), link); } catch { linked = false; }
    if (linked) {
      const r = await p.call("GET", "/api/runs/2026-01-01-ai-developer-9/log");
      assert.equal(r.status, 404);
      assert.doesNotMatch(r.text, /OUTSIDE/);
    }
    fs.mkdirSync(path.join(p.env.hub, "handoff"));
    let linked2 = true;
    try { fs.symlinkSync(path.join(p.env.root, "outside.log"), path.join(p.env.hub, "handoff", "leak.md")); } catch { linked2 = false; }
    if (linked2) assert.doesNotMatch((await p.call("GET", "/api/state")).text, /OUTSIDE|leak\.md/);
  } finally { await p.stop(); }
});

test("state: mode, projects, workers, doctor, queue, handoffs, watches and runs", async () => {
  process.env.PANEL_TEST_API_KEY = "panel-env-secret-1234";
  const p = await open({}, (env) => {
    fs.mkdirSync(path.join(env.hub, "handoff"));
    fs.mkdirSync(path.join(env.hub, ".state"));
    fs.writeFileSync(path.join(env.hub, "queue.md"), `| id | Question |\n|---|---|\n| D-001 | Switch the watch? ${FAKE_TOKEN} panel-env-secret-1234 |\n`);
    fs.writeFileSync(path.join(env.hub, "handoff", "2026-01-02-ai-developer.md"), "\n# Left off at step 4\nmore\n");
    fs.writeFileSync(path.join(env.hub, ".state", "pr-watch-notes.json"), "{}");
  });
  try {
    const r = await p.call("GET", "/api/state");
    assert.equal(r.status, 200);
    const s = r.json;
    assert.equal(s.mode, "solo");
    assert.deepEqual(s.projects.map((x) => x.id), ["notes", "tasks"]);
    assert.ok(["name", "lead", "merge", "covers", "owners", "members"].every((k) => k in s.projects[0]));
    const dev = s.workers.find((w) => w.role === "ai-developer");
    assert.equal(dev.headless, "write-branch");
    assert.equal(dev.account, "acme-dev-bot");
    assert.equal(s.workers.find((w) => w.role === "qa-lead").headless, false);
    assert.ok(Array.isArray(s.doctor.errors) && Array.isArray(s.doctor.warnings));
    assert.match(s.queue.text, /D-001/);
    assert.equal(s.handoffs[0].name, "2026-01-02-ai-developer.md");
    assert.equal(s.handoffs[0].firstLine, "# Left off at step 4");
    assert.equal(s.watches[0].name, "pr-watch-notes");
    assert.deepEqual(s.runs, []);
    // nothing token-like or secret leaves the panel
    assert.equal(r.text.includes(FAKE_TOKEN), false);
    assert.equal(r.text.includes("panel-env-secret-1234"), false);
    assert.match(r.text, /\[redacted\]/);
  } finally { delete process.env.PANEL_TEST_API_KEY; await p.stop(); }
});

test("preview, then start: the run happens, the log appears and is redacted", async () => {
  const p = await open();
  try {
    const pre = await p.call("POST", "/api/run/preview", { body: task });
    assert.equal(pre.status, 200);
    assert.match(pre.json.preview, /DRY RUN/);
    assert.match(pre.json.preview, /Mode write-branch/);
    assert.match(pre.json.preview, /Fix the flaky test/);
    assert.equal(fs.existsSync(path.join(p.env.hub, "runs")), false, "a preview writes nothing");
    const start = await p.call("POST", "/api/run/start", { body: { ...task, confirm: true } });
    assert.equal(start.status, 200, start.text);
    const id = start.json.id;
    assert.match(id, /^\d{4}-\d{2}-\d{2}-ai-developer-1$/);
    const rec = await waitFor(async () => { const s = (await p.call("GET", "/api/state")).json; return s.runs.find((x) => x.id === id && x.status === "done"); });
    assert.equal(rec.exit, 0);
    const log = await p.call("GET", `/api/runs/${id}/log`);
    assert.equal(log.status, 200);
    assert.match(log.json.log, /ARGS_OK/);
    assert.equal(log.text.includes(FAKE_TOKEN), false);
    assert.match(log.json.log, /\[redacted\]/);
    assert.equal(fs.readFileSync(path.join(p.env.hub, "runs", `${id}.log`), "utf8").includes(FAKE_TOKEN), false);
    const worker = (await p.call("GET", "/api/state")).json.workers.find((w) => w.role === "ai-developer");
    assert.equal(worker.lastRun.id, id);
  } finally { await p.stop(); }
});

test("start without a preview is rejected, and so is a changed task or a second start", async () => {
  const p = await open();
  try {
    assert.equal((await p.call("POST", "/api/run/start", { body: { ...task, confirm: true } })).status, 409);
    assert.equal((await p.call("POST", "/api/run/start", { body: task })).status, 400, "confirm is required");
    assert.equal((await p.call("POST", "/api/run/start", { body: { ...task, confirm: "true" } })).status, 400, "confirm must be the boolean true");
    await p.call("POST", "/api/run/preview", { body: task });
    const changed = await p.call("POST", "/api/run/start", { body: { ...task, task: "Something else", confirm: true } });
    assert.equal(changed.status, 409);
    const ok = await p.call("POST", "/api/run/start", { body: { ...task, confirm: true } });
    assert.equal(ok.status, 200);
    await waitFor(async () => (await p.call("GET", "/api/state")).json.runs.every((r) => r.status !== "running"));
    assert.equal((await p.call("POST", "/api/run/start", { body: { ...task, confirm: true } })).status, 409, "a preview is good for one start");
    assert.equal(fs.readdirSync(path.join(p.env.hub, "runs")).filter((n) => n.endsWith(".json")).length, 1);
  } finally { await p.stop(); }
});

test("a preview that has expired no longer allows a start", async () => {
  const realNow = Date.now;
  const p = await open();
  try {
    await p.call("POST", "/api/run/preview", { body: task });
    Date.now = () => realNow() + 6 * 60 * 1000;
    assert.equal((await p.call("POST", "/api/run/start", { body: { ...task, confirm: true } })).status, 409);
  } finally { Date.now = realNow; await p.stop(); }
});

test("a worker without headless is refused, and the page cannot choose the folder", async () => {
  const p = await open();
  try {
    const r = await p.call("POST", "/api/run/preview", { body: { role: "qa-lead", task: "x" } });
    assert.equal(r.status, 400);
    assert.match(r.json.error, /not set up for headless/);
    const s = await p.call("POST", "/api/run/start", { body: { role: "qa-lead", task: "x", confirm: true } });
    assert.ok([400, 409].includes(s.status));
    assert.equal(fs.existsSync(path.join(p.env.hub, "runs")), false);
    const other = path.join(p.env.root, "elsewhere");
    fs.mkdirSync(other);
    // the config has no folder for this worker, and a folder in the request is ignored
    const f = await p.call("POST", "/api/run/preview", { body: { role: "tech-lead", task: "x", folder: other } });
    assert.equal(f.status, 400);
    assert.match(f.json.error, /no worker folder/);
    assert.equal((await p.call("POST", "/api/run/preview", { body: { role: 5, task: "x" } })).status, 400);
    assert.equal((await p.call("POST", "/api/run/preview", { body: { role: "ai-developer", task: "x", person: 3 } })).status, 400);
  } finally { await p.stop(); }
});

test("a second concurrent run in the same folder is refused; stop works", async () => {
  const p = await open({ mode: "sleep" });
  try {
    await p.call("POST", "/api/run/preview", { body: task });
    const a = await p.call("POST", "/api/run/start", { body: { ...task, confirm: true } });
    assert.equal(a.status, 200, a.text);
    await p.call("POST", "/api/run/preview", { body: task });
    const b = await p.call("POST", "/api/run/start", { body: { ...task, confirm: true } });
    assert.equal(b.status, 409);
    assert.match(b.json.error, /already using this worker folder/);
    assert.equal((await p.call("POST", "/api/run/stop", { body: { id: "../x" } })).status, 400);
    assert.equal((await p.call("POST", "/api/run/stop", { body: { id: "2026-01-01-ai-developer-77" } })).status, 404);
    assert.equal((await p.call("POST", "/api/run/stop", { body: { id: a.json.id } })).status, 200);
    const rec = await waitFor(async () => (await p.call("GET", "/api/state")).json.runs.find((r) => r.id === a.json.id && r.status === "stopped"));
    assert.equal(rec.stopped, true);
  } finally { await p.stop(); }
});

test("the panel has no other write endpoint", async () => {
  const p = await open();
  try {
    for (const url of ["/api/config", "/api/merge", "/api/push", "/api/comment", "/api/keys", "/api/run", "/api/runs/x/log"]) {
      const r = await p.call("POST", url, { body: {} });
      assert.ok([404, 400].includes(r.status), `${url} -> ${r.status}`);
    }
    assert.equal((await p.call("POST", "/api/state", { body: {} })).status, 404);
  } finally { await p.stop(); }
});
