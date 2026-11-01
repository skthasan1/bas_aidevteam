// Load and validate the organization config (see templates/hub/qa-projects.example.json and examples/acme).
import fs from "node:fs";

export const ROLE_NAMES = ["tech-lead", "ai-developer", "qa-lead", "security-lead", "researcher"];
// "archived": work stopped, repositories kept as they are. A project that is archived, or planned (no repositories yet, not watched) is dormant.
export const TESTING = ["active", "hold", "later", "archived"];
export const WATCH = ["merge", "review", "off"];
// The functions every project must cover. Each is covered by a role (an AI worker somebody runs) or a named person, never by a check alone.
export const FUNCTIONS = ["review", "test", "security", "decision"];
export const MODES = ["solo", "team"];
// Who may merge in a project: only a person, the lead AI once the written conditions hold, or the lead AI only on the owner's word each time.
export const MERGE = ["owner-only", "lead-after-conditions", "lead-on-owner-word"];
// Headless runs (tools/run-role.mjs): false = never, "read-only" = reads and reports, "write-branch" = may commit to a new branch (ai-developer only).
export const HEADLESS = [false, "read-only", "write-branch"];
// How a worker is run: in an editor window, in a terminal, or in the background (needs headless). Empty means not chosen yet.
export const SURFACES = ["editor", "terminal", "background"];
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
export const RUNNER_PROMPT_VIA = ["arg", "stdin"];
export const RUNNER_DEFAULT_MINUTES = 30;
export const RUNNER_MAX_MINUTES = 240;
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const HANDLE_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
// An AI account may be a GitHub App's bot login: <slug>[bot]. Only accounts, ai_accounts and a project's lead take this form; people never do.
const ACCOUNT_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})(?:\[bot\])?$/;
export const IDENTITIES = ["app", "machine-user"];
const APP_KEYS = ["id", "key_file", "owner"];

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
  // headless and folder are optional per worker; see HEADLESS above.
  const workerExtras = (at, r) => {
    const headless = isObj(r) && r.headless !== undefined ? r.headless : false;
    if (!HEADLESS.includes(headless)) errors.push(`${at}.headless must be false, "read-only" or "write-branch"`);
    const folder = isObj(r) && r.folder !== undefined ? r.folder : "";
    if (typeof folder !== "string") errors.push(`${at}.folder must be a string`);
    const surface = isObj(r) && r.surface !== undefined ? r.surface : "";
    if (surface !== "" && !SURFACES.includes(surface)) errors.push(`${at}.surface must be one of ${SURFACES.join(", ")}`);
    const color = isObj(r) && r.color !== undefined ? r.color : "";
    if (color !== "" && !(typeof color === "string" && COLOR_RE.test(color))) errors.push(`${at}.color must be a #rrggbb color`);
    const identity = isObj(r) && r.identity !== undefined ? r.identity : "";
    if (identity !== "" && !IDENTITIES.includes(identity)) errors.push(`${at}.identity must be one of ${IDENTITIES.join(", ")} (or empty)`);
    return { headless: HEADLESS.includes(headless) ? headless : false, folder: typeof folder === "string" ? folder : "", surface: SURFACES.includes(surface) ? surface : "", color: typeof color === "string" && COLOR_RE.test(color) ? color : "", identity: IDENTITIES.includes(identity) ? identity : "", app: appOf(at, isObj(r) ? r.app : undefined) };
  };
  // The worker's GitHub App: { id, key_file, owner }. The config holds only the App ID and the PATH of the key file, never the key.
  const appOf = (at, a) => {
    if (a === undefined || a === null) return null;
    if (!isObj(a)) { errors.push(`${at}.app must be an object {id, key_file, owner}`); return null; }
    for (const k of Object.keys(a)) if (!APP_KEYS.includes(k)) errors.push(`${at}.app: unknown field "${k}" (allowed: ${APP_KEYS.join(", ")}); never put a key or token in the config, only the path of the key file`);
    const id = typeof a.id === "number" && Number.isSafeInteger(a.id) && a.id > 0 ? String(a.id) : a.id;
    if (typeof id !== "string" || !/^[0-9]+$/.test(id)) errors.push(`${at}.app.id must be the App's numeric ID`);
    if (typeof a.key_file !== "string" || !a.key_file.trim()) errors.push(`${at}.app.key_file must be the path of the App's private key file (.pem)`);
    if (a.owner !== undefined && (typeof a.owner !== "string" || (a.owner !== "" && !HANDLE_RE.test(a.owner)))) errors.push(`${at}.app.owner must be the organization or user the App is installed on`);
    return { id: String(id), key_file: typeof a.key_file === "string" ? a.key_file : "", owner: typeof a.owner === "string" ? a.owner : "" };
  };
  const addRole = (name, account, src) => {
    if (!ROLE_NAMES.includes(name)) { errors.push(`roles: unknown role "${name}" (known: ${ROLE_NAMES.join(", ")})`); return; }
    if (account !== undefined && account !== "" && (typeof account !== "string" || !ACCOUNT_RE.test(account))) errors.push(`roles.${name}: invalid account`);
    roles.push({ name, account: account ?? "", ...workerExtras(`roles.${name}`, src) });
  };
  if (Array.isArray(roleInput)) roleInput.forEach((r) => (typeof r === "string" ? addRole(r) : addRole(r?.name, r?.account, r)));
  else if (isObj(roleInput)) {
    for (const [name, v] of Object.entries(roleInput)) {
      if (v === false || (isObj(v) && v.enabled === false)) continue;
      addRole(name, isObj(v) ? v.account : undefined, v);
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
      if (account !== "" && (typeof account !== "string" || !ACCOUNT_RE.test(account))) { errors.push(`people.${handle}.${name}: invalid account`); continue; }
      workers.push({ name, account, ...workerExtras(`people.${handle}.${name}`, r) });
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
      const noRepos = isObj(p.repos) && Object.keys(p.repos).length === 0;
      const planned = noRepos && ["later", "archived"].includes(p.testing ?? "later") && (p.watch ?? "off") === "off";
      if (!isObj(p.repos) || (Object.keys(p.repos).length === 0 && !planned)) errors.push(`${at}.repos must map a short name to "owner/repo" (a project with testing "later" or "archived" and watch "off" may list none yet)`);
      else for (const [k, v] of Object.entries(p.repos)) if (typeof v !== "string" || !REPO_RE.test(v)) errors.push(`${at}.repos.${k}: "${v}" is not owner/repo`);
      if (p.default !== undefined && !(planned && p.default === "") && (typeof p.default !== "string" || !REPO_RE.test(p.default))) errors.push(`${at}.default is not owner/repo`);
      if (!Array.isArray(p.owners) || (p.owners.length === 0 && !planned)) errors.push(`${at}.owners must list at least one handle`);
      else for (const h of p.owners) if (typeof h !== "string" || !HANDLE_RE.test(h)) errors.push(`${at}.owners: invalid handle ${JSON.stringify(h)}`);
      const testing = p.testing ?? "later";
      if (!TESTING.includes(testing)) errors.push(`${at}.testing must be one of ${TESTING.join(", ")}`);
      const watch = p.watch ?? "off";
      if (!WATCH.includes(watch)) errors.push(`${at}.watch must be one of ${WATCH.join(", ")}`);
      if (p.watch === undefined) warnings.push(`${at}.watch not set, treated as off`);
      const merge = p.merge ?? "owner-only";
      if (!MERGE.includes(merge)) errors.push(`${at}.merge must be one of ${MERGE.join(", ")}`);
      if (p.lead !== undefined && (typeof p.lead !== "string" || !ACCOUNT_RE.test(p.lead))) errors.push(`${at}.lead must be one handle (the project's lead AI account)`);
      const covers = p.covers ?? {};
      if (!isObj(covers)) errors.push(`${at}.covers must be an object {review, test, security, decision}`);
      else for (const [fn, v] of Object.entries(covers)) {
        if (!FUNCTIONS.includes(fn)) errors.push(`${at}.covers: unknown function "${fn}" (known: ${FUNCTIONS.join(", ")})`);
        else {
          const list = Array.isArray(v) ? v : [v];
          if (list.length === 0 || !list.every((x) => typeof x === "string" && /^(role:[a-z-]+|person:[A-Za-z0-9-]+)$/.test(x))) errors.push(`${at}.covers.${fn} must be "role:<role>" or "person:<handle>", or a list of them`);
        }
      }
      const areas = p.decision_areas ?? {};
      if (!isObj(areas)) errors.push(`${at}.decision_areas must be an object: area -> list of "person:<handle>"`);
      else for (const [area, v] of Object.entries(areas)) {
        const list = Array.isArray(v) ? v : [v];
        if (!/^[a-z][a-z-]*$/.test(area) || list.length === 0 || !list.every((x) => typeof x === "string" && /^person:[A-Za-z0-9-]+$/.test(x))) errors.push(`${at}.decision_areas.${area} must be a lowercase area name with one or more "person:<handle>"`);
      }
      const members = p.members ?? [];
      if (!Array.isArray(members)) errors.push(`${at}.members must be an array of handles`);
      else for (const h of members) if (typeof h !== "string" || !HANDLE_RE.test(h)) errors.push(`${at}.members: invalid handle ${JSON.stringify(h)}`);
      projects[id] = { ...p, dormant: planned || (p.testing ?? "later") === "archived", default: p.default ?? Object.values(p.repos ?? {})[0], testing, watch, merge, covers: isObj(covers) ? covers : {}, decision_areas: isObj(areas) ? areas : {}, lead: p.lead ?? "", members: Array.isArray(members) ? members : [] };
    }
  }

  for (const k of ["bots", "ai_comment_prefixes", "ai_accounts"]) {
    if (raw[k] !== undefined && (!Array.isArray(raw[k]) || !raw[k].every((s) => typeof s === "string"))) errors.push(`${k} must be an array of strings`);
  }

  if (Array.isArray(raw.ai_accounts)) for (const a of raw.ai_accounts) if (typeof a === "string" && !ACCOUNT_RE.test(a)) errors.push(`ai_accounts: invalid account ${JSON.stringify(a)}`);

  const regexOk =(s) => { try { new RegExp(s, "i"); return true; } catch { return false; } };
  if (raw.pr_watch !== undefined) {
    if (!isObj(raw.pr_watch)) errors.push("pr_watch must be an object {skip_authors, skip_titles}");
    else {
      const { skip_authors: sa, skip_titles: st } = raw.pr_watch;
      if (sa !== undefined && (!Array.isArray(sa) || !sa.every((s) => typeof s === "string"))) errors.push("pr_watch.skip_authors must be an array of strings");
      if (st !== undefined && (!Array.isArray(st) || !st.every((s) => typeof s === "string"))) errors.push("pr_watch.skip_titles must be an array of regular expression strings");
      else for (const s of st ?? []) if (!regexOk(s)) errors.push(`pr_watch.skip_titles: ${JSON.stringify(s)} is not a valid regular expression`);
    }
  }
  if (raw.merge_watch !== undefined) {
    if (!isObj(raw.merge_watch)) errors.push("merge_watch must be an object {qa_pending_pattern}");
    else {
      const q = raw.merge_watch.qa_pending_pattern;
      if (q !== undefined && (typeof q !== "string" || !regexOk(q))) errors.push(`merge_watch.qa_pending_pattern ${JSON.stringify(q)} is not a valid regular expression`);
    }
  }

  // Optional security read (docs/PROTOCOL.md section 5.3): turns on the security-area tag in pr-watch and sets the areas that need a read.
  if (raw.security_read !== undefined) {
    const s = raw.security_read;
    if (!isObj(s)) errors.push("security_read must be an object {enabled, areas}");
    else {
      if (s.enabled !== undefined && typeof s.enabled !== "boolean") errors.push("security_read.enabled must be true or false");
      if (s.areas !== undefined) {
        if (!isObj(s.areas)) errors.push("security_read.areas must be an object of area name to regular expression");
        else for (const [k, v] of Object.entries(s.areas)) if (typeof v !== "string" || !regexOk(v)) errors.push(`security_read.areas.${k}: not a valid regular expression`);
      }
    }
  }

  // Optional runner for headless runs: the command (never run through a shell), its fixed arguments and how the prompt is handed over.
  let runner;
  if (raw.runner !== undefined) {
    const r = raw.runner;
    if (!isObj(r)) errors.push("runner must be an object {command, args, prompt_via, timeout_minutes}");
    else {
      if (typeof r.command !== "string" || !r.command.trim()) errors.push("runner.command must be a non-empty string");
      if (r.args !== undefined && (!Array.isArray(r.args) || !r.args.every((a) => typeof a === "string"))) errors.push("runner.args must be an array of strings");
      if (r.prompt_via !== undefined && !RUNNER_PROMPT_VIA.includes(r.prompt_via)) errors.push(`runner.prompt_via must be one of ${RUNNER_PROMPT_VIA.join(", ")}`);
      const t = r.timeout_minutes;
      if (t !== undefined && (typeof t !== "number" || !Number.isFinite(t) || t <= 0 || t > RUNNER_MAX_MINUTES)) errors.push(`runner.timeout_minutes must be a number above 0 and at most ${RUNNER_MAX_MINUTES}`);
      runner = { command: r.command, args: Array.isArray(r.args) ? r.args : [], prompt_via: r.prompt_via ?? "arg", timeout_minutes: t ?? RUNNER_DEFAULT_MINUTES };
    }
  }

  const config = errors.length ? null : {
    ...raw,
    organization: org,
    mode,
    people,
    owner: { name: owner.name ?? "", handles: ownerHandles },
    roles,
    projects,
    ...(runner ? { runner } : {}),
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
