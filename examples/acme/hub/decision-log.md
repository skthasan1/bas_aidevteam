# Decision log

Purpose: the permanent record of decisions, so nobody has to ask twice and a locked decision stays locked. Newest first. Only a named person's decision is recorded as a decision; AI recommendations are recorded as such.

| id | Date | Decision | Decided by | Reason | Replaces / related |
|---|---|---|---|---|---|
| L-001 | <date> | Short statement of what is decided | Dana | One-sentence reason | none |
| L-002 | <date> | | | | D-001 |

## Locked decisions
A decision becomes locked when the owner says so. A locked decision is changed only by a new row that names it, with the owner's word and the reason. Developers read this list before design work.

| id | Locked decision | Why |
|---|---|---|
| LD-01 | Example: all server-side database access goes through one library | One place to secure and test |

## Decisions taken under the deadline rule
(Only if the optional deadline rule is on.) Decisions the tech lead took after the owner did not answer in time. Each row says: date, request, what was decided, why, and a column "Owner review" (pending / agreed / changed).

| Date | Request | Decision | Why | Owner review |
|---|---|---|---|---|
