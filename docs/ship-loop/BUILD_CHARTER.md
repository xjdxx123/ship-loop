# BUILD CHARTER — ship-loop (dogfood run, Round 2)

> Frozen document. Run parameters for building v0.3.0 with the loop itself.

## Run parameters
| Key | Value | Notes |
|---|---|---|
| max_parallel_pairs | 2 | small features; merge serialization dominates anyway |
| K | 3 | |
| negotiation_rounds_max | 2 | |
| burst_threshold | 8 | not expected to trigger this run |
| token_budget_day | 1500000 | hard stop once F-001/F-002 land mid-run; estimates before that |
| handoff_after_rounds | 10 | |
| merge_strategy | merge | pr mode is BEING BUILT this run; next run uses it |

## Denylist (this run)
- `docs/superpowers/specs/*` (historical specs are immutable)
- `docs/ship-loop/PRD.md`, `TECH_SPEC.md`, `DESIGN_SPEC.md`, this file (frozen — spec-conflict park)
- `LICENSE`, `.claude-plugin/marketplace.json` owner fields
- NOTE: `.github/workflows/ci.yml` is EXCLUDED from the default denylist this run
  (F-008 adds the typecheck step there; smallest-diff rule still applies)

## Park categories / keys
Unchanged from `templates/BUILD_CHARTER.template.md`. No deploy/payment keys are
relevant: delivery = git push + tag + plugin update on the owner's machine.

## Run notes (honesty)
- This session predates the plugin install, so the live Stop-hook gate is not armed
  here; the conductor follows the round protocol by discipline, and gate behavior is
  covered by fixture tests (F-002).
- `docs/ship-loop/` is committed in this repo (public dogfood) — the .gitignore
  exception is deliberate.
