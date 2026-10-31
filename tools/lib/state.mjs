// Small local state files (what a watch has already seen). Never committed: see .gitignore.
import fs from "node:fs";
import path from "node:path";

export function readState(dir, name, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), "utf8")); } catch { return fallback; }
}

export function writeState(dir, name, value) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(value, null, 1) + "\n");
}
