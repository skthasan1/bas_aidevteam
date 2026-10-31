// Project policy checks and the "mine" view: who owns a project, who leads it, who may merge, and what a given person's AI may do there.
import fs from "node:fs";
import path from "node:path";
import { FUNCTIONS } from "./config.mjs";

const lower = (s) => String(s).toLowerCase();
// Which AI roles can cover each function.
const ROLE_FOR = { review: ["tech-lead"], test: ["qa-lead"], security: ["security-lead"], decision: [] };

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
  // Every AI identity named anywhere, including worker accounts listed under people (used to keep humans and AIs apart).
  const anyAi = new Set([...aiAccounts, ...Object.values(config.people).flatMap((x) => x.roles.map((w) => w.account).filter(Boolean)).map(lower)]);
  const personHandles = new Set([...config.owner.handles, ...Object.keys(config.people)].map(lower));
  for (const [id, p] of Object.entries(config.projects)) {
    const at = `projects.${id}`;
    if (p.dormant) { warnings.push(`${at}: ${p.testing === "archived" ? "archived" : "planned, no repositories yet"}; no lead, merge or coverage rules are checked until it becomes active`); continue; }
    if (config.mode === "solo") {
      if (p.owners.length !== 1) errors.push(`${at}: solo mode needs exactly one owner (found ${p.owners.length})`);
      if (p.members.length) errors.push(`${at}: solo mode has no members; switch to mode "team" to add people`);
    } else if (!p.lead) errors.push(`${at}: team mode needs one lead AI account (set "lead")`);
    if (p.lead && !aiAccounts.has(lower(p.lead))) errors.push(`${at}.lead "${p.lead}" is not one of the organization's AI accounts`);
    if (p.lead && ([...p.owners, ...p.members].some((h) => lower(h) === lower(p.lead)) || personHandles.has(lower(p.lead)))) errors.push(`${at}.lead "${p.lead}" is also listed as a person; the lead must be an AI account`);
    // A person (owner, member or a covering person:) must never be an AI account: an AI cannot be the human who decides.
    for (const h of [...p.owners, ...p.members]) if (anyAi.has(lower(h))) errors.push(`${at}: "${h}" is an AI account but is listed as an owner or member; owners and members must be people`);
    if (p.watch === "merge" && p.merge === "owner-only") errors.push(`${at}: watch is "merge" but merge is "owner-only", so the watch would never be allowed to merge (set merge to lead-after-conditions or lead-on-owner-word)`);
    if (p.merge !== "owner-only" && !p.lead) errors.push(`${at}: merge is "${p.merge}" but no lead AI account is named`);
    if (p.merge === "lead-after-conditions" && p.testing === "later") warnings.push(`${at}: the lead merges on conditions but QA testing is "later"; consider "active"`);
  }
  // Every function must be covered in every project, by a role somebody runs or a named person. A check alone never covers one.
  const runRoles = new Set([...config.roles.map((r) => r.name), ...Object.values(config.people).flatMap((x) => x.roles.map((w) => w.name))]);
  const hasPeople = Object.keys(config.people).length > 0;
  for (const [id, p] of Object.entries(config.projects)) {
    if (p.dormant) continue;
    const at = `projects.${id}.covers`;
    const people = new Set([...p.owners, ...p.members].map(lower));
    // Roles somebody in this project runs. With a "people" section: each owner or member brings their own workers; an owner without an entry
    // uses the organization-level roles. Without "people": every role of the organization counts.
    const projectRoles = new Set();
    for (const h of [...p.owners, ...p.members]) {
      const key = Object.keys(config.people).find((k) => lower(k) === lower(h));
      if (key) config.people[key].roles.forEach((w) => projectRoles.add(w.name));
      else if (p.owners.some((o) => lower(o) === lower(h))) config.roles.forEach((r) => projectRoles.add(r.name));
    }
    for (const fn of FUNCTIONS) {
      const vs = [].concat(p.covers[fn] ?? []);
      if (vs.length === 0) { errors.push(`${at}.${fn} is missing: every project must say who covers ${fn} (role:<role> or person:<handle>, or a list)`); continue; }
      for (const v of vs) {
      const [kind, who] = v.split(":");
      if (kind === "role" && !ROLE_FOR[fn].includes(who)) errors.push(`${at}.${fn}: role "${who}" does not do ${fn} (use one of ${ROLE_FOR[fn].join(", ")}, or a person)`);
      else if (kind === "role" && !runRoles.has(who)) errors.push(`${at}.${fn}: nobody runs the role "${who}"; add it to roles or people, or name a person`);
      else if (kind === "role" && hasPeople && !projectRoles.has(who)) errors.push(`${at}.${fn}: nobody in this project runs ${who}; an owner or member must run it (people), or name a person`);
      if (kind === "person" && anyAi.has(lower(who))) errors.push(`${at}.${fn}: "${who}" is an AI account; person: must name a human`);
      if (kind === "person" && !people.has(lower(who))) errors.push(`${at}.${fn}: "${who}" is not an owner or member of this project`);
      }
    }
    // Decisions may be shared by several people, and split by area (for example merges and spend). Every decider is a human owner.
    const owners = p.owners.map(lower);
    for (const d of [].concat(p.covers.decision ?? [])) {
      if (!d.startsWith("person:")) errors.push(`${at}.decision must be a person: spend, releases, access and irreversible actions are never an AI's call`);
      else if (!owners.includes(lower(d.split(":")[1]))) errors.push(`${at}.decision must be an owner of the project (${d})`);
    }
    for (const [area, v] of Object.entries(p.decision_areas ?? {})) for (const d of [].concat(v)) {
      const who = d.split(":")[1];
      if (anyAi.has(lower(who))) errors.push(`${at}.decision_areas.${area}: "${who}" is an AI account; deciders are humans`);
      else if (!owners.includes(lower(who))) errors.push(`${at}.decision_areas.${area}: "${who}" must be an owner of the project`);
    }
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
  }
  // Headless runs: write-branch is for ai-developer only, and a runner must be configured for any headless worker.
  const allWorkers = [...config.roles.map((w) => ({ ...w, at: `roles.${w.name}` })), ...Object.entries(config.people).flatMap(([h, x]) => x.roles.map((w) => ({ ...w, at: `people.${h}.${w.name}` })))];
  for (const w of allWorkers) if (w.headless === "write-branch" && w.name !== "ai-developer") errors.push(`${w.at}: headless "write-branch" is only for ai-developer; ${w.name} can run headless as "read-only" at most`);
  for (const w of allWorkers) if (w.surface === "background" && !w.headless) errors.push(`${w.at}: surface is "background" but headless is not set; set headless to "read-only" (or "write-branch" for ai-developer)`);
  if (!config.runner && allWorkers.some((w) => w.headless)) errors.push('some worker is headless but the config has no "runner" (command and arguments of the agent to run)');
  checkIdentityShapes(config, errors, warnings);
  return { errors, warnings };
}

// The workers that actually run: each person's own when there is a "people" section, else the organization's roles.
export function effectiveWorkers(config) {
  const hasPeople = Object.keys(config.people).length > 0;
  return hasPeople
    ? Object.entries(config.people).flatMap(([h, x]) => x.roles.map((w) => ({ ...w, at: `people.${h}.${w.name}` })))
    : config.roles.map((w) => ({ ...w, at: `roles.${w.name}` }));
}

// Identity checks that need no files: one identity per AI, the key file's extension, and a worker with no identity at all.
// (Where a key file sits is checked in identities.mjs, because that needs the file system. A key's contents are never read.)
function checkIdentityShapes(config, errors, warnings) {
  const workers = effectiveWorkers(config);
  const byApp = new Map();
  const byAccount = new Map();
  const hasPeople = Object.keys(config.people).length > 0;
  for (const w of workers) {
    if (w.app) {
      if (byApp.has(w.app.id)) errors.push(`${w.at}: App ${w.app.id} is also used by ${byApp.get(w.app.id)}; one identity per AI worker (give each worker its own App)`);
      else byApp.set(w.app.id, w.at);
      if (path.extname(w.app.key_file).toLowerCase() !== ".pem") errors.push(`${w.at}.app.key_file must be a .pem file (the private key GitHub gives you when you generate one)`);
    }
    // With a "people" section the loop above already reports a shared account; without one it is checked here.
    if (!hasPeople && w.account) {
      if (byAccount.has(lower(w.account))) errors.push(`${w.at}: account "${w.account}" is also used by ${byAccount.get(lower(w.account))}; one identity per AI worker`);
      else byAccount.set(lower(w.account), w.at);
    }
    if (w.identity === "app" && !w.app) errors.push(`${w.at}: identity is "app" but no "app" {id, key_file} is set`);
    if (w.identity === "machine-user" && !w.account) errors.push(`${w.at}: identity is "machine-user" but no "account" is set`);
    if (config.mode === "team" && !w.app && !w.account) warnings.push(`${w.at}: no identity (no "app" and no "account"); it would act under a person's login, which breaks one identity per AI`);
  }
}

// Checks that a repository folder carries the guardrail files that stand in for a watching person.
export function checkRepoGuardrails(dir) {
  const must = [
    [".github/pull_request_template.md", "the pull request template"],
    [".github/workflows/checks.yml", "the baseline checks workflow"],
    [".github/CODEOWNERS", "CODEOWNERS"],
    // Build@Scale with AI is mandatory in every project: git clone https://github.com/skthasan1/buildatscale shared
    ["shared/FRAMEWORK.md", "the Build@Scale with AI framework (mandatory in every project)"],
    ["shared/VERSION", "the Build@Scale with AI version file"],
  ];
  const errors = [];
  for (const [rel, what] of must) if (!fs.existsSync(path.join(dir, rel))) errors.push(`${what} is missing (${rel}); add it (see SETUP.md, phase 5)`);
  return { errors, warnings: [] };
}
