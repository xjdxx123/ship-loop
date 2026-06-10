---
name: ship-deliver
description: Phase 2 of ship-loop - final 3-vote panel, keys-unlocked real deployment and payment configuration, launch checklist, and the operate-loop handoff (LOOP.md, STATE.md, /ship:operate cron).
---

# Ship & Deliver

Runs when `ship-state.mjs gate` passes (every feature passed or parked). Goal: push the
product as far toward LIVE as the provided keys allow, document exactly what remains,
and hand the product over WITH its own maintenance loop.

## 1. Final panel (adversarial, product scale)
Three evaluator instances (skills/adversarial-eval panel mode) independently attempt to
refute: "this product meets the PRD and is commercializable." Required walks: every PRD
user journey end-to-end in a real browser; clean-clone boot via `init.sh`; PRD success
metrics spot-checked; DESIGN_SPEC anti-example sweep. Majority refute → findings become
features, back to the conductor. Pass → continue.

## 2. Keys scan → real-world actions (aggressive unlock)
Read `.env` (never print values). Per BUILD_CHARTER table:

| Found | Do |
|---|---|
| Deploy token (Vercel/Netlify/Cloudflare) | real production deploy via the matching provider skill (capability-routing); verify the LIVE URL serves the core journey |
| DB/auth keys (Supabase/DATABASE_URL) | provision, run migrations, point prod config at it |
| `sk_test_` Stripe | full test-mode checkout e2e; record the test charge id as evidence |
| `sk_live_` Stripe | configure live products/prices/webhooks — **then stop: executing a real-money charge is the standing human gate; put the one-command instruction in the checklist** |
| RESEND_API_KEY | verified sender + one real transactional send to the owner |
| Missing key | parked row: stub stays, checklist row says exactly which key unlocks it |

## 3. Deliverables (all committed)
- `launch-checklist.md` (templates/launch-checklist.template.md): every row checked-with-
  evidence or parked-with-action.
- `NEEDS_HUMAN.md`: final sweep — every parked item readable cold: category, placeholder
  used, exact human action.
- `LOOP.md` (templates/LOOP.md.template) + initial `STATE.md`: the product's operate
  loops, L1 report-only first week, kill criteria, budget.
- Suggested cron line for `/ship:operate` (do not arm it without the human).

## 4. Handover message (the loop's last words)
One screen: live URL (or "deploy-ready, missing X"), features done/parked counts, test
+ panel evidence summary, the top-3 human actions in order of unlock value, total
estimated token spend from loop-run-log. Then remove `docs/ship-loop/ACTIVE`.
Honesty rule: anything not verified by an executed command or a browser walk is listed
as unverified — the loop does not round up.
