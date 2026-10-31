# Impact checklist

Purpose: a short list to answer before you build, so a change does not break something you did not look at. Run it for every issue; it takes a few minutes. Post the answers on the issue if any is "yes" or "not sure".

If a change is made in the middle of a session (a new idea, a design tweak), run the list again. A mid-session change that skips it is where gaps appear.

---

**Issue:** #<n>  **Date:** <date>  **By:** <name or role>

## 1. What this touches
- Files and modules I will change:
- Who owns them (code owner, open pull requests on the same files):
- Other code that calls or depends on them (searched with: ...):

## 2. Sensitive areas (any "yes" means stop and tell the tech lead)
- [ ] sign-in, sessions or access control
- [ ] payments, money, spend limits
- [ ] database schema or migrations
- [ ] deploy, build or production configuration
- [ ] personal or customer data
- [ ] prompt wording or AI model behaviour
- [ ] a secret or key is needed or found

## 3. Other surfaces
Does the same behaviour exist on another surface (a second screen, a mobile app, a chat or messaging channel, a scheduled job, an API, an export)? Does my change need to be mirrored, or does it leave one surface behind?

## 4. Data and state
- Existing data that must keep working (old rows, saved settings, cached values):
- Anything shared that my tests could overwrite or clear (singleton rows, live settings)? Plan to restore or use throwaway keys:

## 5. Failure and empty states
What does the user see when it is loading, empty, failed, or offline? Is each handled?

## 6. Docs and records
- Documentation that must change with the code:
- Tests to add or update (including mocks that list functions):
- Plan or tracker rows to update:

## 7. Size and order
- Estimated hand-written lines:
- One pull request or several slices? If several, the order and which depend on others:

## 8. Cost
Paid calls or keys needed? Estimate, and who must say yes.

## 9. Rollback
How to undo it if it goes wrong (revert one pull request, switch a flag off). Anything that cannot be undone?

## 10. Open questions
Questions to ask the tech lead before starting, with my recommended answer.
