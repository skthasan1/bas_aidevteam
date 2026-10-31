// Tiny argument parser shared by the tools: positional words, --flag, --key=value and --key value.
export function parseArgs(argv, booleans = []) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { positional.push(a); continue; }
    const eq = a.indexOf("=");
    if (eq > 0) { flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const key = a.slice(2);
    if (booleans.includes(key) || i + 1 >= argv.length || argv[i + 1].startsWith("--")) flags[key] = true;
    else flags[key] = argv[++i];
  }
  return { positional, flags };
}
