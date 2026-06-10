# Protocol notes — v0.3.0 dogfood run (2026-06-10)

Drafted by ship-retrospect (full mode) for human PRs to the plugin repo. Observations
and story drafts only — no plugin file was touched; the retro cannot file PRs.

## 1. 2-leg dispatch for prompt-assets worked — but zero rejects leaves K untested

The conductor adapted dispatch by feature kind: code features ran the full 4 legs
(propose, negotiate, implement, evaluate); prompt-asset features collapsed to 2
(run-log round 2: "dispatching F-002 (4-leg) + F-005 (2-leg, prompt-asset)"). Outcome:
16/16 passed, zero REJECT verdicts, `attempts: 0` on every feature in
feature_list.json.

Honest dual reading of "zero rejects":
- Evidence for evaluator thoroughness: the negotiation trails show defects caught
  upstream where they are cheapest — F-001/F-002/F-004 each took five binding
  tightenings (including a real cross-line `\s` regex bug in F-002's proposed pin
  that would have enforced a budget no row states), and the no-counter contracts
  (F-013/F-015/F-016) document full re-derivation audits, not rubber stamps. Rejects
  did not vanish; they moved into counters, which is the design intent.
- Evidence it proves less than it looks: the REJECT → `--bump-attempts` → K=3 →
  park/reset path (conductor Apply verdict) has never executed in production. Its only
  coverage is unit tests. 16/16 validates the happy path and the negotiation loop; it
  says nothing about whether K=3 is tuned right, whether re-dispatch-with-evidence
  converges, or whether park/reset wording works cold.
- Audit gap: only 6 of 16 contracts carry an explicit `## Evaluator response` /
  no-counter section. For the other 10, thoroughness cannot be audited from the
  contract alone — silence is indistinguishable from omission. PR idea: the contract
  template mandates a negotiation-trail section (verdict + tightenings, or explicit
  "no counter" + what was re-derived).

## 2. The budget gate could not protect the run that built it (hook arming lag)

Charter `token_budget_day` 1,500,000; actual ~3,000,000 (2x), recorded honestly in
NEEDS_HUMAN.md. Mechanism: F-002's stop-hook arms at session start via plugin hooks;
the building session predated the install, so the gate merged mid-run never armed for
the very session that built it. Any run that hot-installs or updates the plugin
mid-session has the same blind spot.

PR idea: conductor self-metering. The conductor can capture its own transcript path at
entry; round step 8 (Account) runs
`node "$CLAUDE_PLUGIN_ROOT/scripts/ship-state.mjs" cost --transcript <own>` and
compares the total to the charter row, pausing itself at breach — the hook stays as
the backstop for armed sessions. This also fixes observability: the first est-tokens
figure in this run's log appears only at round 3; self-metering would have shown the
2x trajectory mid-run.

## 3. Evaluator-uncommitted contract flips block worktree removal (hit once, F-010)

The F-010 evaluator flipped contract status in the worktree without committing;
`git worktree remove` refused at merge time. The conductor improvised: applied the
flip on main and force-removed (lesson recorded 10:08Z).

PR ideas (wording fixes): (i) adversarial-eval skill — any file the evaluator edits in
the worktree, contract status flips included, MUST be committed before the verdict
returns; an uncommitted tree is an incomplete verdict. (ii) conductor Apply-verdict
merge path — pin the recovery (`git -C <wt> status --porcelain` non-empty → commit or
discard before `worktree remove`) so recovery is protocol, not improvisation.

## 4. Conductor accounting drifted from its own pinned format — and broke the retro parse rule

Round step 8 pins `<ISO-ts> | round N | done X/Y | parked P | new findings F |
est tokens T`. All 11 actual log lines are free-form: `done X/Y` never appears;
est-tokens appears twice, both as cumulative checkpoints ("460000
cumulative-subagents", "~3000000 TOTAL") rather than per-round figures; the final line
carries a live miscount corrected inline ("14 passed + 0 parked... recount: 16
passed").

Consequence: cost-history's strict parse rule (F-003: X of the final `done X/Y` line +
summed `est tokens` figures) was unsatisfiable on the first run after it was pinned —
and naive summing would have double-counted (460k is subsumed in the 3M total). This
retro appended a disclosed defensible record instead of nothing: `features_done` 16
(gate line + feature_list.json ground truth, `stats` = 16/16 passed), `est_tokens_total`
3,000,000 (the TOTAL-labeled final figure). F-003's edge case anticipated appending
nothing when the log carries neither token; half that premise went stale mid-run
(est-tokens figures started appearing after F-003 landed).

PR ideas: (i) emit the accounting line from the engine, not hand-prose —
`ship-state stats` already knows done/parked counts; (ii) repoint the retro parse rule
at ground truth: `features_done` from feature_list.json at delivery, est tokens from
`cost` over session transcripts, prose log as fallback only.

## 5. Living-list rate: 7 of 16 features were mid-run discoveries

F-010 through F-016 all entered via absorbed findings (run-log lines 2, 4, 5, 6, 8, 9;
the dispatch brief said 6 of 16 — the log shows 7 absorption events for 7 distinct
ids). Frozen plan: 9 features; delivered: 16; growth +78%. The 2x budget overrun is
therefore roughly explained by list growth alone — the charter budgeted the frozen
list, not the discovered one.

PR idea: the pre-freeze estimate (design-intake) quotes a discovery multiplier from
history next to the per-feature rate, and the charter `token_budget_day` guidance is
sized on the multiplied count, not the frozen count.

## 6. Append-only correction notes proved out twice — pin the format

F-013 (→ contracts/F-003.md) and F-015 (→ contracts/F-008.md) independently converged
on the same shape: heading `## Correction note (<id>, <date>)`, byte-identity claim
for everything above the heading, paraphrase-never-quote the false text, per-file grep
counts pinned separately. Two independent reinventions of one format is template
material. PR idea: add the correction-note shape to the contract-negotiation skill /
contract template.
