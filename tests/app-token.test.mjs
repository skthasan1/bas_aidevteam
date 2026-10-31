import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { makeJwt, getToken } from "../tools/app-token.mjs";
import { tmpDir } from "./helpers.mjs";

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" });

function setup() {
  const dir = tmpDir();
  const keyFile = path.join(dir, "app.pem");
  fs.writeFileSync(keyFile, pem);
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, method: opts.method, auth: opts.headers.Authorization });
    const res = (status, body) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
    if (url.endsWith("/repos/acme/web/installation")) return res(200, { id: 77 });
    if (url.endsWith("/users/dana/installation")) return res(404, { message: "Not Found" });
    if (url.endsWith("/orgs/acme/installation")) return res(200, { id: 78 });
    if (url.endsWith("/app/installations/77/access_tokens") || url.endsWith("/app/installations/78/access_tokens")) return res(201, { token: "tok-" + url.split("/").at(-2), expires_at: new Date(Date.now() + 3600e3).toISOString() });
    return res(404, { message: "Not Found" });
  };
  return { dir, keyFile, calls, fetchImpl, cacheDir: path.join(dir, "cache") };
}

test("the JWT is RS256, names the app, lasts under ten minutes and verifies with the public key", () => {
  const now = 1_700_000_000;
  const [h, b, s] = makeJwt(123, pem, now).split(".");
  assert.deepEqual(JSON.parse(Buffer.from(h, "base64url")), { alg: "RS256", typ: "JWT" });
  const body = JSON.parse(Buffer.from(b, "base64url"));
  assert.equal(body.iss, "123");
  assert.ok(body.exp - body.iat <= 600);
  assert.ok(crypto.createVerify("RSA-SHA256").update(`${h}.${b}`).verify(publicKey, s, "base64url"));
});

test("getToken finds the installation for a repo, returns the token and caches it", async () => {
  const s = setup();
  const t1 = await getToken({ appId: 123, keyFile: s.keyFile, repo: "acme/web", fetchImpl: s.fetchImpl, cacheDir: s.cacheDir });
  assert.equal(t1, "tok-77");
  assert.equal(s.calls.length, 2);
  assert.match(s.calls[0].auth, /^Bearer ey/);
  const t2 = await getToken({ appId: 123, keyFile: s.keyFile, repo: "acme/web", fetchImpl: s.fetchImpl, cacheDir: s.cacheDir });
  assert.equal(t2, "tok-77");
  assert.equal(s.calls.length, 2, "second call uses the cache");
});

test("an expired or nearly expired cache is not used", async () => {
  const s = setup();
  fs.mkdirSync(s.cacheDir, { recursive: true });
  fs.writeFileSync(path.join(s.cacheDir, "123-acme.json"), JSON.stringify({ token: "old", expires_at: new Date(Date.now() + 60e3).toISOString() }));
  assert.equal(await getToken({ appId: 123, keyFile: s.keyFile, repo: "acme/web", fetchImpl: s.fetchImpl, cacheDir: s.cacheDir }), "tok-77");
});

test("--owner tries a user installation, then an organization", async () => {
  const s = setup();
  assert.equal(await getToken({ appId: 123, keyFile: s.keyFile, owner: "acme", fetchImpl: s.fetchImpl, cacheDir: s.cacheDir }), "tok-78");
});

test("bad input fails clearly and never mentions the key contents", async () => {
  const s = setup();
  await assert.rejects(getToken({ appId: "abc", keyFile: s.keyFile, repo: "acme/web", fetchImpl: s.fetchImpl }), /numeric ID/);
  await assert.rejects(getToken({ appId: 1, repo: "acme/web", fetchImpl: s.fetchImpl }), /key-file/);
  await assert.rejects(getToken({ appId: 1, keyFile: s.keyFile }), /--repo owner\/name or --owner/);
  await assert.rejects(getToken({ appId: 1, keyFile: s.keyFile, repo: "bad repo" }), /owner\/name/);
  await assert.rejects(getToken({ appId: 1, keyFile: path.join(s.dir, "missing.pem"), repo: "acme/web", fetchImpl: s.fetchImpl, cacheDir: s.cacheDir }), (e) => /cannot read the key file/.test(e.message) && !e.message.includes("PRIVATE"));
  await assert.rejects(getToken({ appId: 1, keyFile: s.keyFile, repo: "acme/nope", fetchImpl: s.fetchImpl, cacheDir: s.cacheDir }), /404/);
});
