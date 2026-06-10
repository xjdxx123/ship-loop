---
name: design-intake
description: Phase 0 of ship-loop - turns a vague idea, an existing MVP, or a PRD into the frozen document set (PRD, TECH_SPEC, DESIGN_SPEC, BUILD_CHARTER) plus a derived feature_list.json, through a human-rich staged dialogue ending at the FREEZE GATE.
---

# Design Intake — human-rich Phase 0

Principle: **the human owns design; the machine owns the build.** Question density here
is what makes autonomy safe later. feature_list.json is ALWAYS derived from documents,
never directly from conversation — documents are the single source of truth.

## Mode detection (first action)
- Argument is a readable file path → **Path 3: PRD-given**.
- cwd has git history + a manifest (package.json/pyproject/etc.) + runnable entry →
  ask the user to confirm **Path 2: Brownfield refinement**.
- Otherwise → **Path 1: Greenfield**.
- `--autonomous` flag anywhere → degraded mode (below).

## Path 1 — Greenfield: the document cascade
Stage questions per document so the human's context never switches back and forth.
If `superpowers:brainstorming` is installed (check with the Skill tool list /
capability-map), invoke it for the questioning style; otherwise run the built-in flow.
Either way: **one question at a time, multiple-choice preferred, no question cap —
ask until the document is solid.**

1. **Product stage** → write `docs/ship-loop/PRD.md` from templates/PRD.template.md.
   Must cover: who exactly, the pain, ≥2 quantified success metrics, user journeys,
   non-goals, business model, launch definition. → human approves.
2. **Tech stage** → `TECH_SPEC.md` from templates/TECH_SPEC.template.md. Respect the
   scope rule banner (half-day-rework decisions only). → human approves.
3. **Taste stage** → `DESIGN_SPEC.md` from templates/DESIGN_SPEC.template.md. Insist on
   ≥3 reference sites and product-specific anti-examples — this file calibrates the
   evaluator; a lazy one produces a mediocre product. → human approves.
4. **Run parameters** → `BUILD_CHARTER.md` from templates/BUILD_CHARTER.template.md
   (budgets, parallelism, denylist, keys present). → human approves.
5. Dispatch **ship-initializer** → feature_list.json. Show the human: total count +
   first 5 in execution order + all ASSUMPTIONS entries. Human skims.

## Path 2 — Brownfield: audit first, then direction
1. Dispatch **ship-triage** (Mode A) BEFORE asking anything → `CURRENT_STATE.md`.
2. Present the audit, then ask directional questions informed by it: refinement goals
   (perf / UX / feature gaps / monetization)? no-touch zones? user-behavior signals to
   protect? quantified success criteria? One at a time, until clear.
3. Write `REFINEMENT_PRD.md` (delta-PRD: what changes, what must not), extract
   TECH_SPEC from reality + change decisions only, DESIGN_SPEC as in Path 1.
4. Initializer derives the delta feature list (`type: fix|improve|new` via bug/feature
   types + notes). The existing test suite is the regression floor — record that in the
   charter denylist section.

## Path 3 — PRD-given: gap questions only
Read the user's PRD → diff against the four templates → ask ONLY about holes (missing
acceptance criteria, missing non-goals, undecided stack, absent design direction).
Never re-ask what their document already answers. Confirm your completed understanding,
then write the four files (quoting their PRD verbatim where possible) and derive.

## FREEZE GATE (all paths converge here)
Present: the four documents + feature count + first-5 execution order + open
ASSUMPTIONS. Say exactly what autonomy means now: "After freeze I stop asking questions.
Blockers get parked to NEEDS_HUMAN.md, frozen docs are read-only to the loop
(spec-conflicts come back to you), and the standing human gate is real-money charges.
Reply **go** to start the build."
On go: create `docs/ship-loop/ACTIVE`, hand off to skills/conductor.

## Degraded autonomous mode (--autonomous / headless)
No human available: self-answer every stage using prior-art search + defaults, log every
bet as an ASSUMPTIONS.md entry, skip approvals, auto-freeze, start. This is a degraded
mode — design quality is on the operator. Never silently enter it: log loudly at start.
