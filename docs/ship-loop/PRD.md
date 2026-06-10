# PRD — ship-loop (dogfood run)

> Frozen document. This repo builds itself with itself; this PRD governs the v0.3.0
> campaign ("developer trust pack"). Prior product intent lives in
> `docs/superpowers/specs/` (v1, v0.2) and is not restated here.

## Round 2 amendments (2026-06-10, motive: developer-adoption gaps)

Intake provenance: owner-approved scope from live design dialogue (Tier 1-2 of the
adoption-gap analysis). Question stages were satisfied conversationally; no assumptions
logged.

### What (this round)
Close the five gaps that decide whether a developer trusts an unattended loop:
real cost metering with a hard budget stop, escalation notifications, PR merge mode,
one-command rollback, and a permissions preflight — plus the JS-with-types decision
(@ts-check, no TS migration).

### Success metrics (quantified)
- [ ] The stop-hook gate reads REAL cumulative tokens from the session transcript and
      allows-stop + pauses the run at charter budget; proven by fixture tests.
- [ ] An escalation (new NEEDS_HUMAN row, budget pause, delivery) produces a desktop
      notification on macOS/Linux without any new runtime dependency.
- [ ] With `merge_strategy: pr`, no feature merges to main without a PR carrying the
      evaluator's verdict evidence.
- [ ] `/ship:rollback F-xxx` reverts a delivered feature's merge commit and reopens the
      feature, in one command.
- [ ] `npx tsc --noEmit` passes in CI over the existing scripts with zero runtime deps
      added.

### Non-goals (this round)
Issue-source bridging (v0.4), multi-product dashboard, Windows runners, multi-runtime.

### Launch definition
v0.3.0 tagged, CI green, README (en/zh) documents all five capabilities, installed
plugin updated on the owner's machine.
