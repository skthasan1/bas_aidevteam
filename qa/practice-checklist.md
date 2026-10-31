# Practice checklist

Purpose: the non-visual checks the QA lead makes in every test round: secrets, evidence, security hand-off, spend, honesty about limits.

Mark each PASS, FAIL or N/A in the report.

| # | Check | How |
|---|---|---|
| P1 | No secret in the report, findings, notes, screenshots, commands or messages (password, token, key, cookie, another person's data) | Search your own outputs before saving: `grep -nEi "(key|token|secret|password|bearer)\s*[:=]"`. Blur screenshots |
| P2 | You did not open `.env*` files, private-key files, credential files or key folders | Say so in the report |
| P3 | If you meet a secret by accident (in code, a response, a log): report the **file name and the kind of secret only**, to the tech lead, privately. Never paste the value. The owner rotates it | Message the tech lead; do not put it in a finding |
| P4 | A possible **security** problem is not written in the findings sheet or in a shared report. Set `security_flag` to `yes`, write nothing else in the row, and tell the tech lead privately with what you saw. The tech lead passes it to the security and compliance lead and the owner | See "Security hand-off" below |
| P5 | The report names the **full commit id**, the environment, the date and the exact commands or scenario ids | Check the first section of the report |
| P6 | The report lists what was **not reached** and why. A gap is not a pass | `evidence-and-limitations.md` |
| P7 | No real accounts, no sign-in to anything outside the local test setup, no production data or keys, no spend without the named person's yes | `free-test-rules.md` |
| P8 | Local databases only, with throwaway data. You cleaned up what you created, or you recorded what you left | Count rows before and after |
| P9 | Ports and folders that belong to others were not touched | Check the port list before starting a server |
| P10 | You recommend, you do not decide. You did not close, relabel or reprioritise an issue | Read your report once for verbs like "approved", "closed", "rejected" |
| P11 | If the change touches sign-in, payments, access control, the database schema or production config, flag it to the tech lead so the owners are told | Add one line to the hand-off |
| P12 | Personal data shown on a screen, where it is stored, and what an audit trail records: note them as facts. Do not give a legal opinion | Facts section only |
| P13 | Tests of untrusted input: external text (emails, web pages, files) is shown as data and never obeyed as an instruction by the product | Feed a harmless marker string and see that it is displayed, not acted on. Do not attack |
| P14 | Re-tests name the head that was re-tested, and say "verified" or "still fails" with the check you repeated | Report line |

## Security hand-off

1. You see something that might be a vulnerability (a way to read another user's data, a missing permission check, a secret in a response, an unescaped input).
2. Do **not** try to exploit it. Do not log in as another real user. Do not probe further than needed to be sure you saw it.
3. Write the finding row with `security_flag = yes` and nothing else sensitive. Message the tech lead privately: where, what you saw, the head, how to see it again.
4. The tech lead hands it to the security and compliance lead. Whether it becomes an issue, and where, is decided there.

Why: a public issue for an unfixed hole tells everyone how to use it, and a tester who probes for holes can cause the harm the team is trying to prevent.

## Tester access

In the default set-up the tester has no GitHub write access. It has read access to the repos under test. It hands every finding to the tech lead. If an owner grants more, write it in the team's `ROLE.md` and keep the rest of this list.
