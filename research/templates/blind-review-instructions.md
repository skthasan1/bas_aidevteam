# Blind review instructions (the "How to review" block)

Purpose: the text every blind sheet carries on the page itself. The evidence-page builder writes it from the `review` field of the spec, so it is not retyped per test.

A blind spec without this block is a defect: the builder prints a warning and the page says so, and `check-research.mjs` fails.

## Spec field

```json
"review": {
  "compare": "One paragraph: what is being compared, with NO mapping of file to version and no costs.",
  "questions": ["The question each judge answers for every file."],
  "guess": "The guess to write down before the key is opened, for example: which one do you think is version X?",
  "cues": "Optional line, for example: if you see burned-in text or hear a gap, write it down.",
  "people": 4,
  "scale": "1 (worst) to 5 (best)"
}
```

Required: `compare`, `questions` (at least one), `guess`. Optional: `cues`, `people` (rows in the score table, default 4), `scale`.

## Steps shown to judges

1. Look at or listen to each file twice (sound on for clips).
2. Work on your own first: before any discussion, score each file on the scale and write what you noticed. Do not say out loud how you think the files were made.
3. Answer the questions for each file.
4. Write down your guess before the key is opened.
5. Then the team discusses the scores together.
6. Only after that, the key is opened and the result is decoded.

## Rules for the author of the spec

- No variant names, no A or B, no costs, no model names on the page.
- One question per group of files where you can.
- The message that points judges at the sheet names the sheet and states the exact number of items.
- The key lives outside the repository.
