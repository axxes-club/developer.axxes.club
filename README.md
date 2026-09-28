# developer.axxes.club

The AXXES developer platform: register an app, get a key, read the
reference for every product, and see exactly what you are being charged
for.

## What is here so far

This is the foundation, and it is deliberately built before the screens so
the rules are decided once and enforced everywhere:

| Piece | File | Why it is there |
|---|---|---|
| Plan catalog | `src/lib/plans/catalog.ts` | What each plan allows, as data |
| The paywall | `src/lib/plans/gate.ts` | One function every surface calls |
| Product registry | `src/lib/registry/products.ts` | Docs index, app form, plans |
| Metering | `src/lib/usage/meter.ts` | One row per call, rolled up daily |
| Keys and OAuth secrets | `src/lib/apps/keys.ts` | Minted once, stored hashed |

## The one idea

A paywall enforced in three places separately is a paywall that eventually
disagrees with itself, and the disagreement is always in someone's favour.
So `gateFor(tenantId)` is the only thing that answers "may this workspace
do this", and the gateway, the portal and the docs all call it. The pricing
page renders the same objects the gateway enforces, so the page cannot
promise something the API will refuse.

## The key format

`a_axxes_<id>_<secret>`. The id is located **by position**, never by
splitting on `_`: base64url emits `_` as a character and about half of all
secrets contain one, so a split rejects roughly half of every key ever
minted. This is the third AXXES product to get this wrong, so it is written
down rather than re-derived.

## Not built yet

Screens for apps, keys, usage, docs and prompts. The data layer is in
place and the rules are tested; the pages are not written.
