# Failure Modes

Ways loops like this one fail, and what in ship-loop is load-bearing against each.
Adapted with credit from cobusgreyling/loop-engineering's catalog and Anthropic's
long-running-agents work; ship-loop-specific mitigations noted per row.

| # | Failure | Symptom | ship-loop mitigation |
|---|---|---|---|
| 1 | Infinite fix loop | same feature patched 5+ times, never converges | K=3 circuit breaker → park or reset; attempts tracked in state, not vibes |
| 2 | State rot | feature list references stale reality | every state read AND write revalidates schema; state engine is the only writer |
| 3 | Verifier theater | "approved" but tests fail later | verdicts with empty `commandsRun` are structurally invalid; UI requires a real browser walk; reconciliation rule (shown == computed) |
| 4 | Premature victory | model declares done mid-list | deterministic Stop-hook gate counts the JSON, not the model's mood |
| 5 | Gate spin | Stop-hook blocks forever on a stuck loop | anti-spin: 3 stops with unchanged state hash → allow stop + NEEDS_HUMAN escalation |
| 6 | Token burn | sub-agent chains on empty work | conductor smoke + `next` are cheap; pairs dispatched only for eligible features; per-round accounting + daily budget pause |
| 7 | Over-reach | loop edits auth/payments/CI "while it's here" | charter denylist enforced in implementer prompt + contract scope; smallest-diff rule; evaluator rejects out-of-scope diffs |
| 8 | Comprehension debt | velocity up, nobody can explain the code | contracts/ directory is a per-feature "what done meant" archive; loop-run-log is append-only history; delivery includes evidence summary |
| 9 | Cognitive surrender | human stops having opinions | Phase 0 forces the human to write opinions down (PRD metrics, DESIGN_SPEC anti-examples); spec-conflicts come BACK to the human instead of being silently absorbed |
| 10 | Parallel collision | two agents edit the same files | one worktree per feature, conductor merges serially; independent-only dispatch |
| 11 | Flake whack-a-mole | intermittent test "fixed" with code churn | triage classifies flakes (3× rerun); quarantine only, never business-code changes |
| 12 | Context anxiety / rot in long sessions | coherence degrades over hours | conductor handoff after N rounds; fresh sub-agent contexts per feature; HANDOFF.md is one screen by rule |
| 13 | Sycophantic QA | evaluator finds a bug, says "fix later", passes it | REJECT default stance; uncertainty = refuted; newFindings are mandatory output, not optional |
| 14 | Relay necromancy | cron resumes a run the human killed | relay tick checks ACTIVE && !PAUSED and self-disarms otherwise |

## Reading traces is the tuning loop

When a run goes wrong, the fix is rarely a new mechanism. Read `loop-run-log.md`, the
contracts of the features that churned, and the evaluator verdicts; find where its
judgment diverged from yours; then sharpen DESIGN_SPEC anti-examples or the contract's
verification commands. (Anthropic, on building theirs: "the whole art to building this
system was reading the traces.")
