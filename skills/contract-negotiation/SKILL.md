---
name: contract-negotiation
description: The pre-build negotiation protocol between implementer and evaluator - the two agents agree what "done" means for one feature before a line of code is written; acceptance is judged against the negotiated contract, not the spec.
---

# Contract Negotiation

The key structural idea (per Anthropic's harness work): a fixed plan has nobody arguing
with the main loop. So before the implementer writes a single line, the builder and the
critic negotiate the definition of done — via files on disk, in separate contexts.
The evaluator then grades against the NEGOTIATED contract, not the planner's spec and
not either agent's private interpretation.

## Protocol (max `negotiation_rounds_max` rounds, charter default 2)

1. **Implementer proposes** `docs/ship-loop/contracts/<id>.md` (format below): scope,
   how it intends to prove each part, what it will NOT do.
2. **Evaluator counters** by editing the same file under `## Evaluator response`:
   typical objections — scope too big (split it), verification too weak ("renders
   without error" → "submitting empty form shows inline validation, POST returns 422"),
   missing edge cases (empty/loading/error states, auth boundaries, concurrent use).
3. **Agreement**: evaluator writes `AGREED` in the status line. No agreement after the
   round cap → conductor arbitrates: evaluator's verification list wins, implementer's
   scope boundary wins (harsh tests on a small scope beats weak tests on a big one).

## Contract file format

```markdown
# Contract F-012 — <feature title>
Status: PROPOSED | COUNTERED | AGREED

## Done means
<!-- 3-8 bullets, each independently checkable. Granular criteria are the point:
     vague criteria produce vague critiques, and the builder just shrugs. -->

## Verification commands
<!-- Exact commands/browser actions the evaluator will run. The implementer writes
     these as failing tests FIRST (TDD). -->

## Out of scope
<!-- What this feature deliberately does not include (prevents scope-creep rejects). -->

## Edge cases owned
<!-- empty/loading/error states, boundary inputs, auth/permission cases. -->

## Evaluator response
<!-- countering notes per round; final line: AGREED + date -->
```

## Rules
- Granularity floor: a contract with fewer than 3 "done means" bullets or zero
  executable verification commands is auto-COUNTERED.
- The contract is append-only once AGREED; mid-build scope changes mean the feature was
  too big — park it and let the initializer re-split.
- Contracts are the loop's institutional memory of "what done meant" — never delete them.
