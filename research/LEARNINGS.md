# Researcher learnings

Purpose: hygiene rules for blind tests, evidence pages, spend and the registry, each with the reason. Add a line when something is learned the hard way. Read before building an evidence page or a blind test.

## Evidence pages

- **Use the builder, not a hand-written page.** Write a spec, run `build-evidence-page.mjs`, and republish the same page when something changes. Why: pages rebuilt by hand drift, lose features and waste days.
- **A non-blind page starts with a decision board.** One row per idea: verdict chip, evidence, owner. Then one block per test. Why: readers decide from the board and open the block only when they doubt it.
- **Say the sample size.** "4 pictures per variant: evidence, not statistics." Say what was not judged. Why: small samples read as proof when the number is hidden.
- **Media are referenced by relative path, never embedded and never committed.** Why: pages stay small and git stays clean.
- **The page must work on a phone.** Why: reviewers open links from a chat on their phone.

## Blind tests

- **Neutral names.** Items are `t1-1`, `t1-2`. No A or B, no variant words in file names, captions or metadata. Why: one hint breaks the whole test.
- **Same format, size, canvas and length for every variant.** Why: a wide picture next to a tall one, or 180 KB next to 2 MB, gives the variant away.
- **Match loudness before shuffling.** Do not boost near-silent clips: it turns noise into sound. Strip their audio and say so on the sheet. Why: the louder clip wins, whatever it says.
- **Count the items in the message to the judges.** Why: judges count, and a wrong count ("28" for 29 clips) destroys trust in the sheet.
- **The tester measures; people judge.** The tester or runner may check sizes, lengths and loudness. The team's ranking is the evidence. Do not give the tester the key. Why: an agent cannot judge taste and a knowing tester is not blind.
- **Every blind page carries its "How to review" block on the page itself.** Written from the template, not typed per test: how to score, alone first, a guess before the key, one question per file. The check tool fails a blind spec without it. Why: instructions sent in chat get lost; the page is what judges have open.
- **A relayed message that points judges at a sheet names the sheet.** "Please review the sheet `t7-listening`", not "the new sheet". Why: with several open sheets, judges review the wrong one and the scores are lost.
- **A sheet is blind or named, never mixed.** Named files (with variant labels) go on a separate, non-blind page for people who already know the key. A blind sheet never contains one named file. Why: a single named file reveals the mapping for the rest.
- **The key stays outside the repository** and is opened only after the scores are in. Why: a key in git is a key everyone can read.
- **Guess before the key.** Each judge writes down which variant they think is which. Why: it shows whether the variants could be told apart at all.

## Spend

- **Spend needs the budget owner's yes, in the session that will spend.** A relayed yes ("the owner approved it") does not start a paid test. Why: relayed approvals drift in amount and scope.
- **Ledger before each paid call.** One line: time, provider, model, count, estimate. Stop below the approved budget. Why: logging after the call fails exactly when a loop runs away.
- **Dry run first.** Why: it is free and finds most plan errors.
- **A plan whose estimate passes the stop line waits for the budget owner.**

## Registry

- **Search before you propose.** `registry.mjs find <words>`; write "not run before" or name the earlier test. Why: repeated tests are the cheapest waste to avoid.
- **A test is `judged` only with an action line.** An issue reference, or `no action: <reason>`. The tool refuses otherwise and the check fails. Why: results without a next step are never used.
- **A follow-up that changes one thing is a new entry that names its parent.**
- **Update the registry after every batch,** with the statuses `planned`, `run-pending-judges`, `measured`, `judged`, `inconclusive`, `superseded`.

## Repository hygiene

- **Media never go into git** (pictures, clips, audio). Use the team's media store. Provider URLs expire: do not keep them as files. Why: media bloat history forever and cannot be removed cleanly.
- **Only variable names are written down, never values.** Keys live in each person's own environment file.
- **Never write into a live project.** Work in a throwaway copy. Why: a test run once interrupted a person's running job.
- **Real people in pictures:** consent rules apply. A provider refusal is a finding; do not work around it.
