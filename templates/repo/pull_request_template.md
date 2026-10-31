<!--
Purpose: pull request description with the evidence fields the protocol needs.
Fill every section. Write "none" or "not applicable, because ..." rather than deleting a section.
No secrets, keys or personal data anywhere in this description.
-->

## What and why

<!-- Two or three sentences. Which issue does this close or relate to? -->
Closes: <issue link>

## Owners

- Implementation owner: <person or role>
- Integration owner: <person or role>
- Design owner (visual work only): <person or role, or "not applicable">

## Overlap check (done before editing)

- Worktrees and branches checked: <yes / list>
- Open pull requests touching the same files: <none / links>
- Another session's branch touched: <no>

## Tier

<!-- T0 docs only | T1 ordinary code with tests | T2 money, prompts, data shape, dependencies, deployment, CI | T3 auth, secrets, security configuration, production, deleting data, access -->
Tier: <T0 | T1 | T2 | T3>

## Reviewer clearance

- Clearance link: <link to the review comment>
- Cleared head (full 40 characters): <hash>
- Current head (full 40 characters): <hash>
- Reviewer role and owner: <role (owner's AI assistant)>
- Independent of the author: <yes, because ...>

## Carry-forward record

<!-- Only if commits were added after the clearance. Otherwise write "none: the clearance is on the current head". -->
- Carry-forward comment link: <link or none>
- Category: <documentation | documentation conflict resolution | test type annotations | not carried, fresh review>
- Whole delta listed: <yes / no>

## Named person's own read (T2, T3, and anything in the protocol's always-a-person list)

- Person: <handle>
- Read the exact head (full 40 characters): <hash>
- Not applicable because: <reason, or leave blank if above is filled>

## Tests

- Tests added or changed: <list>
- Command run and result: <command and one-line result>
- CI result: <link>

## Counter-factual (for any fix, guard, gate or refusal)

- Fix removed, new tests fail as expected: <yes / no, with the failing test name>
- Fix restored, tests pass: <yes / no>
- Not applicable because: <reason>

## QA evidence

- QA report link: <link or "not yet">
- Tested head (full 40 characters): <hash>
- Scenarios passed / failed / not run: <numbers>
- Limitations: <what the test could not judge>
- Gaps (a gap is not a pass): <list or none>

## Size

- Files changed: <number>
- Lines added / removed: <numbers>
- One purpose only: <yes / the split plan>
<!-- Large changes are split into stacked pull requests, each with its own purpose. -->

## Risk and rollback

- What could break: <one or two lines>
- How to undo: <revert, flag off, migration down step>

## Touches (tick what applies; any tick makes this T2 or T3)

- [ ] money, pricing, quotas
- [ ] prompts or model instructions
- [ ] schema, migrations, data deletion
- [ ] authentication, authorisation, secrets
- [ ] dependencies or lock files
- [ ] CI, workflows, branch protection, security configuration
- [ ] production configuration or release

## Checklist

- [ ] Documentation updated where behaviour changed
- [ ] No secrets, keys, tokens or personal data in the diff or in this text
- [ ] No other session's branch was edited
- [ ] No test was removed, skipped or loosened to get green
