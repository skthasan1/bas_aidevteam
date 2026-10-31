# UI standards checklist

Purpose: one generic list the QA lead applies to every UI test, with how to check each line by hand or by script. Based on the UI pack of Build@Scale with AI (tokens, contrast, touch size, focus, motion, copy, mobile).

## How to use it

- Mark every line PASS, FAIL, N/A or NOT MEASURED. Write the number you measured for every FAIL and every contrast or size line.
- **The product's own rule wins** when its design notes state an override with a reason. List the overrides at the top of the report. Where this list and the product differ, say which you applied.
- A missing state, a missing focus ring, or a text pair below its threshold is a FAIL, even if it looks fine.
- A rule you could not check is NOT MEASURED, with the reason. It is not a pass.
- Rules here are the framework's. A standard the owner has not confirmed stays "proposed" in the learning files and is not raised as a defect.
- Write the full commit id you tested in the report (see `evidence-and-limitations.md`).

Check type key: **H** by hand in a browser, **S** with a script, **B** both.

## A. Where and how you look

| # | Check | How | Type |
|---|---|---|---|
| A1 | Test the exact head and write its full commit id | `git rev-parse HEAD` in the checkout you started the app from | H |
| A2 | Acceptance sizes: 1440 (or 1280), 820 and 390 px wide, light and dark. A phone-first product: 390 and 1280. Open any side panel if it steals width. Fail on any sideways scroll | Browser device toolbar or a script that sets the viewport; check `document.documentElement.scrollWidth <= window.innerWidth` | B |
| A3 | Capture the changed screen in the same state at those sizes and both themes. Keep a "before" capture where one exists | Screenshot script; look at the viewport shot (full-page shots can draw blurred layers as black boxes) | B |
| A4 | Never press a paid or destructive control in a probe | Read the control's label first; use seeded throwaway data | H |

## B. Tokens, colour and contrast

| # | Check | How | Type |
|---|---|---|---|
| B1 | No raw hex colour, no inline style for colour, spacing or type, no palette class where a token exists | Search the changed files: `grep -nE "#[0-9a-fA-F]{3,8}\b|style=\{\{"` on the diff, then judge each hit | S |
| B2 | Informative text has **4.5:1** contrast in every state and both themes, including muted text and placeholders. Focus rings, icons and graphic marks have **3:1**. Borders may be lower by design | Compute it; do not judge by eye. Use the pack's contrast script in pair mode on rendered colours, or `--css <file> --selector <rule>` for a stylesheet. Read rendered colours with `getComputedStyle(el).color` and its background | S |
| B3 | Try the usual failures first: light grey text on white (about 2.6:1), amber text on white (about 3.2:1), white text on a mid-tone accent | Same script, pair mode | S |
| B4 | One accent, used sparingly (active, focus, "yours", AI); at most one accent fill per view; a status colour always comes with a word or icon; outline buttons do not turn accent on hover | Look at the screen with colour removed (grayscale emulation in dev tools): is every status still readable? | H |
| B5 | Both themes complete: every new colour has a dark pair; no pure black ground on marketing pages | Toggle the theme on the changed screen; scan for light patches in dark | H |
| B6 | Translucent and `lab()` colours cannot be read by the script | Read the rendered rgb from the browser, then use pair mode. If you cannot, mark NOT MEASURED | B |

## C. Layout, touch and geometry

| # | Check | How | Type |
|---|---|---|---|
| C1 | **Touch targets are 44 x 44 px** on phones (a box centred on the control must hit-test to it). No two targets overlap | At 390 px read `getBoundingClientRect()` for each control; list any under 44. Hit-test with `document.elementFromPoint(cx, cy)` | S |
| C2 | No sideways scroll at 390 and 820. Nothing clipped or overlapping at 375 and 320 | Set the viewport; scroll; look | B |
| C3 | Hit-test then really click each control in layered UI (sheets, overlays, stacked stages); the click reaches the intended control | `elementFromPoint` at the control's centre, then a real click in the script | B |
| C4 | Nested radii are concentric, insets are matched, gutters are shared, content is centred | Compare computed `border-radius` and padding of parent and child | B |
| C5 | Structure from type and thin lines, not boxes: no card inside a card, no count tiles at rest, no uniform card grid where a list would do, shadows only in the product's tiers | By eye against the product's design notes | H |
| C6 | Subtraction: nothing repeats the page, no do-nothing control, no explainer where a control would do | Read the screen top to bottom; ask "what happens if I remove this" | H |
| C7 | Type: faces and sizes from tokens, tabular numerals on figures people scan, uppercase only through the one utility, balanced headings | Computed `font-family`, `font-variant-numeric` | B |
| C8 | The "cheap or generated" tells (gradient text, glow everywhere, emoji as icons, identical cards, placeholder lorem) and the product's own "removed on purpose" list: do not bring a removed item back | Read both lists; compare | H |

## D. Keyboard and focus

| # | Check | How | Type |
|---|---|---|---|
| D1 | Tab order is logical. Everything interactive is reachable and works with Enter or Space. No click handler on a plain `div` or `span` | Tab through the screen; script: press Tab N times and record `document.activeElement` each time | B |
| D2 | **A visible focus ring on every stop**: 2 px with a 2 px offset (inside the box in fields), at least 3:1 against what is behind it. `outline: none` without a replacement is a FAIL | Screenshot each stop, or read computed `outline` and `box-shadow` on `:focus-visible` | B |
| D3 | **Escape closes** dialogs, sheets and menus, **and focus returns to the control that opened them**. Tab stays inside a modal | Open, press Escape, read `document.activeElement` and compare to the trigger. Open, Tab many times, check focus never leaves | B |
| D4 | Every control has an accessible name. State is in attributes (`aria-pressed`, `aria-selected`, `aria-expanded`) and the label stays stable | Read the accessibility tree (dev tools) or `aria-*` attributes | B |
| D5 | Menus that open on pointer-down need real pointer events in a script; a synthetic click can pass while a real one fails | Use the script's pointer API, not `element.click()` | S |
| D6 | Removing an item puts focus somewhere sensible (next item, or the list), never on the page body | Delete an item with the keyboard; read `activeElement` | B |

## E. Motion

| # | Check | How | Type |
|---|---|---|---|
| E1 | Nothing bounces, lifts on hover, overshoots or repeats. First paint is static. One easing curve. Hover about 150 ms. Sheets about 260 ms | Computed `transition` and `animation`; watch once | B |
| E2 | A loop appears only for a live or "still working" state; it is slow (not under about 2 s per cycle), uses only transform and opacity, can be paused if it runs over 5 s, and stops off screen | List running animations (`document.getAnimations()`); check durations | B |
| E3 | **Reduced motion**: emulate `prefers-reduced-motion: reduce`. The still state shows, the signal is kept (for example a text change instead of a pulse), nothing blocks content | Dev tools rendering panel, or the script's media emulation; list `getAnimations()` names and durations | B |

## F. The four states

| # | Check | How | Type |
|---|---|---|---|
| F1 | **Loading** shows the product's pattern (skeleton or static shapes), **Empty** is intentional and not a blank area, **Error** is visible and recoverable and never shows a thrown message, **Success** confirms. A missing state is a FAIL and a finding | Force each: slow the network, use an empty account, make the request fail with a stub, complete the task | B |
| F2 | Failures are plain: say what happened and what to do ("That did not send. Try again in a moment."). A dead link never explains why it is dead | Read the failure copy | H |
| F3 | A busy control shows a progressive label ("Saving...") and cannot be double-submitted | Click twice quickly with a delayed stub; count requests | B |

## G. Copy

| # | Check | How | Type |
|---|---|---|---|
| G1 | Sentence case. Buttons start with a verb ("Create project", not "Submit"). No exclamation marks. Optional fields are marked, required ones are not. A placeholder is never the label | Read every string on the changed screen | H |
| G2 | **No em dash (U+2014)** in new user-facing text (labels, titles, alt text, metadata) | `grep -n $'—'` and `grep -n "&mdash;"` on the diff and on the served HTML | S |
| G3 | One name per thing (the product's glossary). Nothing claims what is not wired. Real dates and times, with the zone where it matters. Curly quotes and proper ellipsis | Read; compare with the glossary | H |

## H. Mobile apps and marketing pages (only when the change is one)

| # | Check | How | Type |
|---|---|---|---|
| H1 | Native app: 44 pt targets around small visuals; capture at a wide width too (a phone layout stretched wide should still look intended); tokens used as written | Emulator or device; wide capture | H |
| H2 | Landing page: four to six scenes, first paint works without scripts, anything that moves on its own has a pause control, every call-to-action is really clicked, a performance audit tool is run | Disable JavaScript and reload; run the audit tool; click each button | B |

## I. Forced colours (high-contrast mode)

The pack may not state this. Run it anyway as an extra line and report it as "not required by the product's docs" unless the product's notes require it.

| # | Check | How | Type |
|---|---|---|---|
| I1 | Emulate `forced-colors: active`. Panels, sheets, dividers and every button (solid and ghost) keep an edge. The focus outline still shows. A block that is only tinted keeps a transparent 1 px border so the edge survives | Dev tools rendering panel (forced colors), or the script's media emulation. On Windows, also turn on a real high-contrast theme and look | B |
| I2 | Icons and status marks are still understood without their colour | Same mode; look | H |

Emulation is not the real thing. Say which you did.

## J. Light and dark together

| # | Check | How | Type |
|---|---|---|---|
| J1 | Every checked line above is run in both themes for the changed screen | Repeat | B |
| J2 | Theme follows the system setting at first load and the user's choice afterwards, with no flash of the wrong theme | Emulate `prefers-color-scheme`; reload | B |

## Project addenda

A product with its own design notes gets an addendum file in its own folder: the overrides (with reasons) and the numbers to measure (type scale, spacing, recorded contrast values, state wording). The report cites the addendum. A confidential product keeps its addendum apart from the shared kit and applies the product's confidentiality rule to the words used in it.

## What this list is not

It is not a legal or compliance review and it is not a taste judgement. Where a line needs a person's eye or ear ("does this feel calm"), write what you measured and ask the owner. See `practice-checklist.md` for secrets, evidence and security hand-off.
