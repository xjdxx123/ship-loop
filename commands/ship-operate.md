---
description: Run one operate-phase round for a shipped product - triage, smoke, report (L1 first week; assisted fixes only after triage proves accurate)
argument-hint: ""
---

Run one operate round for the shipped product in the current project, per its `LOOP.md`
(generated at delivery; if absent, generate it from
`$CLAUDE_PLUGIN_ROOT/templates/LOOP.md.template` first and tell the user).

1. **Smoke**: `bash init.sh` boots + core-flow check. Red → dispatch ship-triage
   (Mode B); regressions become `hotfix` features via ship-state.mjs; with the user's
   standing approval in LOOP.md you may dispatch one implementer/evaluator pair to fix a
   single P1 regression — otherwise report only.
2. **Triage sweep** (ship-triage): new issues, error signals, dependency advisories
   (top 10), test health. Classify per the flake rule — never silence flakes with code.
3. **Write state**: update `STATE.md` (priorities, watch list, human inbox) and append
   one line to `loop-run-log.md`.
4. **Report**: one screen — what changed since last round, what needs a human, what the
   loop did. Quiet otherwise: notify only when a human decision is required.

Discipline: report-only (L1) for the first week of operation; graduate to assisted
fixes (L2) only after a week of accurate triage, and record that graduation in LOOP.md.
This command is designed to run on a cron/scheduled task.
