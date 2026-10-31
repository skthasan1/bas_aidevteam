# Evidence and limitations

Purpose: how the QA lead writes what was tested, what was not, and why a gap is never counted as a pass.

## The rule

**A gap is not a pass.** If you did not test it, the report says "not tested" and why. Silence in a report is read as "tested and fine", so write the gaps.

## What every report names

1. The **full commit id** of the code tested. A short id is allowed only when you could not get the full one, and then say so.
2. Whether the head was a pull request head or the merged branch.
3. The environment: local or shared, how it started, database, browser and version, viewport, theme, OS.
4. The date, the commands or scenario ids, and the cost.
5. What you did **not** reach (next section).

Why: a report that does not name the head can be read as covering a later commit. A fix pushed after your run has not been tested by you.

## How to write a gap

One line per gap: what, and the reason class.

| Reason class | Example wording |
|---|---|
| No access | "Not tested: the admin screen. No admin role in the local set-up." |
| Needs a real device | "Not tested on a phone. Checked in an emulated 390 px browser only." |
| Needs a human | "Not judged: whether the voice sounds natural. Measured loudness only." |
| Needs money | "Not tested: the real generation step. Stubbed; the stub cannot show quality." |
| Stub limit | "The reply was a canned stub, so wording of the real reply is unknown." |
| Not reproducible | "Seen once, not again in five tries. Steps below are what I did." |
| Out of scope | "Not tested: the settings page. It did not change in this head." |
| Time | "Not run: the full suite. Ran the targeted set only." |
| Tool limit | "Contrast not measured for the translucent bar; script cannot read it." |
| Unknown environment | "Could not tell whether the feature flag was on in the shared copy." |

## Emulation versus real

Say which you used. "Forced colours: emulated in the browser, not a real high-contrast theme." "Reduced motion: emulated." "Touch: mouse events at 390 px, not a touch screen."

## Stubs

Say what was stubbed and what the stub could not show. A stubbed success path proves the screen handles a success answer. It does not prove the service works.

## Not verified is allowed

"Not verified: that the newest public version equals the one I read." This sentence is useful. A confident report with a hidden assumption is worse than a report with three honest "not verified" lines.

## A short example

```
Tested head: <full commit id>, pull request, not merged.
Environment: local, throwaway database, desktop browser, 1280 and 390 px, light and dark, Windows.
Passed: 11. Failed: 2 (see rows 4 and 5). Not run: 3.

Not reached:
- Real payment step: stubbed. The stub cannot show the provider's error screens.
- Tablet width (820 px): not run; time.
- Screen reader: not run; no screen reader available. Names checked in the accessibility tree only.
```

## Recheck rule

If someone says "fixed", test the new head, write that head in full, and say "verified" or "still fails". Do not carry a pass forward from an older head.

## Corrections

If you find your own report was wrong, correct it in place, add a line at the top saying what changed and when, and tell the tech lead. A hidden correction is worse than a visible one.
