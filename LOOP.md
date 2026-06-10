# LOOP.md — ship-loop (this repository)

This repo eats its own dogfood: it is maintained with the same operate-phase discipline
it generates for shipped products.

## Active loops

### CI (every push / PR)
- `node --test` (state engine + gate), `node scripts/validate-repo.mjs` (structure +
  cross-references), `bash -n` on all shell scripts.
- Red main outranks everything else.

### Weekly Triage (L1 — report only)
- Cadence: Mondays (`.github/workflows/daily-triage.yml`, manual dispatch also enabled).
- Reads issues, PRs, dependency advisories; writes findings to `STATE.md`.
- Report-only. Fix PRs are human-initiated. Graduation to L2 requires a recorded month
  of accurate triage.
- Skips gracefully when `ANTHROPIC_API_KEY` secret is absent (public forks).

## State layout
- `STATE.md` — priorities + human inbox (root)
- `stories/` — run records: wins AND failures, with token cost (required fields in
  stories/README.md)

## Kill criteria
- Triage noise two weeks running → silence the schedule, keep manual dispatch.
- Any loop editing `scripts/ship-state.mjs`, `hooks/`, or release tags without a human
  PR review → disable immediately (these paths are this repo's denylist).
