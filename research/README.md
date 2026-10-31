# Researcher kit

Purpose: turn outside material (a tutorial, a competitor product, a paper, a repo) into tested, tracked work, with blind tests where taste decides and a recorded action for every judged test.

Part of Build@Scale AI Dev Team 0.1.0. The researcher is one of the five roles. The researcher recommends. People decide.

## What is here

| Path | What it is |
|---|---|
| `FRAMEWORK.md` | The pipeline from intake to library, stage by stage |
| `SKILL.md` | The agent skill file: install it so the researcher session works the same way every time |
| `LEARNINGS.md` | Hygiene rules, each with a Why line. Read before any blind test or evidence page |
| `templates/` | Intake, analysis, test plan, verdict, issue drafts, retest, discovery report, evidence spec, blind review instructions |
| `registry/` | The test registry format and an example. The registry is the memory of every test run or planned |
| `tools/registry.mjs` | Add, set, find and list registry entries. Refuses `judged` without an action line |
| `tools/check-research.mjs` | Fails on a judged entry with no action, a blind spec with no review block, or a media file in this folder |
| `tools/build-evidence-page.mjs` | Turns an evidence spec (JSON) into one static HTML page |
| `tests/` | Run with `node --test research/tests` |

## Requirements

Node 20 or newer. No dependencies, nothing to install.

## Quick start

```
# 1. Before proposing any test, search the registry
node research/tools/registry.mjs find "exact text" --file research/registry/registry.json

# 2. Add a planned test
node research/tools/registry.mjs add --file research/registry/registry.json \
  --id R-001-T1 --source R-001 --idea "Quote exact text in the prompt" --status planned

# 3. After judging, set it. A judged test needs an action line
node research/tools/registry.mjs set R-001-T1 --file research/registry/registry.json \
  --status judged --result "Right in 3 of 3" --action "issue: <org>/<repo>#<n>"

# 4. Build the evidence page from a spec
node research/tools/build-evidence-page.mjs evidence/spec.json evidence/page.html

# 5. Check before you push
node research/tools/check-research.mjs --registry research/registry/registry.json --evidence evidence
```

## Five rules to remember

1. Facts, recommendations and decisions are written apart.
2. Nothing is spent until the named person who owns the budget says yes in the session that will spend it.
3. Taste is judged blind, by people, with the key held back until the scores are in.
4. A judged test ends in an issue or an explicit "no action: reason" line.
5. Media (pictures, clips, audio) never go into git.

License: to be set by the owner.
