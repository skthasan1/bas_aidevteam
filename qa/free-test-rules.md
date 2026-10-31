# Free test rules

Purpose: test without spending money, without real accounts and without touching shared data.

## The rule

**Free by default.** A test runs on a local copy, with stubs, on throwaway data. Anything that costs money needs a named person's yes, typed in the session that will spend it. A yes relayed through another session does not count.

Why: a test run that quietly calls a paid service or a real account is the most expensive kind of mistake, and it is easy to make when a key happens to be in the environment.

## What "free" means here

- **Local app, local database.** A throwaway database created for the test. Never a shared or production database.
- **Dummy keys only.** If a key is needed to start the app, use a placeholder or a test value the owner supplied. If the app starts and a paid call is reachable, find out how to switch it off before you press anything.
- **Stubs for outside services.** Intercept requests to payment, email, messaging, AI and storage services in the browser or in a local mock, and return a canned answer. Say in the report that the answer was stubbed, so no one reads "the model replied" as a fact.
- **No real accounts.** No sign-in to any real service. Use the app's local test sign-in method.
- **No outbound messages.** Never trigger an endpoint that sends a real message (chat, SMS, email, push). A hand-made request to such an endpoint sends a real message with real credentials. Ask the owner to try it live and report back.
- **Throwaway data.** Create what you need, record what you created, remove it, count before and after.
- **Local ports only.** Open only local addresses. If a page redirects outside, stop and report it.

## Check that it is free before you start

1. List the environment values the app reads. Are any of them real keys for paid services? If a value looks real, stop and tell the tech lead.
2. Start the app and read the log for outbound calls.
3. Do a dry pass with the network blocked for external hosts, if your tool can do it.
4. Write "cost: $0, stubs: <list>" at the top of the report.

## Cost classes in scenarios

| Class | Meaning | Rule |
|---|---|---|
| free | local, stubbed, no external call | run any time |
| cheap | a small paid call (for example a short model reply), under a stated amount | only with a cap and the named person's yes |
| paid | a real generation, real account or real message | only on request, with a price written before the yes |

## Spend rule

1. **Price first.** Write the expected cost of a paid step before you ask.
2. **Yes first.** The named person says yes in the session that will spend. Quote it in the report.
3. **Caps.** A daily cap and a per-service cap sit in the local environment file. The QA lead never raises a cap.
4. **Stop conditions.** Stop and message the tech lead if a step fails, a price is more than 25 percent over what was shown, a single step is above its stated limit, or you reach 80 percent of the cap.
5. **No loops.** Never repeat a paid call in a loop and never test load against a paid endpoint.
6. **Log it.** Every paid step is logged with time, price and what it bought.

## Load and stress

Local copy only. Say what load, for how long, on which machine, and what broke first. Never run it against a shared, staging or production system unless the owner has set one aside for the purpose and said so.

## Blind tests

If a test has notes or keys held back for a blind ranking, do not open them. If you do by mistake, say so at once.
