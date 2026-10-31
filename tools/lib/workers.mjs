// AI workers as the config describes them: how each one is run (surface), its editor colors and its start-up steps.
export const SURFACES = ["editor", "terminal", "background"];

// Per-role color families. Every shade takes white text at WCAG AA contrast (4.5:1); tests check it.
const PALETTE = {
  "tech-lead": ["#1d4ed8", "#1e40af", "#2563eb", "#1e3a8a"],
  "ai-developer": ["#166534", "#15803d", "#047857", "#065f46"],
  "qa-lead": ["#b45309", "#92400e", "#a16207", "#78350f"],
  "security-lead": ["#b91c1c", "#991b1b", "#dc2626", "#7f1d1d"],
  researcher: ["#6d28d9", "#5b21b6", "#7c3aed", "#4c1d95"],
};

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
// WCAG contrast ratio between two #rrggbb colors.
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
export const paletteFor = (role) => PALETTE[role] ?? PALETTE["tech-lead"];

// Every worker in the config: the organization's roles first, then each person's own. `index` counts workers of the same role.
export function listWorkers(config) {
  // With a "people" section, each person's own workers are the workers; the organization-level roles then only define accounts.
  const hasPeople = Object.keys(config.people).length > 0;
  const out = hasPeople
    ? Object.entries(config.people).flatMap(([person, x]) => x.roles.map((w) => ({ person, ...w })))
    : config.roles.map((w) => ({ person: "", ...w }));
  const count = {};
  return out.map((w) => {
    const index = count[w.name] ?? 0;
    count[w.name] = index + 1;
    const palette = paletteFor(w.name);
    const color = w.color || palette[index % palette.length];
    const label = [w.name, w.account || (w.person ? w.person : "")].filter(Boolean).join(" - ");
    const slug = [w.person || "org", w.name, index + 1].join("-");
    return { ...w, index, color, label, slug, surface: w.surface || "" };
  });
}

// The folder-level VS Code settings that make a worker's window recognisable: title bar, activity bar and status bar in its color,
// and its label in the window title. Keep this file out of git (it is personal).
export function vscodeSettings(worker) {
  const c = worker.color;
  return {
    "window.title": `${worker.label} - \${rootName}\${separator}\${activeEditorShort}`,
    "workbench.colorCustomizations": {
      "titleBar.activeBackground": c,
      "titleBar.activeForeground": "#ffffff",
      "titleBar.inactiveBackground": c,
      "titleBar.inactiveForeground": "#ffffff",
      "activityBar.background": c,
      "activityBar.foreground": "#ffffff",
      "activityBar.inactiveForeground": "#e5e7eb",
      "statusBar.background": c,
      "statusBar.foreground": "#ffffff",
    },
  };
}

// START-WORKERS.md: how to open each worker, in the way its person chose.
export function startInstructions(config, hubPath = "<hub-path>") {
  const L = ["# Start your AI workers", "", "Purpose: how to open each AI worker the way you chose to run it. Every worker has its own folder, its own account and its own start-up brief. Never share a folder between two workers.", ""];
  for (const w of listWorkers(config)) {
    const folder = w.folder || `<folder for ${w.slug}>`;
    L.push(`## ${w.label}${w.person ? ` (for ${w.person})` : ""}`, "");
    L.push(`- Role: ${w.name}. Account: ${w.account || "(not set yet)"}. Brief: \`${hubPath}/briefs/${w.name}-startup.md\`.`);
    const surface = w.surface || "terminal";
    if (!w.surface) L.push("- Run mode: not chosen yet; the steps below are for a terminal. Set `surface` to `editor`, `terminal` or `background` in the config to change them.");
    if (surface === "editor") {
      L.push(`- Run mode: editor window.`, `  1. Open the folder \`${folder}\` in its own editor window.`);
      L.push(`  2. If you use VS Code, copy \`workers/${w.slug}/vscode-settings.json\` from the hub to \`${folder}/.vscode/settings.json\`, so this window has the color ${w.color} and the title "${w.label}". Add \`.vscode/settings.json\` to the folder's \`.git/info/exclude\` so it is never committed.`);
      L.push("  3. Start your coding agent in that window and paste the start-up brief.");
    } else if (surface === "terminal") {
      L.push(`- Run mode: terminal.`, `  1. \`cd ${folder}\``, "  2. Start your coding agent there and paste the start-up brief.");
    } else {
      L.push(`- Run mode: background (headless: ${w.headless || "NOT SET - set it before running"}).`);
      L.push(`  1. Preview first: \`node tools/run-role.mjs --config ${hubPath}/qa-projects.json --hub ${hubPath} --role ${w.name}${w.person ? ` --person ${w.person}` : ""} --task "<the task>"\``);
      L.push("  2. Add `--apply` to run it, or schedule it (see `docs/PANEL.md`). Background workers review, test and report; they never merge, spend or push to production.");
    }
    L.push("");
  }
  return L.join("\n");
}
