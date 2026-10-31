---
name: Finding
about: A review, audit, QA or security finding. Do not put a live secret or an exploit recipe here.
title: "[finding] "
labels: ["type:finding", "status:new"]
---

<!--
Purpose: record one finding in the protocol's issue format.
Exposed secrets and vulnerabilities in public repositories do NOT go here: use the private route in the protocol, section 9.
-->

**Severity:** <critical | high | medium | low | info>
**Priority:** <P0 | P1 | P2 | P3>  (for security findings the severity is the priority)
**Owner:** <person or role who fixes it>
**Area:** <component or folder>
**Tier:** <T0 | T1 | T2 | T3>
**Candidate (not yet confirmed):** <yes | no>  (if yes, add the label `candidate`)

## Evidence

- Audited or tested head (full 40-character hash): <hash>
- Where: <file and line, or page and step>
- What was seen: <facts only, no secret values>
- Method: <how it was found: read, run, tool name>

## Impact

<who or what is affected, in one or two sentences>

## Task

- <what to do, concrete steps>

## Acceptance check

- <how anyone can tell it is fixed>

## Source

Raised by <role> (<owner>'s AI assistant), from <source: weekly audit, QA round, review of a pull request>
