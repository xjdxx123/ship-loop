---
description: Start ship-loop - from a vague idea, an existing MVP, or a PRD file to a shipped product (human-rich design intake, then an autonomous build loop)
argument-hint: "<idea> | <path/to/PRD.md> [--autonomous]"
---

Start a ship-loop run for: $ARGUMENTS

You are entering the ship-loop protocol. Work in the current project directory
(`$PRODUCT_DIR` = cwd).

1. **Refuse double-starts**: if `docs/ship-loop/ACTIVE` exists, stop and tell the user a
   run is already active — `/ship:status` to inspect, `/ship:resume` to continue,
   `/ship:pause` to halt. Do not start a second loop in the same project.

2. **Phase 0 — Design Intake**: invoke the plugin skill `skills/design-intake` and follow
   it exactly: detect the path (greenfield idea / brownfield MVP in cwd / PRD file from
   $ARGUMENTS), run the staged human-rich dialogue, produce the frozen document set
   (PRD.md, TECH_SPEC.md, DESIGN_SPEC.md, BUILD_CHARTER.md), dispatch the
   ship-initializer agent to derive feature_list.json, and stop at the FREEZE GATE for
   the user's "go". With `--autonomous`, take the degraded self-design route (loudly).

3. **Phase 1 — Build**: on "go", invoke `skills/conductor` and run the round protocol
   until the gate passes. From this point you ask the user nothing; blockers park to
   NEEDS_HUMAN.md.

4. **Phase 2 — Deliver**: when `ship-state.mjs gate` exits 0, invoke `skills/ship-deliver`.

The Stop-hook gate (hooks/gate.sh) will block premature session exits while ACTIVE
exists and features remain — that is by design; re-enter the conductor round when it does.
