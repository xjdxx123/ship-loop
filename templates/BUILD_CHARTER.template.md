# BUILD CHARTER — <Product Name>

> Frozen document. Read-only to the loop after FREEZE. Consumed by: the conductor
> (run parameters) and every sub-agent (boundaries). This is the autonomy contract:
> everything the machine may decide alone, and the few things it may not.

## Run parameters

| Key | Value | Notes |
|---|---|---|
| max_parallel_pairs | 3 | implementer/evaluator pairs; hard cap min(8, floor((cores-2)/2)) |
| K | 3 | repair attempts per feature before park/reset |
| negotiation_rounds_max | 2 | contract haggling cap |
| burst_threshold | 8 | ≥N independent pure-code features → may delegate batch to a Workflow script (UI verification always returns to the main loop) |
| token_budget_day | 2000000 | estimate; conductor accounts per round; over → checkpoint + pause + NEEDS_HUMAN |
| handoff_after_rounds | 10 | conductor writes HANDOFF.md and relays |

## Denylist (the loop must never edit)

- `docs/ship-loop/PRD.md`, `TECH_SPEC.md`, `DESIGN_SPEC.md`, `BUILD_CHARTER.md` (frozen docs — spec-conflict park instead)
- `.env`, `.env.*`, any file containing secrets
- `.github/workflows/` of the product repo (CI changes need a human)
- <!-- product-specific paths -->

## Park categories (stub + park + continue, never block)

1. **money** — anything that spends or charges
2. **withheld-secret** — a key/credential the human has not provided
3. **irreversible** — external actions that cannot be undone (domain purchase, production data migration, public announcement)
4. **deadlock** — K failures with no diagnosis path

## Commercialization keys (aggressive unlock)

| Key in .env | Unlocks | Without it |
|---|---|---|
| VERCEL_TOKEN / NETLIFY_AUTH_TOKEN / CLOUDFLARE_API_TOKEN | real deploy | deploy-ready config + parked deploy step |
| SUPABASE_URL + SUPABASE_ANON_KEY (or DATABASE_URL) | live database | local sqlite/postgres + migration scripts |
| STRIPE_SECRET_KEY (sk_test_…) | automated test payments | mocked payment provider |
| STRIPE_SECRET_KEY (sk_live_…) | live payment configuration | — |
| RESEND_API_KEY | transactional email | console-logged email stub |

**Standing human gate (cannot be configured away): executing a real-money charge.**

## Skill-install allowlist (official orgs auto-install from the awesome-agent-skills catalog)

`anthropics`, `vercel`, `stripe`, `supabase`, `cloudflare`, `netlify`, `resend`
Third-party sources → suggestion goes to NEEDS_HUMAN.md instead.

## Stack overrides

<!-- Rows here override TECH_SPEC defaults for this product. Usually empty. -->
