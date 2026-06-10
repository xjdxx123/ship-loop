# Playbooks — provider execution knowledge (L3b)

How real-world actions (deploy, payments, email, auth, databases) actually get executed,
in SKILL.md format, with provenance. This directory is the community-shared half of
ship-loop's evolution layer — and its compounding asset: every verified delivery makes
the next one cheaper.

## Lifecycle

```
official skills (awesome-agent-skills allowlist)   ← consumed first, always
        + delivery evidence (loop-run-log, ship-deliver)
        ↓ retrospective distillation (only after ≥2 successful deliveries on a provider)
local draft   ~/.claude/ship-loop/playbooks/<provider>/SKILL.md
        ↓ battle verification (a draft's FIRST live use is flagged in the handover)
        ↓ human review
published     playbooks/<provider>/SKILL.md  (PR to this repo)
        ↓ optional upstream contribution to awesome-agent-skills
```

## Routing priority (capability-routing enforces this order)

official installed skill → verified local/published playbook → draft playbook (flagged)
→ generic implementer.

## Hard rules

1. **Provenance frontmatter required** — `derived-from`, `providers`, `last-verified`,
   `success-rate`. CI validates these on every published playbook.
2. **No secrets, ever** — template variables only (`$STRIPE_SECRET_KEY`), never values,
   account/project ids, or token-bearing URLs. Published artifacts are secret-free by
   construction; a playbook that needs an account-specific value parameterizes it.
3. **Steps carry verification** — a playbook is a procedure plus the evidence each step
   worked. Format: `templates/playbook.template.md`.

## Contributing

PR with the template's format, real provenance, and the failure modes that earned the
playbook its existence. Playbooks without "Known failure modes" content are tutorials,
not playbooks — they will be asked to earn their scars first.
