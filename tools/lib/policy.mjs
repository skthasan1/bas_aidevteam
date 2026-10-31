// Project policy checks and the "mine" view: who owns a project, who leads it, who may merge, and what a given person's AI may do there.
import fs from "node:fs";
import path from "node:path";

const lower = (s) => String(s).toLowerCase();

// Role of a person (by handle) in one project: "owner", "member" or "none".
export function roleIn(project, handle) {
  const h = lower(handle);
  if ((project.owners ?? []).some((o) => lower(o) === h)) return "owner";
  if ((project.members ?? []).some((m) => lower(m) === h)) return "member";
  return "none";
}

// What the person's own lead AI may do in a project, from the person's role and the project's merge policy.
export function powersOf(project, handle) {
  const role = roleIn(project, handle);
  if (role === "none") return { role, review: false, merge: "never", note: "no access: public information and a contact card only" };
  if (role === "owner") return { role, review: true, merge: project.merge, note: "owner: spend, releases and access still need your own yes" };
  return { role, review: true, merge: "never", note: "member: reviews and tests own work; clears or merges others' work only if the owner granted it in writing" };
}

// The projects a person owns or belongs to, with their role and merge power.
export function mineView(config, handle) {
  return Object.entries(config.projects)
    .map(([id, p]) => ({ id, name: p.name, lead: p.lead, ...powersOf(p, handle) }))
    .filter((r) => r.role !== "none");
}

// The AI workers a person runs. With no "people" entry the person uses the organization's roles.
export function workersOf(config, handle) {
  const key = Object.keys(config.people).find((k) => lower(k) === lower(handle));
  return key ? config.people[key].roles : config.roles;
}

// Offline checks of the policy in the config. Returns { errors, warnings }.
export function checkPolicy(config) {
  const errors = [];
  const warnings = [];
  const aiAccounts = new Set([...config.ai_accounts, ...config.roles.map((r) => r.account).filter(Boolean)].map(lower));
  for (const [id, p] of Object.entries(config.projects)) {
    const at = `projects.${id}`;
    if (config.mode === "solo") {
      if (p.owners.length !== 1) errors.push(`${at}: solo mode needs exactly one owner (found ${p.owners.length})`);
      if (p.members.length) errors.push(`${at}: solo mode has no members; switch to mode "team" to add people`);
    } else if (!p.lead) errors.push(`${at}: team mode needs one lead AI account (set "lead")`);
    if (p.lead && !aiAccounts.has(lower(p.lead))) errors.push(`${at}.lead "${p.lead}" is not one of the organization's AI accounts`);
    if (p.lead && [...p.owners, ...p.members].some((h) => lower(h) === lower(p.lead))) errors.push(`${at}.lead "${p.lead}" is also listed as a person; the lead must be an AI account`);
    if (p.watch === "merge" && p.merge === "owner-only") errors.push(`${at}: watch is "merge" but merge is "owner-only", so the watch would never be allowed to merge (set merge to lead-after-conditions or lead-on-owner-word)`);
    if (p.merge !== "owner-only" && !p.lead) errors.push(`${at}: merge is "${p.merge}" but no lead AI account is named`);
    if (p.merge === "lead-after-conditions" && p.testing === "later") warnings.push(`${at}: the lead merges on conditions but QA testing is "later"; consider "active"`);
  }
  const seen = new Map();
  for (const [handle, { roles }] of Object.entries(config.people)) {
    if (roles.length === 0) warnings.push(`people.${handle}: no AI workers chosen`);
    for (const w of roles) {
      if (!w.account) continue;
      if (!aiAccounts.has(lower(w.account))) errors.push(`people.${handle}: account "${w.account}" is not one of the organization's AI accounts`);
      if (seen.has(lower(w.account))) errors.push(`people.${handle}: account "${w.account}" is also used by ${seen.get(lower(w.account))}; one identity per AI worker`);
      seen.set(lower(w.account), handle);
    }
    const names = roles.map((w) => w.name);
    if (!names.includes("qa-lead")) warnings.push(`people.${handle}: no qa-lead, so tests are this person's own; changes in the sensitive tiers (T2, T3) still need a person's own read`);
    if (!names.includes("security-lead")) warnings.push(`people.${handle}: no security-lead; use the pull request template's security section and the baseline checks`);
  }
  return { errors, warnings };
}

// Checks that a repository folder carries the guardrail files that stand in for a watching person.
export function checkRepoGuardrails(dir) {
  const must = [
    [".github/pull_request_template.md", "the pull request template"],
    [".github/workflows/checks.yml", "the baseline checks workflow"],
    [".github/CODEOWNERS", "CODEOWNERS"],
  ];
  const errors = [];
  for (const [rel, what] of must) if (!fs.existsSync(path.join(dir, rel))) errors.push(`${what} is missing (${rel}); copy it from templates/repo`);
  return { errors, warnings: [] };
}
