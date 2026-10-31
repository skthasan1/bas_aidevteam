# Test registry

Purpose: the memory of every test run or planned, so no one repeats one and every judged test has a next step.

The file is `registry.json` (copy `registry.example.json` to start). Edit it with `tools/registry.mjs`, not by hand.

## Fields

| Field | Meaning |
|---|---|
| `id` | Unique, for example `R-001-T1`. A follow-up gets a new id and names its parent in `idea` or `result` |
| `source` | The library entry or material the idea came from |
| `date` | Date of the entry (YYYY-MM-DD) |
| `idea` | The idea in one line |
| `question` | The question the test answers |
| `models` | Models or tools used |
| `variants` | What was compared |
| `sample` | How many per variant ("4 pictures per variant") |
| `cost` | Number (amount spent or estimated), or null |
| `status` | `planned`, `run-pending-judges`, `measured`, `judged`, `inconclusive`, `superseded` |
| `result` | The result in one or two lines, with counts |
| `evidence` | Where the report and evidence page are |
| `tags` | List of words, for search |
| `action` | An issue reference, or `no action: <reason>` |

## The rule

An entry may be set to `judged` only with a non-empty `action` line. The issue reference or `no action: <reason>` says what happens next. `registry.mjs` refuses otherwise, and `check-research.mjs` fails for any judged entry without one. Why: a result without a recorded next step is not used.

## Commands

```
node research/tools/registry.mjs list   --file research/registry/registry.json [--status judged]
node research/tools/registry.mjs find   <words> --file research/registry/registry.json
node research/tools/registry.mjs add    --file ... --id R-002-T1 --idea "..." [--source ..] [--status planned] [--cost 1.5] [--tags a,b] ...
node research/tools/registry.mjs set    <id> --file ... --status judged --action "no action: dropped" [--result ".."]
```
