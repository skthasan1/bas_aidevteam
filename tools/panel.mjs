// A local control panel: one web page to see the team and start or stop headless runs. See docs/PANEL.md.
//   node tools/panel.mjs --config qa-projects.json --hub ../my-hub [--port 4310]
// It listens on 127.0.0.1 only. A random token is printed once as a URL; every request needs it. The page can read the hub and
// start or stop runs through tools/run-role.mjs; it cannot edit the config, merge, push, comment on GitHub or touch keys.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "./lib/cli.mjs";
import { loadConfig } from "./lib/config.mjs";
import { checkPolicy } from "./lib/policy.mjs";
import { makeRedactor } from "./lib/redact.mjs";
import { buildRun, startRun, describeRun, listWorkers, RUN_ID_RE } from "./run-role.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COOKIE = "bas_panel";
const MAX_BODY = 64 * 1024;
const MAX_QUEUE = 20000;
const MAX_LOG_READ = 100 * 1024;
const PREVIEW_MS = 5 * 60 * 1000;
// The only files the server hands out (exact path match, so there is no path to traverse).
const STATIC = { "/": ["index.html", "text/html; charset=utf-8"], "/app.js": ["app.js", "text/javascript; charset=utf-8"], "/style.css": ["style.css", "text/css; charset=utf-8"] };

const sha = (s) => crypto.createHash("sha256").update(s).digest();
const sameSecret = (a, b) => typeof a === "string" && typeof b === "string" && crypto.timingSafeEqual(sha(a), sha(b));
const readCapped = (file, max) => {
  const st = fs.lstatSync(file);
  if (!st.isFile()) throw new Error("not a file");
  const fd = fs.openSync(file, "r");
  try {
    const len = Math.min(st.size, max);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, 0);
    return { text: buf.toString("utf8"), truncated: st.size > max };
  } finally { fs.closeSync(fd); }
};

export function createPanel({ configFile, hub, port = 4310, token = crypto.randomBytes(24).toString("hex"), execFileFn }) {
  const hubAbs = path.resolve(hub);
  const active = new Map(); // run id -> handle from startRun
  const previews = new Map(); // preview hash -> expiry (ms)
  let boundPort = port;

  const hostOk = (h) => typeof h === "string" && [`127.0.0.1:${boundPort}`, `localhost:${boundPort}`].includes(h.toLowerCase());
  const originOk = (o) => typeof o === "string" && [`http://127.0.0.1:${boundPort}`, `http://localhost:${boundPort}`].includes(o.toLowerCase());

  function headers(extra = {}) {
    return {
      "Content-Security-Policy": "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      ...extra,
    };
  }
  function sendText(res, status, text, type = "text/plain; charset=utf-8", extra = {}) {
    res.writeHead(status, headers({ "Content-Type": type, ...extra }));
    res.end(text);
  }
  // Every JSON answer goes through the redactor, so a token-like string or secret env value can never leave the panel.
  function sendJson(res, status, obj) {
    sendText(res, status, makeRedactor()(JSON.stringify(obj)), "application/json; charset=utf-8");
  }

  function cookieToken(req) {
    for (const part of String(req.headers.cookie ?? "").split(";")) {
      const i = part.indexOf("=");
      if (i > 0 && part.slice(0, i).trim() === COOKIE) return part.slice(i + 1).trim();
    }
    return "";
  }
  const authed = (req) => sameSecret(cookieToken(req), token) || sameSecret(String(req.headers["x-panel-token"] ?? ""), token);

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      let over = false;
      const chunks = [];
      req.on("data", (c) => {
        size += c.length;
        if (over) return; // keep draining so the answer can be sent, but store nothing more
        if (size > MAX_BODY) { over = true; chunks.length = 0; return; }
        chunks.push(c);
      });
      req.on("end", () => (over ? reject(Object.assign(new Error("request body too large"), { status: 413 })) : resolve(Buffer.concat(chunks).toString("utf8"))));
      req.on("error", reject);
    });
  }

  // ---- read side ----
  const latestRuns = (limit) => {
    const dir = path.join(hubAbs, "runs");
    let names = [];
    try { names = fs.readdirSync(dir).filter((n) => n.endsWith(".json") && RUN_ID_RE.test(n.slice(0, -5))); } catch { return []; }
    const recs = [];
    for (const n of names) {
      try {
        const { text } = readCapped(path.join(dir, n), 64 * 1024);
        const r = JSON.parse(text);
        if (r && typeof r === "object") recs.push({ ...r, id: n.slice(0, -5), mtime: fs.statSync(path.join(dir, n)).mtimeMs });
      } catch { /* a damaged record is skipped */ }
    }
    recs.sort((a, b) => String(b.started).localeCompare(String(a.started)) || b.mtime - a.mtime);
    return recs.slice(0, limit).map(({ mtime, ...r }) => ({ ...r, status: statusOf(r) }));
  };
  function statusOf(r) {
    if (active.has(r.id)) return "running";
    if (!r.ended) return "interrupted";
    if (r.timedOut) return "timed out";
    if (r.stopped) return "stopped";
    return r.exit === 0 ? "done" : "failed";
  }
  const listDir = (sub) => {
    const dir = path.join(hubAbs, sub);
    let names = [];
    try { names = fs.readdirSync(dir); } catch { return []; }
    return names.map((name) => {
      try {
        const full = path.join(dir, name);
        const st = fs.lstatSync(full);
        if (!st.isFile()) return null; // symlinks and folders are never followed
        const { text } = readCapped(full, 2048);
        return { dir: sub, name, mtime: st.mtimeMs, modified: st.mtime.toISOString(), firstLine: (text.split(/\r?\n/).find((l) => l.trim()) ?? "").slice(0, 200) };
      } catch { return null; }
    }).filter(Boolean);
  };
  function state() {
    const config = loadConfig(configFile);
    const runs = latestRuns(200);
    const workers = listWorkers(config).map((w) => {
      const last = runs.find((r) => r.role === w.role && (r.person ?? "") === w.person && (r.account ?? "") === w.account);
      return { person: w.person, role: w.role, account: w.account, headless: w.headless, lastRun: last ? { id: last.id, status: last.status, exit: last.exit, started: last.started } : null };
    });
    let queue = { text: "", truncated: false };
    try { queue = readCapped(path.join(hubAbs, "queue.md"), MAX_QUEUE); } catch { /* no queue yet */ }
    const handoffs = [...listDir("handoff"), ...listDir("notes")].sort((a, b) => b.mtime - a.mtime).slice(0, 30).map(({ mtime, ...h }) => h);
    const watches = listDir(".state").filter((f) => f.name.endsWith(".json")).map((f) => ({ name: f.name.replace(/\.json$/, ""), lastRun: f.modified }));
    const { errors, warnings } = checkPolicy(config);
    return {
      mode: config.mode,
      projects: Object.entries(config.projects).map(([id, p]) => ({ id, name: p.name, lead: p.lead, merge: p.merge, covers: p.covers, owners: p.owners, members: p.members })),
      workers, doctor: { errors, warnings }, queue, handoffs, watches, runs: runs.slice(0, 20),
    };
  }

  // ---- write side (start, preview, stop and nothing else) ----
  const bad = (m, status = 400) => Object.assign(new Error(m), { status });
  function parseRunBody(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) throw bad("expected a JSON object");
    const out = {};
    for (const k of ["role", "task"]) if (typeof body[k] !== "string" || !body[k].trim()) throw bad(`${k} is required (a string)`);
    for (const k of ["person", "account"]) if (body[k] !== undefined && typeof body[k] !== "string") throw bad(`${k} must be a string`);
    return { role: body.role, task: body.task, person: body.person ?? "", account: body.account ?? "" };
  }
  // The folder always comes from the config, never from the page.
  function build(b) {
    try { return buildRun({ config: loadConfig(configFile), hub: hubAbs, role: b.role, task: b.task, person: b.person, account: b.account }); }
    catch (e) { throw bad(e.message); }
  }
  const previewKey = (r) => sha(JSON.stringify([r.role, r.person, r.account, r.task, r.prompt, r.cwd, r.command, r.args.slice(0, r.promptVia === "arg" ? -1 : undefined), r.promptVia, r.timeoutMs])).toString("hex");
  const prune = () => { const t = Date.now(); for (const [k, v] of previews) if (v < t) previews.delete(k); };

  async function route(req, res, url) {
    const p = url.pathname;
    if (req.method === "GET") {
      if (STATIC[p]) {
        const [file, type] = STATIC[p];
        return sendText(res, 200, fs.readFileSync(path.join(HERE, "panel", file)), type);
      }
      if (p === "/api/state") return sendJson(res, 200, state());
      const m = /^\/api\/runs\/([^/]+)\/log$/.exec(p);
      if (m) {
        if (!RUN_ID_RE.test(m[1])) throw bad("bad run id");
        let r;
        try { r = readCapped(path.join(hubAbs, "runs", `${m[1]}.log`), MAX_LOG_READ); } catch { throw bad("no such log", 404); }
        return sendJson(res, 200, { id: m[1], log: r.text, truncated: r.truncated });
      }
      throw bad("not found", 404);
    }
    // POST: Origin and content type were checked before this point.
    let body;
    try { body = JSON.parse(await readBody(req)); } catch (e) { if (e.status) throw e; throw bad("body is not valid JSON"); }
    if (p === "/api/run/preview") {
      const r = build(parseRunBody(body));
      prune();
      previews.set(previewKey(r), Date.now() + PREVIEW_MS);
      return sendJson(res, 200, { preview: describeRun(r), expiresInSeconds: PREVIEW_MS / 1000 });
    }
    if (p === "/api/run/start") {
      if (body?.confirm !== true) throw bad("confirm must be true");
      const r = build(parseRunBody(body));
      prune();
      const key = previewKey(r);
      if (!previews.has(key)) throw bad("show the preview first (it may have expired, or the task or prompt changed since)", 409);
      let run;
      try { run = startRun(r, { execFileFn }); } catch (e) { throw bad(e.message, 409); }
      previews.delete(key);
      active.set(run.id, run);
      run.done.then(() => active.delete(run.id));
      return sendJson(res, 200, { id: run.id });
    }
    if (p === "/api/run/stop") {
      if (!body || typeof body.id !== "string" || !RUN_ID_RE.test(body.id)) throw bad("bad run id");
      const run = active.get(body.id);
      if (!run) throw bad("no such running run (the panel can only stop runs it started)", 404);
      run.stop();
      return sendJson(res, 200, { stopped: true });
    }
    throw bad("not found", 404);
  }

  const server = http.createServer(async (req, res) => {
    try {
      // 1. Host: stops DNS rebinding (a page on another name pointing at 127.0.0.1).
      if (!hostOk(req.headers.host)) return sendText(res, 403, "bad host");
      if (req.method !== "GET" && req.method !== "POST") return sendText(res, 405, "method not allowed", "text/plain; charset=utf-8", { Allow: "GET, POST" });
      const url = new URL(req.url, `http://${req.headers.host}`);
      // 2. Token: the first load carries it in the query and trades it for a cookie.
      if (req.method === "GET" && url.pathname === "/" && url.searchParams.has("token")) {
        if (!sameSecret(url.searchParams.get("token"), token)) return sendText(res, 401, "unauthorized");
        return sendText(res, 302, "", "text/plain; charset=utf-8", { Location: "/", "Set-Cookie": `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/` });
      }
      if (!authed(req)) return sendText(res, 401, "unauthorized");
      // 3. Writes: same-origin and JSON only.
      if (req.method === "POST") {
        if (!originOk(req.headers.origin)) return sendText(res, 403, "bad origin");
        if (!/^application\/json(?:\s*;|$)/i.test(String(req.headers["content-type"] ?? ""))) return sendText(res, 415, "content type must be application/json");
      }
      await route(req, res, url);
    } catch (e) {
      const status = e.status ?? 500;
      sendJson(res, status, { error: status === 500 ? "server error" : e.message });
    }
  });

  return {
    server, token,
    listen: () => new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => { boundPort = server.address().port; resolve(boundPort); });
    }),
    url: () => `http://127.0.0.1:${boundPort}/?token=${token}`,
    close: () => new Promise((resolve) => { for (const r of active.values()) r.stop(); server.closeAllConnections?.(); server.close(() => resolve()); }),
  };
}

async function main() {
  let flags;
  try {
    const parsed = parseArgs(process.argv.slice(2), ["help"]);
    flags = parsed.flags;
    if (parsed.positional.length) throw new Error(`unexpected argument "${parsed.positional[0]}"`);
  } catch (e) { console.error(e.message); process.exitCode = 2; return; }
  if (flags.help) {
    console.log(["Usage: node tools/panel.mjs --config <file> --hub <hub folder> [--port 4310]",
      "  Serves a control panel on 127.0.0.1 only. The address with its one-time token is printed once; open it in your browser."].join(String.fromCharCode(10)));
    return;
  }
  try {
    const configFile = typeof flags.config === "string" ? flags.config : "qa-projects.json";
    loadConfig(configFile);
    if (typeof flags.hub !== "string" || !fs.existsSync(flags.hub) || !fs.statSync(flags.hub).isDirectory()) throw new Error("--hub <hub folder> is required and must exist");
    const portText = flags.port === undefined ? "4310" : flags.port;
    if (typeof portText !== "string" || !/^\d{1,5}$/.test(portText) || Number(portText) > 65535) throw new Error("--port must be a number from 0 to 65535");
    const panel = createPanel({ configFile, hub: flags.hub, port: Number(portText) });
    await panel.listen();
    console.log(`Control panel: ${panel.url()}`);
    console.log("This address holds a one-time token. It is shown only now; keep it private. Stop the panel with Ctrl+C.");
  } catch (e) { console.error(e.message); process.exitCode = 2; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
