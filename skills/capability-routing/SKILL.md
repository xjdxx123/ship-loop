---
name: capability-routing
description: Discovers the user's installed skills, plugins, and MCP servers, builds capability-map.md, routes milestone work to the best installed specialist, and fills gaps from the awesome-agent-skills catalog (official orgs auto-install, third parties to NEEDS_HUMAN).
---

# Capability Routing

ship-loop runs inside Claude Code precisely to inherit the user's tool ecosystem. Route
work to the best installed specialist; never assume a specific plugin exists — this is a
public plugin, and every routing rule is a CATEGORY pattern, not a hardcoded name.

## Discovery (Phase 0, and re-run when a gap forces an install)
1. `ls ~/.claude/skills/` and enumerate installed plugin skills (the harness lists them;
   also `ls ~/.claude/plugins/cache 2>/dev/null`).
2. MCP servers: ToolSearch for browser (playwright/chrome/preview), database, deploy
   tooling — record what resolves.
3. Browser verification path: prefer a connected Chrome/Playwright MCP; fallback
   `npx playwright` via Bash; record which one this machine has.
4. Write `docs/ship-loop/capability-map.md`: category → best installed match → fallback.

## Routing table (category → match patterns, first hit wins)

| Need | Match installed names like | Fallback |
|---|---|---|
| Frontend implementation | `*frontend*`, `*ui-designer*`, `*design*taste*` | ship-implementer |
| Backend/API | `*backend*`, `*api*` | ship-implementer |
| Database tuning | `*postgres*`, `*database*` | ship-implementer |
| Deep prior-art research | `*deep-research*`, `*research*` | WebSearch in-session |
| Code quality gate | user's `/code-review` | adversarial-eval only |
| Security gate | user's `/security-review` | adversarial-eval security lens |
| Browser verification | Playwright/Chrome MCP | `npx playwright` |
| Deploy / payments / email / auth | provider skills (`*vercel*`, `*stripe*`, `*supabase*`, `*resend*`, `*auth*`) | stub + launch-checklist row |

If the user's `/code-review` or `/security-review` exists, add it as an EXTRA acceptance
lens on panel-mode features — user-owned gates outrank our defaults.

## Gap filling (aggressive boundary, from BUILD_CHARTER)
Missing capability with real work blocked on it:
1. Search the awesome-agent-skills catalog (github.com/VoltAgent/awesome-agent-skills)
   for an official-team skill covering the need.
2. Source org ∈ charter allowlist (`anthropics`, `vercel`, `stripe`, `supabase`,
   `cloudflare`, `netlify`, `resend`) → install it, log to loop-run-log, re-run discovery.
3. Any other source → do NOT install; write a NEEDS_HUMAN.md suggestion row (link +
   what it unblocks) and route to the fallback meanwhile.

Skills give the agent the HOW (correct provider procedures); they never substitute for
the WHAT-IS-ALLOWED (keys + charter boundaries). Routing never overrides a park category.
