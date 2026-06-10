# DESIGN SPEC — ship-loop (dogfood run)

> Frozen document. The "UI" of this product is CLI output, markdown reports, and docs.
> This calibrates the evaluator's design/originality rubric for those surfaces.

## Direction
Terse, evidence-first, operator-grade. Every surface answers "what happened, what do I
do next" in one screen. The reader is a developer deciding whether to trust an
unattended loop with their repo and their money.

## Reference quality bars
1. This repo's own README comparison table and emoji-free engine output.
2. `git status` / `gh pr view` — dense, scannable, zero decoration.
3. cobusgreyling/loop-engineering failure catalog — tables with severities and
   mitigations, no marketing prose.

## Anti-examples (what slop looks like here)
- Emoji-decorated log lines and banner ASCII art in engine output.
- Notifications that say "Something needs your attention!" without the item, the file,
  and the next action.
- README features lists that describe aspirations as capabilities ("rounds up").
- Vague verdict prose ("looks good", "mostly works") — evidence or it did not happen.

## Rubric weights
| Criterion | Weight | 9/10 here means |
|---|---|---|
| Design | 0.2 | one-screen, scannable, next-action-first outputs |
| Originality | 0.1 | (low weight: operator tools should be boring) |
| Craft | 0.35 | tests-first, tolerant parsers, zero new deps, no regressions |
| Functionality | 0.35 | the five PRD metrics demonstrably hold |

## Must-have states
Every new command/script handles: missing state dir, malformed input, and
not-applicable platform — with a one-line actionable message, never a stack trace.
