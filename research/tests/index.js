// Lets `node --test research/tests` work on Node versions that no longer accept a directory argument
// (they load this index.js, which imports every *.test.mjs here). Older versions find the *.test.mjs files themselves.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".test.mjs")).sort()) {
  await import(pathToFileURL(path.join(dir, f)).href);
}
