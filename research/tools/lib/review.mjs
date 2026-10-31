// The "How to review" block for blind evidence pages. Shared by the page builder and the check tool.
// Spec field "review": { compare, questions[], guess, cues?, people?, scale? } (see templates/blind-review-instructions.md).

const filled = (v) => typeof v === "string" && v.trim().length > 0;

export function reviewProblems(spec) {
  const r = spec && spec.review;
  if (!r || typeof r !== "object") return ["no review block (spec.review)"];
  const p = [];
  if (!filled(r.compare)) p.push("review.compare is empty (what is being compared, no mapping)");
  if (!Array.isArray(r.questions) || r.questions.filter(filled).length === 0) p.push("review.questions is empty (the question per file)");
  if (!filled(r.guess)) p.push("review.guess is empty (the guess written down before the key is opened)");
  return p;
}

export const steps = (scale) => [
  "Look at or listen to each file twice (sound on for clips).",
  `Work on your own first: before any discussion, score each file ${scale} and write what you noticed. Do not say out loud how you think the files were made.`,
  "Answer the questions below for each file.",
  "Write down your guess (below) before the key is opened.",
  "Then the team discusses the scores together.",
  "Only after that, the key is opened and the result is decoded.",
];

const itemLabels = (spec) =>
  (spec.sections || []).flatMap((s) => (s.items || []).map((it) => it.caption || it.path || "")).filter(Boolean);

// esc and md come from the builder
export function reviewHtml(spec, esc, md) {
  const r = spec.review;
  const files = itemLabels(spec);
  const scale = r.scale || "1 (worst) to 5 (best)";
  const people = Number(r.people) > 0 ? Number(r.people) : 4;
  const head = files.map((f) => `<th>${esc(f)}</th>`).join("");
  const blankRow = `<tr><td class="blank"></td>${files.map(() => '<td class="blank"></td>').join("")}<td class="blank wide"></td><td class="blank wide"></td></tr>`;
  const rows = Array.from({ length: people }, () => blankRow).join("");
  return `<section class="card review" aria-labelledby="howto"><h2 id="howto">How to review</h2>`
    + `<p>${md(r.compare)}</p>`
    + `<ol>${steps(scale).map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`
    + `<p><b>Questions for each file:</b></p><ul>${r.questions.filter(filled).map((q) => `<li>${md(q)}</li>`).join("")}</ul>`
    + `<p><b>Your guess (write it down before the key is opened):</b> ${md(r.guess)}</p>`
    + (filled(r.cues) ? `<p>${md(r.cues)}</p>` : "")
    + `<div class="tw"><table class="score"><thead><tr><th>Person</th>${head}<th>What I noticed</th><th>Guess</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

export const reviewMissingHtml = (problems, esc) =>
  `<section class="alert"><h2>No review instructions on this page</h2><p>${esc("This blind page has no usable review block, so judges are not told how to score. Missing: " + problems.join("; ") + ".")}</p></section>`;
