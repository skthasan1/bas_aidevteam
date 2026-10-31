// Evidence page builder. Node 20+, no dependencies.
//   node build-evidence-page.mjs <spec.json> <out.html>
// Turns an evidence spec into ONE static HTML page. Media are referenced by relative path (relative to the page), never embedded.
//   Non-blind spec: decision board first (idea, verdict chip, evidence, owner, action), then one block per test.
//   Blind spec ("blind": true): no board, no verdicts, no costs; neutral item names (t1-1, t1-2 ...); a REQUIRED "How to review"
//   block (spec.review) and an empty score table. A blind spec without a usable review block makes the build fail.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reviewProblems, reviewHtml } from "./lib/review.mjs";

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const md = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");

const CHIPS = {
  adopt: "Adopt", more: "Test more", drop: "Drop", fix: "Fix", inconclusive: "Inconclusive", decide: "Decide", found: "Found",
};
const chipKey = (v) => {
  const k = String(v ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (k === "testmore") return "more";
  return CHIPS[k] ? k : "inconclusive";
};

const CSS = `
:root{--bg:#fff;--fg:#1b1f24;--muted:#5b6570;--card:#f5f7f9;--line:#d8dee4;--accent:#1f6feb;--ok:#1a7f37;--warn:#9a6700;--bad:#cf222e}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0e1116;--fg:#e6edf3;--muted:#9aa4af;--card:#161b22;--line:#30363d;--accent:#58a6ff;--ok:#3fb950;--warn:#d29922;--bad:#f85149}}
:root[data-theme="dark"]{--bg:#0e1116;--fg:#e6edf3;--muted:#9aa4af;--card:#161b22;--line:#30363d;--accent:#58a6ff;--ok:#3fb950;--warn:#d29922;--bad:#f85149}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}
main{max-width:980px;margin:0 auto;padding:16px}h1{font-size:1.6rem;margin:.2em 0}h2{font-size:1.2rem}
.meta{color:var(--muted);font-size:.9rem}.card,.alert{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin:16px 0}
.alert{border-color:var(--bad)}table{border-collapse:collapse;width:100%}th,td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
.tw{overflow-x:auto}.blank{height:2.2em;min-width:3em}.blank.wide{min-width:10em}
.chip{display:inline-block;border-radius:999px;padding:1px 10px;font-size:.85rem;font-weight:600;border:1px solid var(--line)}
.chip.adopt{color:var(--ok)}.chip.more,.chip.decide{color:var(--warn)}.chip.drop,.chip.fix{color:var(--bad)}.chip.inconclusive,.chip.found{color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}figure{margin:0}img,video{max-width:100%;height:auto;border-radius:6px}
figcaption{color:var(--muted);font-size:.9rem}code{background:var(--card);padding:0 4px;border-radius:4px}
`;

// "Neutral names": t<section>-<item>, regardless of what the spec's captions say.
export function blindCopy(spec) {
  const sections = (spec.sections || []).map((s, si) => ({
    ...s,
    tag: `t${si + 1}`,
    cost: undefined,
    items: (s.items || []).map((it, ii) => ({ ...it, caption: `t${si + 1}-${ii + 1}` })),
  }));
  return { ...spec, sections };
}

const HINTS = new Set(["a", "b", "c", "control", "baseline", "variant", "new", "old"]);

// Paths that give a variant away (for example "...-A.png", "variant", "control") are reported as warnings.
export function blindWarnings(spec) {
  const w = [];
  for (const s of spec.sections || []) {
    for (const it of s.items || []) {
      const stem = path.basename(String(it.path || "")).toLowerCase().replace(/\.[a-z0-9]+$/, "");
      if (stem.split(/[-_. ]+/).some((tok) => HINTS.has(tok))) {
        w.push(`blind item path may reveal its variant: ${it.path} (use a neutral file name)`);
      }
    }
  }
  return w;
}

function itemHtml(it, label) {
  const src = esc(it.path);
  const cap = `<figcaption>${esc(label)}</figcaption>`;
  if (it.kind === "video") return `<figure><video controls preload="metadata" src="${src}"></video>${cap}</figure>`;
  if (it.kind === "audio") return `<figure><audio controls preload="none" src="${src}"></audio>${cap}</figure>`;
  return `<figure><a href="${src}"><img loading="lazy" src="${src}" alt="${esc(label)}"></a>${cap}</figure>`;
}

function sectionHtml(s, blind) {
  return `<section class="card"><h2>${esc(s.tag ? s.tag + ": " : "")}${esc(s.title || "")}</h2>`
    + (!blind && s.cost ? `<p class="meta">${esc(s.cost)}</p>` : "")
    + (s.text ? `<p>${md(s.text)}</p>` : "")
    + (s.question ? `<p><b>Look for:</b> ${md(s.question)}</p>` : "")
    + `<div class="grid">${(s.items || []).map((it) => itemHtml(it, it.caption || it.path || "")).join("")}</div></section>`;
}

function boardHtml(board) {
  if (!board) return "";
  const rows = (board.rows || []).map((r) => {
    const k = chipKey(r.verdict);
    return `<tr><td>${md(r.idea)}</td><td><span class="chip ${k}">${CHIPS[k]}</span></td><td>${md(r.evidence)}</td><td>${esc(r.owner || "")}</td><td>${md(r.action || "")}</td></tr>`;
  }).join("");
  return `<section class="card"><h2>Decision board</h2>${board.intro ? `<p>${md(board.intro)}</p>` : ""}`
    + `<div class="tw"><table><thead><tr><th>Idea</th><th>Verdict</th><th>Evidence</th><th>Owner</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

// Returns { html, warnings }. Throws for a blind spec without a usable review block.
export function buildPage(specIn) {
  const blind = specIn.blind === true;
  const warnings = [];
  let spec = specIn;
  let body = "";
  if (blind) {
    const problems = reviewProblems(specIn);
    if (problems.length) throw new Error(`blind page needs a review block: ${problems.join("; ")}`);
    warnings.push(...blindWarnings(specIn));
    spec = blindCopy(specIn);
    body = reviewHtml(spec, esc, md) + spec.sections.map((s) => sectionHtml(s, true)).join("");
  } else {
    body = boardHtml(spec.board) + (spec.sections || []).map((s) => sectionHtml(s, false)).join("");
  }
  const meta = blind ? [] : spec.meta || [];
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(spec.title || "Evidence page")}</title><style>${CSS}</style></head>
<body><main>
<h1>${esc(spec.heading || spec.title || "Evidence page")}</h1>
${meta.length ? `<p class="meta">${meta.map(esc).join(" · ")}</p>` : ""}
${blind ? '<p class="meta">Blind sheet: item names are neutral on purpose.</p>' : ""}
${spec.lede ? `<p>${md(spec.lede)}</p>` : ""}
${body}
</main></body></html>
`;
  return { html, warnings };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [specFile, outFile] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!specFile || !outFile) {
    console.error("usage: node build-evidence-page.mjs <spec.json> <out.html>");
    process.exit(1);
  }
  try {
    const { html, warnings } = buildPage(JSON.parse(fs.readFileSync(specFile, "utf8")));
    warnings.forEach((w) => console.warn(`warning: ${w}`));
    fs.writeFileSync(outFile, html);
    console.log(`wrote ${outFile}`);
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}
