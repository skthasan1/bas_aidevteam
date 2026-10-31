// Tiny argument parser shared by the tools: positional words, --flag, --key=value and --key value.
// A flag listed in `booleans` accepts only true or false (--apply, --apply=true, --apply=false, --apply false);
// any other value (--apply=no, --force=0) is an error, so a typo can never switch a dangerous flag on or silently off.
export function parseArgs(argv, booleans = []) {
  const positional = [];
  const flags = {};
  const boolValue = (key, v) => {
    if (v === "true") return true;
    if (v === "false") return false;
    throw new Error(`--${key} is a yes/no flag: use --${key}, --${key}=true or --${key}=false (got "${v}")`);
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { positional.push(a); continue; }
    const eq = a.indexOf("=");
    if (eq > 0) {
      const key = a.slice(2, eq), v = a.slice(eq + 1);
      flags[key] = booleans.includes(key) ? boolValue(key, v) : v;
      continue;
    }
    const key = a.slice(2);
    if (booleans.includes(key)) {
      // "--flag false" / "--flag true" consume the next word; any other word after it stays positional.
      if (argv[i + 1] === "true" || argv[i + 1] === "false") flags[key] = boolValue(key, argv[++i]);
      else flags[key] = true;
    } else if (i + 1 >= argv.length || argv[i + 1].startsWith("--")) flags[key] = true;
    else flags[key] = argv[++i];
  }
  return { positional, flags };
}
