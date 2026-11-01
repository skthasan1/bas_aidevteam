// The security read: which pull requests need it, and where the security role's answer stands for the CURRENT head.
// A pull request is "T3" when its changed files touch a security area (docs/PROTOCOL.md section 5). Documents alone are not a security surface.
// The security role answers with a pull request comment whose FIRST LINE is
//   Security read by <name> (<what it is>): CLEARED at <full head sha>
//   Security read by <name> (<what it is>): FINDINGS at <full head sha>: <what>
// A newer commit after that makes the answer STALE. Read-only: only "gh api" GETs. The helpers take the gh wrapper as an argument so tests can fake it.

// Default areas. A team can replace or extend them with config.security_read.areas: { "<name>": "<regex source>" }.
export const DEFAULT_AREAS = {
  "sign-in/session": "(^|/)(auth|authn|authz|session|sessions|login|signin|sign-in|oauth|sso|jwt|middleware|permissions?|rbac|acl|guards?)([/._-]|$)",
  "secrets/keys": "(secret|credential|\\.env|vault|keystore|\\bkms\\b|private[-_]?key)",
  "payments/money": "(payment|billing|stripe|checkout|invoice|pricing|ledger|spend[-_]guard)",
  "database schema": "(^|/)(migrations?|prisma)/|schema\\.(prisma|sql)$|\\.sql$",
  "security headers/config": "(security-headers|next\\.config|\\bcsp\\b|\\bcors\\b|helmet|nginx|\\.npmrc)",
  "deploy/release": "(^\\.github/workflows/|dockerfile|docker-compose|terraform|\\.tf$|vercel\\.json|task-definition|cloudformation|(^|/)deploy)",
};

export function compileAreas(extra = {}) {
  const src = { ...DEFAULT_AREAS, ...extra };
  return Object.entries(src).map(([name, source]) => [name, new RegExp(source, "i")]);
}

export function t3Areas(files, areas = compileAreas()) {
  const hit = new Set();
  for (const f of files) {
    if (/\.md$/i.test(f) || /^docs\//i.test(f)) continue;
    for (const [name, re] of areas) if (re.test(f)) hit.add(name);
  }
  return [...hit];
}

const SECURITY_READ = /Security read by [^:\n]*:\s*(CLEARED|FINDINGS) at ([0-9a-f]{7,40})/i;

// bodies: the texts of the security role's comments, oldest first. The last one that matches wins.
export function parseSecurityRead(bodies, headSha) {
  let tony = "NONE", sha = "";
  for (const b of bodies) {
    const m = SECURITY_READ.exec(String(b).split("\n")[0]);
    if (m) { tony = m[1].toUpperCase(); sha = m[2].toLowerCase(); }
  }
  const head = String(headSha || "").toLowerCase();
  if (tony !== "NONE" && !(head.startsWith(sha) || sha.startsWith(head.slice(0, 7)))) tony = "STALE";
  return { status: tony, sha };
}

// -> { files, areas, status: "NOT_T3" | "NONE" | "CLEARED" | "FINDINGS" | "STALE", sha }
export function t3Status({ gh, repo, number, headSha, securityLogin, areas = compileAreas() }) {
  const out = gh.run(["api", `repos/${repo}/pulls/${number}/files`, "--paginate", "--jq", ".[].filename"]) || "";
  const files = out.split("\n").map((s) => s.trim()).filter(Boolean);
  const hit = t3Areas(files, areas);
  if (!hit.length) return { files, areas: hit, status: "NOT_T3", sha: "" };
  const login = String(securityLogin).replace(/[^A-Za-z0-9[\]_-]/g, ""); // a login can contain only these; nothing else reaches the jq filter
  const jq = `.[]|select(.user.login=="${login}")|.body|split("\\n")[0]`;
  const lines = (gh.run(["api", `repos/${repo}/issues/${number}/comments`, "--paginate", "--jq", jq]) || "").split("\n").filter(Boolean);
  const r = parseSecurityRead(lines, headSha);
  return { files, areas: hit, status: r.status, sha: r.sha };
}

export const T3_HINT = {
  NONE: "no security read yet: ask the security role before any merge",
  STALE: "the head changed after the security read: ask for a new read of the new head",
  FINDINGS: "the security role has open findings on this head: not merge-ready",
  CLEARED: "security read clears this head",
};
