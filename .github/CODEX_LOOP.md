# Codex ↔ Claude review loop

Mirrors the (now-disabled) Copilot ↔ Claude loop documented in `COPILOT_LOOP.md`, but driven by the ChatGPT Codex Connector instead of GitHub Copilot.

## Files involved

- `.github/workflows/claude.yml` — generic `@claude` mention responder (shared across loops).
- `.github/workflows/claude-fix-codex-review.yml` — fires when Codex submits a review; Claude addresses the feedback and pushes back to the PR branch.

There is no `setup-codex-loop.yml` analog: Codex auto-review-on-push is configured in the Codex web UI, not via a GitHub ruleset.

## One-time setup per repo

1. **Create two secrets** in *Settings → Secrets and variables → Actions*:
   - `CLAUDE_CODE_OAUTH_TOKEN` — from `claude setup-token` (or the Claude Code install flow).
   - `CODEX_LOOP_PAT` — a fine-grained Personal Access Token scoped to just this repo with:
     - Contents: **Read and write**
     - Pull requests: **Read and write**

   This PAT can be the same value as `COPILOT_LOOP_PAT` if that already exists — the permissions are identical. Two distinct secret names just keep the two loops independently configurable.

2. **Enable Codex auto-review on push** in the Codex web UI for this repo. Without that setting, the loop terminates after one round because nothing re-triggers Codex on Claude's push.

3. Open a PR; once Codex has reviewed it once, every subsequent push triggers the next Codex round automatically (until Codex has no feedback left, or the iteration cap is hit).

## Why a PAT?

Defensive design. The Copilot version uses a PAT because GitHub's `copilot_code_review` ruleset silently ignores `github-actions[bot]` pushes (verified empirically — bot pushes produce no `review_requested` event). It's not yet confirmed whether Codex's auto-review setting has the same restriction. If observation across the first few PRs shows Codex re-fires on bot pushes, the PAT can be dropped and the workflow simplified to use the default `GITHUB_TOKEN`.

## Iteration cap

`claude-fix-codex-review.yml` has `MAX_CODEX_ITERATIONS: 7`. After that many Codex reviews on a single PR, Claude posts a comment and stops auto-fixing so humans can take over. Bump the env var if you want more rounds.

## Project-specific check commands

The prompt in `claude-fix-codex-review.yml` mentions Capy-specific check commands (`make` and `make check` for `.js`/`.liquid` changes; skip `./gradlew` because no Android SDK is installed on the runner). When copying to another repo, edit that paragraph to point at the destination repo's lightweight check commands.

## Coexistence with the Copilot loop

`claude-fix-copilot-review.yml` is still on disk but its `on:` trigger has been neutered to `workflow_dispatch:` only — it will not fire on PR events. To re-enable Copilot, restore the original `pull_request_review:` trigger.

The GitHub-side `copilot_code_review` ruleset created by `setup-copilot-loop.yml` still exists and may still cause Copilot to post reviews on every push. Disabling the Claude-fix workflow stops Claude from acting on those reviews, but does not stop Copilot from posting them. To fully retire Copilot:

```bash
# List rulesets to find the id
gh api "repos/<owner>/<repo>/rulesets"

# Delete the copilot_code_review ruleset (use the id from above)
gh api --method DELETE "repos/<owner>/<repo>/rulesets/<ruleset-id>"
```

Or disable it via the GitHub UI (Settings → Rules → Rulesets → "Copilot auto review for all branches" → Disable).
