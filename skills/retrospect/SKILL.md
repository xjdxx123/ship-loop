---
name: retrospect
description: When and how ship-loop learns - the trigger matrix, three-layer output rules, promotion thresholds, and autonomy ladder for the retrospective agent that runs after deliveries and operate rounds.
---

# Retrospect — how the loop learns

The loop's own design is also design, and the human owns design. So evolution is
**proposal-first**, evidence-thresholded, append-only audited, and structurally barred
from the protocol layer. What it learns compounds: profiles shorten the next intake,
routing-overrides sharpen dispatch, playbooks make the next delivery cheaper.

## Trigger matrix
| Event | Mode | Dispatched by |
|---|---|---|
| ship / iterate delivery completes | full | skills/ship-deliver (final step) |
| operate round completes | light | commands/ship-operate |

Dispatch the **ship-retrospect** agent; it carries the detailed read/write protocol.

## The three layers (and the global-vs-project answer: both, by distillation)
- **L1 project** (`docs/ship-loop/learnings.json`): this codebase's pitfalls. Automatic.
  Never leaves the repo.
- **L2 user profile** (`~/.claude/ship-loop/profile/`): preferences true of the HUMAN
  across products. Proposal-first: retro appends to `proposals.md`; design-intake
  confirms with the human at the next run (one line each), applies accepted ones to
  `charter-defaults.json` / `intake-prefills.md` / `routing-overrides.md` /
  `USER_PROFILE.md`, and logs every application to `evolution.log` (append-only).
  One exception for measurements: after each delivery the retro appends one fact record
  `{product, features_done, est_tokens_total, ts}` to `cost-history.json` (features_done
  = X of the final `done X/Y` line in loop-run-log.md; est_tokens_total = the sum of its
  `est tokens` figures; either missing → append nothing, never a guessed record) —
  telemetry, not preference, so it skips the proposal queue; design-intake reads it only
  to quote the pre-freeze cost estimate.
- **L3 community**: protocol = plugin files, human-PR only, retro may only draft notes;
  playbooks = provider execution knowledge in SKILL.md format (see playbooks/README.md),
  drafted locally after ≥2 successful deliveries, published by human PR.

## Promotion thresholds (anti-noise)
- 1 occurrence → L1 only.
- ≥2 products show the same preference → L2 proposal.
- ≥2 successful deliveries on a provider → L3 playbook draft.
- A proposal rejected twice at intake → drop it and stop re-proposing (record in
  evolution.log as `rejected-final`).

## Autonomy ladder
1. **Start**: everything L2 is proposal-first.
2. **Graduation**: a proposal CLASS (e.g. intake-prefills) with one month of accepted
   proposals and zero rejections may be marked `auto-apply` in USER_PROFILE.md — by the
   human, at intake, never by the retro itself.
3. **Never**: plugin skills/agents/templates self-modification; playbook auto-publish;
   anything that skips evolution.log.

## Conflict rule
Local beats global, always: a project's explicit choice (in its frozen docs or charter)
overrides any profile default. Prefills are offers, not decisions — "confirm, don't
cold-ask" is the whole mechanism.
