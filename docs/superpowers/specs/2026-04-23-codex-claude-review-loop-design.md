# Codex ↔ Claude review-fix loop

## Goal

Mirror the existing Copilot ↔ Claude loop for the ChatGPT Codex Connector: when Codex submits a PR review, run Claude Code on the runner to address the feedback and push fixes back to the PR branch, then let Codex's "auto-review on push" UI setting re-trigger the next Codex round. Keep iterating until Codex has no more issues or an iteration cap is hit.

The existing Copilot loop stays on disk but its triggers get neutered, so only the Codex loop fires on PRs going forward.

## Background

The repo already runs a Copilot ↔ Claude loop driven by three workflows: `claude-fix-copilot-review.yml`, `setup-copilot-loop.yml`, and the generic `claude.yml`. The setup workflow creates a `copilot_code_review` GitHub ruleset that auto-requests a Copilot review on every push to a PR branch — but only for real-user pushes (the ruleset silently ignores `github-actions[bot]`). To get around that, Claude pushes are attributed to the owner of `COPILOT_LOOP_PAT`, a fine-grained PAT with `Contents: Write` and `Pull requests: Write`.

Codex's auto-review is configured differently: the user enables it in the Codex UI (not via a GitHub ruleset). It's not yet known whether Codex auto-review fires on bot pushes — so this design assumes the conservative case (real-user pushes only) and reuses the same PAT-attributed-push pattern. If Codex turns out to fire on bot pushes, the PAT becomes optional and can be dropped in a follow-up.

## Architecture

One new workflow plus one new docs file:

- `.github/workflows/claude-fix-codex-review.yml` — main fix loop, mirrors `claude-fix-copilot-review.yml`
- `.github/CODEX_LOOP.md` — setup docs, mirrors `COPILOT_LOOP.md`

Two existing files get their triggers neutered (no logic changes):

- `.github/workflows/claude-fix-copilot-review.yml` — `on:` becomes `workflow_dispatch:` only
- `.github/workflows/setup-copilot-loop.yml` — already `workflow_dispatch:` only, untouched

`claude.yml` (the `@claude` mention responder) is generic and stays as-is.

A new repo secret `CODEX_LOOP_PAT` is required. It can be the same PAT value as `COPILOT_LOOP_PAT` (same permissions: `Contents: Write`, `Pull requests: Write`). Two distinct secret names keep the loops independently configurable.

## `claude-fix-codex-review.yml` — behavior

### Trigger

```yaml
on:
  pull_request_review:
    types: [submitted]
```

### Job-level filter

```yaml
if: |
  github.event.review.user.login == 'chatgpt-codex-connector[bot]' &&
  github.event.pull_request.head.repo.full_name == github.repository
```

Codex (unlike Copilot) is not known to surface under multiple login names, so a single login match is sufficient. The fork-PR check is the same as Copilot's — we need write access to the head branch.

### Steps

1. **Verify `CODEX_LOOP_PAT` is set.** Fail fast with a clear error message pointing to `.github/CODEX_LOOP.md` if missing.

2. **Iteration cap check.** Count prior reviews on this PR submitted by `chatgpt-codex-connector[bot]`:
   ```bash
   count=$(gh api --paginate \
     "repos/${{ github.repository }}/pulls/${{ github.event.pull_request.number }}/reviews" \
     --jq '[.[] | select(.user.login == "chatgpt-codex-connector[bot]")] | length' \
     | awk '{s+=$1} END {print s+0}')
   ```
   If `count >= MAX_CODEX_ITERATIONS` (default 7), post a one-time PR comment ("Claude auto-fix stopped after N Codex review iterations…") and skip the rest of the job.

3. **Checkout PR head branch** with `token: ${{ secrets.CODEX_LOOP_PAT }}`, `fetch-depth: 0`.

4. **Derive git identity from PAT owner.** Use `gh api /user` to read login, id, and name; configure git with `user.name` and `user.email` set to the GitHub noreply form `<id>+<login>@users.noreply.github.com`. Same code as the Copilot version — keeps commits attributed to a real user, not `github-actions[bot]`.

5. **Run Claude Code via `anthropics/claude-code-action/base-action@v1`** (the sub-path, not the top-level action — the top-level action's `checkHumanActor` crashes on bot logins, see the comment block in `claude-fix-copilot-review.yml`). `GH_TOKEN` and `GITHUB_TOKEN` env vars both set to `CODEX_LOOP_PAT` so any `gh api` calls Claude makes are attributed to the PAT owner.

   Prompt outline (adapted from the Copilot prompt — substitutions in **bold**):
   - The **Codex** Code Review Agent submitted a review on PR #N (review id R)
   - Fetch the review body and inline comments scoped to `pull_request_review_id == R`
   - For each comment, fix valid issues by editing on the PR branch, or reply explaining why it's a false positive
   - Pre-commit checks: skip `./gradlew` (no Android SDK on runner); for `.js`/`.liquid` changes run `make` then `make check`; rely on `test.yml` to validate Android changes after push
   - Commit each logical group as `fix: address Codex review feedback on <topic>`; no force-push, no amend, no resolving conversations
   - Do NOT manually request a Codex re-review — Codex's "auto-review on push" UI setting handles re-triggering when the next push lands

6. **No explicit re-request step.** Unlike Copilot (where the workflow runs `gh pr edit --add-reviewer @copilot` after pushing), Codex re-review is driven by the Codex UI setting alone. If Codex auto-review turns out to ignore the PAT-owner pushes, the loop will silently stall after one round — at which point we'd add a Codex-side re-trigger mechanism in a follow-up.

### Iteration cap

`MAX_CODEX_ITERATIONS: 7` (env at job level) — matches the Copilot loop's effective value. Independent of any Copilot cap; if Copilot is ever re-enabled, the worst-case combined bot rounds per PR is 14.

## Coexistence with the Copilot loop

The Copilot workflow's `on:` block becomes:

```yaml
on:
  workflow_dispatch:
```

This neuters the PR-event trigger but preserves the file for reference / future re-enable. The `setup-copilot-loop.yml` is already `workflow_dispatch:` only and stays as-is — its purpose is to manage the GitHub `copilot_code_review` ruleset.

**Manual cleanup not in scope of this change:** the `copilot_code_review` ruleset itself still exists on the GitHub side and will keep auto-requesting Copilot reviews on every PR push. Disabling the Claude-fix workflow stops Claude from acting on those reviews, but Copilot will still post them. To fully retire Copilot, the user separately runs:

```
gh api --method DELETE "repos/<owner>/<repo>/rulesets/<ruleset-id>"
```

Or disables it in the GitHub UI (Settings → Rules → Rulesets). This is documented in `CODEX_LOOP.md` as a follow-up step.

## `.github/CODEX_LOOP.md` — outline

Mirrors `COPILOT_LOOP.md`:

- **Files to copy:** `.github/workflows/claude-fix-codex-review.yml`, `.github/workflows/claude.yml`
- **One-time setup per repo:**
  1. Create two secrets: `CLAUDE_CODE_OAUTH_TOKEN` and `CODEX_LOOP_PAT` (fine-grained PAT, same permissions as `COPILOT_LOOP_PAT`)
  2. In Codex's UI, enable "auto-review on push" for the repo
  3. Open a PR, request a Codex review once; subsequent rounds happen automatically
- **Why a PAT?** Defensive: it's not yet confirmed whether Codex auto-review fires on bot pushes. The PAT-attributed push pattern is the safe default. If observation confirms Codex triggers on bot pushes, the PAT becomes optional.
- **Iteration cap:** `MAX_CODEX_ITERATIONS = 7`. Bump if needed.
- **Project-specific checks:** the prompt mentions the Capy build commands (`make`, `make check`, no `./gradlew` on the runner). Edit that paragraph when copying to another repo.
- **Retiring Copilot fully (optional):** run `gh api --method DELETE` against the `copilot_code_review` ruleset to stop Copilot from posting reviews on every push.

## Error handling

- **Missing PAT:** fail fast with a pointer to `CODEX_LOOP_PAT.md`.
- **Iteration cap hit:** post a one-time PR comment, exit cleanly.
- **Claude pushed nothing:** loop terminates naturally, no comment, no error. (Indistinguishable from "all comments were false positives" — that's fine; the inline replies Claude posts already explain why.)
- **Codex login mismatch:** the workflow's `if:` filter is the only safety net. If Codex's bot login changes, the workflow will silently never fire — the user will notice when no fix commits land. Documented in `CODEX_LOOP.md`.

## Testing

Manual end-to-end verification:

1. Open a small test PR (e.g., a deliberately-broken `.js` change).
2. Wait for Codex to post a review, or request one manually.
3. Verify the workflow fires, Claude pushes a fix commit, and Codex re-reviews the new code.
4. Repeat the loop a couple of rounds; verify the iteration cap fires correctly when Codex review count hits 7.

Edge cases worth a manual check:

- Human review on the PR — workflow should not fire (login filter).
- Copilot review on the PR — workflow should not fire (login filter); the disabled Copilot workflow should also not fire.
- Fork PR — workflow should not run (head-repo check).
- PAT secret missing — workflow should fail at the verify-secret step with a clear message.

## Open questions

- **Does Codex auto-review fire on `github-actions[bot]` pushes?** If yes, the PAT is unnecessary and the workflow can be simplified. Will be answered after the first few real-PR runs.
- **Does Codex have a CLI re-trigger fallback?** (Equivalent to Copilot's `gh pr edit --add-reviewer @copilot`.) Not known. Only relevant if the auto-review-on-push setting turns out to be unreliable.
