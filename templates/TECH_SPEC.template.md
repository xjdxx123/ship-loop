# TECH SPEC — <Product Name>

> Frozen document. Read-only to the loop after FREEZE. Consumed by: every implementer
> sub-agent (injected at startup — this file is how the loop avoids re-deriving
> conventions every round, i.e. how it pays down intent debt).
>
> SCOPE RULE: this file fixes only decisions whose reversal costs half a day or more —
> stack, data model, directory layout, auth approach, key integrations. It must NOT
> contain function signatures, component breakdowns, or implementation routes; those
> belong to per-feature contract negotiation. Wrong decision costs five minutes →
> leave it to the loop.

## Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend |  |  |
| Backend |  |  |
| Database / Auth |  |  |
| Deploy target |  |  |
| Payments |  |  |
| Email |  |  |

## Architecture

<!-- One paragraph + optional mermaid. Boundaries and data flow only. -->

## Data model

<!-- Entities, fields, relations. This IS a half-day-rework zone: be precise. -->

## Directory layout

```
<!-- Top two levels only. -->
```

## Conventions

<!-- Naming, error handling, validation-at-boundary, empty/loading/error states, env/secrets handling. -->

## Key decisions + rationale

<!-- Each: decision, alternatives considered, why. The loop quotes these instead of relitigating them. -->

## Integration boundaries

<!-- External services, what is mocked until keys exist, what the stub looks like. -->
