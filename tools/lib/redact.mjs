// Hides token-like strings in text that is logged or shown. Uses the same token patterns as tools/check-public.mjs,
// plus the values of environment variables whose name looks like a secret.
import { PATTERNS } from "../check-public.mjs";

const SECRET_NAME = /(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL)/i;
const MASK = "[redacted]";
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Token and private-key patterns only (local paths and the like are not secrets).
const SECRET_RES = PATTERNS.filter((p) => p.id === "token" || p.id === "private-key").map((p) => new RegExp(p.re.source, "g"));

// Values of secret-looking environment variables (8 characters or more, so short flags are not masked everywhere).
export function envSecrets(env = process.env) {
  return Object.entries(env).filter(([k, v]) => SECRET_NAME.test(k) && typeof v === "string" && v.length >= 8).map(([, v]) => v);
}

// Returns a function text -> redacted text.
export function makeRedactor(extra = envSecrets()) {
  const extraRes = [...new Set(extra)].filter((v) => v.length >= 8).sort((a, b) => b.length - a.length).map((v) => new RegExp(escapeRe(v), "g"));
  return (text) => {
    let out = String(text);
    for (const re of SECRET_RES) out = out.replace(re, MASK);
    for (const re of extraRes) out = out.replace(re, MASK);
    return out;
  };
}

export const redact = makeRedactor();
