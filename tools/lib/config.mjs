// Load and validate the organization config (see templates/hub/qa-projects.example.json and examples/acme).
import fs from "node:fs";

export const ROLE_NAMES = ["tech-lead", "ai-developer", "qa-lead", "security-lead", "researcher"];
export const TESTING = ["active", "hold", "later"];
export const WATCH = ["merge", "review", "off"];
// The functions every project must cover. Each is covered by a role (an AI worker somebody runs) or a named person, never by a check alone.
export const FUNCTIONS = ["review", "test", "security", "decision"];
export const MODES = ["solo", "team"];
// Who may merge in a project: only a person, the lead AI once the written conditions hold, or the lead AI only on the owner's word each time.
export const MERGE = ["owner-only", "lead-after-conditions", "lead-on-owner-word"];
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const HANDLE_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);

// Returns { errors, warnings, config }; config is normalised (roles as [{name, account}], owner.handles array).
export function validateConfig(raw) {
  const errors = [];
  const warnings = [];
  if (!isObj(raw)) return { errors: ["config must be a JSON object"], warnings, config: null };

  const org = raw.organization ?? "";
  if (org !== "" && typeof org !== "string") errors.push("organization must be a string");

  const owner = isObj(raw.owner) ? raw.owner : {};
  const ownerHandles = Array.isArray(owner.handles) ? owner.handles : [];
  if (raw.owner !== undefined && !isObj(raw.owner)) errors.push("owner must be an object {name, handles}");
  for (const h of ownerHandles) if (typeof h !== "string" || !HANDLE_RE.test(h)) errors.push(`owner.handles: invalid handle ${JSON.stringify(h)}`);

  const mode = raw.mode ?? "team";
  if (!MODES.includes(mode)) errors.push(`mode must be one of ${MODES.join(", ")}`);

  const roleInput = raw.roles ?? ROLE_NAMES;
  const roles = [];
  const addRole = (name, account) => {
    if (!ROLE_NAMES.includes(name)) { errors.push(`roles: unknown role "${name}" (known: ${ROLE_NAMES.join(", ")})`); return; }
    if (account !== undefined && account !== "" && (typeof account !== "string" || !HANDLE_RE.test(account))) errors.push(`roles.${name}: invalid account`);
    roles.push({ name, account: account ?? "" });
  };
  if (Array.isArray(roleInput)) roleInput.forEach((r) => (typeof r === "string" ? addRole(r) : addRole(r?.name, r?.account)));
  else if (isObj(roleInput)) {
    for (const [name, v] of Object.entries(roleInput)) {
      if (v === false || (isObj(v) && v.enabled === false)) continue;
      addRole(name, isObj(v) ? v.account : undefined);
    }
  } else errors.push("roles must be an array of role names or an object");

  // Optional: which AI workers each person runs. A person picks the roles they need and may run several of one role,
  // for example three ai-developer accounts and no qa-lead. Without "people", every role above belongs to the organization.
  const people = {};
  if (raw.people !== undefined && !isObj(raw.people)) errors.push("people must be an object: handle -> { roles: [...] }");
  else for (const [handle, v] of Object.entries(raw.people ?? {})) {
    if (!HANDLE_RE.test(handle)) { errors.push(`people: invalid handle ${JSON.stringify(handle)}`); continue; }
    const list = isObj(v) ? v.roles : undefined;
    if (!Array.isArray(list)) { errors.push(`people.${handle}.roles must be an array of role names or {name, account}`); continue; }
    const workers = [];
    for (const r of list) {
      const name = typeof r === "string" ? r : r?.name;
      const account = typeof r === "string" ? "" : (r?.account ?? "");
      if (!ROLE_NAMES.includes(name)) { errors.push(`people.${handle}: unknown role "${name}" (known: ${ROLE_NAMES.join(", ")})`); continue; }
      if (account !== "" && (typeof account !== "string" || !HANDLE_RE.test(account))) { errors.push(`people.${handle}.${name}: invalid account`); continue; }
      workers.push({ name, account });
    }
    people[handle] = { roles: workers };
  }

  const projects = {};
  if (!isObj(raw.projects) || Object.keys(raw.projects).length === 0) errors.push("projects must be an object with at least one project");
  else {
    for (const [id, p] of Object.entries(raw.projects)) {
      const at = `projects.${id}`;
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) errors.push(`${at}: project id must be lowercase letters, digits and dashes`);
      if (!isObj(p)) { errors.push(`${at}: must be an object`); continue; }
      if (typeof p.name !== "string" || !p.name) errors.push(`${at}.name is required`);
      if (!isObj(p.repos) || Object.keys(p.repos).length === 0) errors.push(`${at}.repos must map a short name to "owner/repo"`);
      else for (const [k, v] of Object.entries(p.repos)) if (typeof v !== "string" || !REPO_RE.test(v)) errors.push(`${at}.repos.${k}: "${v}" is not owner/repo`);
      if (p.default !== undefined && (typeof p.default !== "string" || !REPO_RE.test(p.default))) errors.push(`${at}.default is not owner/repo`);
      if (!Array.isArray(p.owners) || p.owners.length === 0) errors.push(`${at}.owners must list at least one handle`);
      else for (const h of p.owners) if (typeof h !== "string" || !HANDLE_RE.test(h)) errors.push(`${at}.owners: invalid handle ${JSON.stringify(h)}`);
      const testing = p.testing ?? "later";
      if (!TESTING.includes(testing)) errors.push(`${at}.testing must be one of ${TESTING.join(", ")}`);
      const watch = p.watch ?? "off";
      if (!WATCH.includes(watch)) errors.push(`${at}.watch must be one of ${WATCH.join(", ")}`);
      if (p.watch === undefined) warnings.push(`${at}.watch not set, treated as off`);
      const merge = p.merge ?? "owner-only";
      if (!MERGE.includes(merge)) errors.push(`${at}.merge must be one of ${MERGE.join(", ")}`);
      if (p.lead !== undefined && (typeof p.lead !== "string" || !HANDLE_RE.test(p.lead))) errors.push(`${at}.lead must be one handle (the project's lead AI account)`);
      const covers = p.covers ?? {};
      if (!isObj(covers)) errors.push(`${at}.covers must be an object {review, test, security, decision}`);
      else for (const [fn, v] of Object.entries(covers)) {
        if (!FUNCTIONS.includes(fn)) errors.push(`${at}.covers: unknown function "${fn}" (known: ${FUNCTIONS.join(", ")})`);
        else if (typeof v !== "string" || !/^(role:[a-z-]+|person:[A-Za-z0-9-]+)$/.test(v)) errors.push(`${at}.covers.${fn} must be "role:<role>" or "person:<handle>"`);
      }
      const members = p.members ?? [];
      if (!Array.isArray(members)) errors.push(`${at}.members must be an array of handles`);
      else for (const h of members) if (typeof h !== "string" || !HANDLE_RE.test(h)) errors.push(`${at}.members: invalid handle ${JSON.stringify(h)}`);
      projects[id] = { ...p, default: p.default ?? Object.values(p.repos ?? {})[0], testing, watch, merge, covers: isObj(covers) ? covers : {}, lead: p.lead ?? "", members: Array.isArray(members) ? members : [] };
    }
  }

  for (const k of ["bots", "ai_comment_prefixes", "ai_accounts"]) {
    if (raw[k] !== undefined && (!Array.isArray(raw[k]) || !raw[k].every((s) => typeof s === "string"))) errors.push(`${k} must be an array of strings`);
  }

  const config = errors.length ? null : {
    ...raw,
    organization: org,
    mode,
    people,
    owner: { name: owner.name ?? "", handles: ownerHandles },
    roles,
    projects,
    bots: raw.bots ?? ["dependabot[bot]", "github-actions[bot]"],
    ai_comment_prefixes: raw.ai_comment_prefixes ?? ["Reviewed by", "QA report by", "Cleared by"],
    ai_accounts: raw.ai_accounts ?? [],
  };
  return { errors, warnings, config };
}

export function parseConfig(text) {
  let raw;
  try { raw = JSON.parse(text); } catch (e) { throw new Error(`config is not valid JSON: ${e.message}`); }
  const { errors, config } = validateConfig(raw);
  if (errors.length) throw new Error(`invalid config:\n- ${errors.join("\n- ")}`);
  return config;
}

export function loadConfig(file) {
  let text;
  try { text = fs.readFileSync(file, "utf8"); } catch (e) { throw new Error(`cannot read config ${file}: ${e.message}`); }
  return parseConfig(text);
}

export const reposOf = (project) => [...new Set(Object.values(project.repos))];

// Projects a watch should look at: one by id, or every project whose watch is not "off".
export function selectProjects(config, id) {
  if (id) {
    if (!config.projects[id]) throw new Error(`unknown project "${id}" (known: ${Object.keys(config.projects).join(", ")})`);
    return [[id, config.projects[id]]];
  }
  return Object.entries(config.projects).filter(([, p]) => p.watch !== "off");
}

export const ownerLogins = (config, project) =>
  new Set([...config.owner.handles, ...(project?.owners ?? []), ...config.ai_accounts].map((s) => s.toLowerCase()));
