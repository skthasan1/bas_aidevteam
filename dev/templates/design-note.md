# Design note template

Purpose: a one-page note you post on the issue before building something bigger or riskier than a small fix, so the tech lead can answer before you spend a day on it.

Write one when the change adds a module or table, changes behaviour users see, changes an interface other code uses, or is likely over about 400 lines. Keep it to one page. Facts, options and the decision you need stay apart.

---

**Issue:** #<n>  
**Author:** <role or name>  
**Date:** <date>  
**Status:** draft / answered by <role> on <date>

## 1. Problem
What is wrong or missing, in two or three sentences, and who feels it.

## 2. Facts I checked
What I read in the code and docs, with file paths. What I did not read.

## 3. Proposal
What I will build. Which files and modules change. What does not change.

## 4. Options considered
| Option | Good | Bad | Cost |
|---|---|---|---|
| A (proposed) | | | |
| B | | | |

## 5. Sensitive areas
Does it touch sign-in or access, money or spend, schema or migrations, deploy or production config, personal data, or prompt wording? If yes, which hunks, and who decides.

## 6. Slices
How the work splits into small pull requests, in order, with a rough line count for each. Say which slices could not be merged separately.

## 7. Tests and evidence
What the failing tests will be. How I will prove it works. What I cannot test (no key, no data).

## 8. Cost and keys
Any paid call or key needed. Estimate and worst case. Who must say yes.

## 9. Risks and rollback
What could go wrong. How to undo it (revert one pull request, switch a flag off).

## 10. The decision I need
One or two questions with a recommended answer for each. I will not start building until these are answered.
