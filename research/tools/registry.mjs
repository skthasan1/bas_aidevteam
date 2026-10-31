// Test registry: add, set, find and list entries in a JSON file. Node 20+, no dependencies.
//   node registry.mjs list [--status s] --file registry.json
//   node registry.mjs find <words> --file registry.json
//   node registry.mjs add --file registry.json --id R-001-T1 --idea "..." [--source .. --date .. --question .. --models .. --variants ..
//                          --sample .. --cost 1.5 --status planned --result .. --evidence .. --tags a,b --action ..]
//   node registry.mjs set <id> --file registry.json --status judged --action "no action: reason" [--result ..]
// Rule: status "judged" needs a non-empty action line (an issue reference, or "no action: <reason>").
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STATUSES = ["planned", "run-pending-judges", "measured", "judged", "inconclusive", "superseded"];
export const FIELDS = ["id", "source", "date", "idea", "question", "models", "variants", "sample", "cost", "status", "result", "evidence", "tags", "action"];

export function emptyRegistry() {
  return { note: "Every test run or planned. Edit with research/tools/registry.mjs.", tests: [] };
}

export function loadRegistry(file) {
  if (!fs.existsSync(file)) return emptyRegistry();
  const reg = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!reg || !Array.isArray(reg.tests)) throw new Error(`${file}: not a registry (no "tests" array)`);
  return reg;
}

export function saveRegistry(file, reg) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(reg, null, 2) + "\n");
}

const has = (v) => typeof v === "string" && v.trim().length > 0;

// Returns a list of problems with one entry (empty list = fine).
export function entryProblems(e) {
  const p = [];
  if (!has(e.id)) p.push("id is required");
  if (!has(e.idea)) p.push("idea is required");
  if (e.status !== undefined && !STATUSES.includes(e.status)) p.push(`status must be one of: ${STATUSES.join(", ")}`);
  if (e.status === "judged" && !has(e.action)) {
    p.push('status "judged" needs an action line (an issue reference, or "no action: <reason>")');
  }
  if (e.cost !== null && e.cost !== undefined && typeof e.cost !== "number") p.push("cost must be a number or null");
  if (e.tags !== undefined && !Array.isArray(e.tags)) p.push("tags must be a list");
  return p;
}

function normalise(input) {
  const e = {
    id: "", source: "", date: new Date().toISOString().slice(0, 10), idea: "", question: "", models: "", variants: "",
    sample: "", cost: null, status: "planned", result: "", evidence: "", tags: [], action: "",
  };
  for (const k of FIELDS) if (input[k] !== undefined) e[k] = input[k];
  if (typeof e.tags === "string") e.tags = e.tags.split(",").map((t) => t.trim()).filter(Boolean);
  if (typeof e.cost === "string") e.cost = e.cost.trim() === "" ? null : Number(e.cost);
  if (typeof e.cost === "number" && Number.isNaN(e.cost)) throw new Error("cost must be a number");
  return e;
}

export function addTest(reg, input) {
  const e = normalise(input);
  const problems = entryProblems(e);
  if (problems.length) throw new Error(`cannot add: ${problems.join("; ")}`);
  if (reg.tests.some((t) => t.id === e.id)) throw new Error(`cannot add: id ${e.id} already exists`);
  reg.tests.push(e);
  return e;
}

export function setField(reg, id, changes) {
  const i = reg.tests.findIndex((t) => t.id === id);
  if (i < 0) throw new Error(`no test with id ${id}`);
  const unknown = Object.keys(changes).filter((k) => !FIELDS.includes(k) || k === "id");
  if (unknown.length) throw new Error(`cannot set: ${unknown.join(", ")}`);
  const merged = normalise({ ...reg.tests[i], ...changes });
  const problems = entryProblems(merged);
  if (problems.length) throw new Error(`cannot set ${id}: ${problems.join("; ")}`);
  reg.tests[i] = merged;
  return merged;
}

export function listTests(reg, { status } = {}) {
  return reg.tests.filter((t) => !status || t.status === status);
}

export function findTests(reg, words) {
  const ws = String(words).toLowerCase().split(/\s+/).filter(Boolean);
  if (!ws.length) return [];
  return reg.tests.filter((t) => {
    const hay = [t.id, t.source, t.idea, t.question, t.models, t.variants, t.result, ...(t.tags || [])].join(" ").toLowerCase();
    return ws.every((w) => hay.includes(w));
  });
}

function parseArgs(argv) {
  const pos = [];
  const opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) opt[k] = "";
      else { opt[k] = next; i++; }
    } else pos.push(a);
  }
  return { pos, opt };
}

const line = (t) => `${t.id}  [${t.status}]  ${t.idea}${t.action ? `  -> ${t.action}` : ""}`;

export function main(argv, out = console.log) {
  const { pos, opt } = parseArgs(argv);
  const [cmd, ...rest] = pos;
  if (!cmd || !opt.file) throw new Error("usage: registry.mjs <list|find|add|set> ... --file <registry.json>");
  const reg = loadRegistry(opt.file);
  const { file, ...fields } = opt;
  if (cmd === "list") {
    listTests(reg, { status: fields.status }).forEach((t) => out(line(t)));
  } else if (cmd === "find") {
    const hits = findTests(reg, rest.join(" "));
    if (!hits.length) out("not run before");
    hits.forEach((t) => out(line(t)));
  } else if (cmd === "add") {
    const e = addTest(reg, fields);
    saveRegistry(file, reg);
    out(`added ${e.id}`);
  } else if (cmd === "set") {
    if (!rest[0]) throw new Error("usage: registry.mjs set <id> --file ... --field value");
    const e = setField(reg, rest[0], fields);
    saveRegistry(file, reg);
    out(`updated ${e.id} [${e.status}]`);
  } else throw new Error(`unknown command: ${cmd}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (err) { console.error(`error: ${err.message}`); process.exit(1); }
}
