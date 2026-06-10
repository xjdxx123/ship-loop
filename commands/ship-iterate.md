---
description: Start a new ship-loop campaign on a product that already has ship-loop history - feedback-list intake, reproduce-first triage, delta questions, re-freeze, autonomous build
argument-hint: "[path/to/feedback.md | pasted complaints] [--autonomous]"
---

Run a ship-loop ITERATE round in the current project: $ARGUMENTS

Boundary: **operate** maintains health (patrol + small fixes), **iterate** wages a new
campaign (systematic dissatisfaction → delta docs → full build loop), **ship** starts
from zero.

1. **Preconditions**: `docs/ship-loop/` holds frozen docs (any prior round counts). If
   `ACTIVE` exists, stop — `/ship:status` to inspect, `/ship:resume` to continue. If no
   ship-loop history exists, point to `/ship` (brownfield intake) instead.
2. **Phase 0 delta**: invoke `skills/design-intake` **Path 2b** with $ARGUMENTS as the
   feedback list: dispatch ship-triage to reproduce every complaint first (reproduced →
   bug features with repro-as-verification; unreproduced → back to the user), then delta
   questions only, then `## Round N amendments` on the frozen docs, then re-freeze.
   Profile prefills and pending proposals are confirmed here.
3. **Build**: on "go", create `docs/ship-loop/ACTIVE` and run `skills/conductor` until
   the gate passes. The prior round's tests and passed features are the regression
   floor — breaking them is a hotfix, not a discussion.
4. **Deliver + learn**: `skills/ship-deliver`, whose final step dispatches the
   retrospective (full mode) — iterate rounds are its richest learning material.
