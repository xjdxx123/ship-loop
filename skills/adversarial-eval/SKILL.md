---
name: adversarial-eval
description: Verification doctrine for ship-loop evaluators and panels - evidence rules, the four-criteria rubric, K-failure park-vs-reset decision, flake quarantine, and 3-vote panel mode for critical features and final ship signoff.
---

# Adversarial Evaluation Doctrine

Self-evaluation is a trap. The builder is structurally incapable of harsh judgment of
its own work; a standalone critic is easy to keep harsh. ship-loop therefore never lets
an implementer mark its own feature passed, and never lets a verdict through without
executed evidence.

## Evidence rules (hard)
1. A verdict with empty `commandsRun` is INVALID — discarded by the conductor, evaluator
   re-dispatched once with a warning, then the feature is treated as REJECT.
2. `outputExcerpt` must quote the decisive output (≤10 lines). "Tests pass" without the
   run is theater.
3. UI features: evidence must come from driving the real app (Playwright/Chrome MCP or
   scripted browser), not from reading components. The reference failure: play mode that
   "looks done" but arrow keys do nothing — caught only because the evaluator played.
4. Reconciliation: any number shown to users must equal the number computed. Hardcoded
   plausible values are the canonical cheat to hunt.

## Rubric
Four criteria — design, originality, craft, functionality — weighted per
`docs/ship-loop/DESIGN_SPEC.md` (default 0.3/0.3/0.2/0.2; functionality is table stakes,
slop-avoidance is the differentiator). The evaluator quotes the DESIGN_SPEC lines and
anti-examples it applies. Scores are for trend detection across attempts, not vibes:
flat scores across attempts ⇒ `recommendReset`.

## K-failure decision (conductor applies, charter K=3)
- attempts ≥ K and the blocker is EXTERNAL (missing key, paid tier, irreversible step)
  → **park** with the four-category tag and the exact human action needed.
- attempts ≥ K and the approach itself cannot hill-climb (flat rubric, recurring same
  evidence) → **reset**: discard worktree, re-decompose the feature smaller. Models
  defending their own 10th patch is how single loops die; an independent critic willing
  to say "throw it away and restart" is the unique advantage of this split — use it.

## Flake rule
Intermittent test failure (fails, then passes on rerun ×3) = `flake`: quarantine and
record; NEVER change business code to silence it; never count it as the feature's failure.

## Panel mode (3 votes)
For features touching **money / data-correctness / security / auth**, and for the final
ship signoff: three evaluator instances run independently with different lenses
(correctness / security / hostile-user). Majority refute (≥2) = REJECT. The final-ship
panel refutes the claim "this product meets the PRD and is commercializable" — its
evidence requirements are the same, at product scale (full journey walks, payment
test-mode e2e, deploy boot from clean clone).
