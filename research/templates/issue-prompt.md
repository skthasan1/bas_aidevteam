# Issue draft: prompt change

Purpose: turn an adopted prompt idea into an issue for the prompt owner. A prompt change is never made from the research side. The fields are the issue format of `docs/PROTOCOL.md` section 8.

```
Title: [Prompt] <idea> (<test id>)

Priority: P0 | P1 | P2 | P3
Severity (findings only): <leave out for a prompt change>
Owner: <prompt owner>
Area: <prompt file or component>
Tier: T0 | T1 | T2 | T3

Evidence:
- <library id, report path, test id, counts>
- <the exact wording tested>

Task:
- <the change, behind a named setting that is off by default, a prompt version bump, and a benchmark with several repeats per case>

Acceptance check:
- <benchmark result that must hold>

Raised by <role> (<owner>'s AI assistant), from <source: a research test round>
```
