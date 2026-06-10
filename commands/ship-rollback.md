---
description: Roll back a delivered feature - revert its merge commit (pr mode: close the PR), reopen it as pending, and record the learning
argument-hint: "<F-id> <reason>"
---

Roll back a delivered ship-loop feature in the current project: $ARGUMENTS

1. **Parse**: first token of $ARGUMENTS is the feature id (`F-NNN`); everything after
   it is the rollback reason. Missing either → ask and stop (a reasonless rollback
   writes a useless learning). The id must exist in `docs/ship-loop/feature_list.json`.
2. **Preflight**: `git status --porcelain` must be empty — a revert on a dirty tree
   mixes rollback with in-flight work. Dirty → list the files, instruct stash or
   commit first, stop. Read `merge_strategy` from `docs/ship-loop/BUILD_CHARTER.md`
   (row absent = `merge`).
3. **Locate the delivery, branching on `merge_strategy`**:
   - `merge` → `git log --merges --grep "<id>" --format="%H %s"`, first match wins
     (newest; delivery merges carry the id, e.g. `feat(F-001): ... (verdict: pass ...)`).
     Zero matches → report that nothing merged mentions the id and stop — never guess
     a hash.
   - `pr` → `gh pr view "ship/<id>" --json state,mergeCommit`:
     - `OPEN` → nothing merged, nothing to revert: `gh pr close "ship/<id>"`, delete
       the branch (`git push origin --delete "ship/<id>"`, plus any local copy), skip
       to step 5.
     - `MERGED` → the human already merged it: take `mergeCommit.oid` as the delivery
       commit (empty → fall back to the `--merges --grep` search above) and continue.
     - No PR or `CLOSED` → report what you found and stop — never guess.
4. **Revert**: `git revert -m 1 <hash>` (`-m 1` = keep the first parent, mainline;
   conductor merges are always `--no-ff`). A squash/rebase-merged PR commit has one
   parent — use plain `git revert <hash>` there. On conflict, never auto-resolve:
   leave the revert in progress, list the conflicted files
   (`git diff --name-only --diff-filter=U`), print the way out — resolve then
   `git revert --continue`, or `git revert --abort` — plus the exact step 5–6
   commands to run by hand afterwards, and stop.
5. **Reopen**: `node "$CLAUDE_PLUGIN_ROOT/scripts/ship-state.mjs" set --dir "$PWD" --id <id> --status pending --passes false --note "rolled back <ISO-date>: <reason>"`
   (`--passes false` so dependents stop counting <id> as satisfied).
6. **Learn**: `echo '{"lesson":"<id> rolled back: <reason>","tags":["rollback","<id>"]}' | node "$CLAUDE_PLUGIN_ROOT/scripts/ship-state.mjs" learn --dir "$PWD"`.
   Commit the state files: `rollback(<id>): reopen — <reason>`.
7. **Report**: what was reverted (hash + subject, or PR closed + branch deleted), what
   reopened (<id> → `pending`, attempts preserved), and the next action —
   `/ship:resume` to let the loop re-deliver it, or amend the feature first if the
   spec itself was wrong.
