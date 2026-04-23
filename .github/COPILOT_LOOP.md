# Copilot ↔ Claude review loop

> **Status (2026-04-23):** This loop is **disabled** in this repo — the active review-fix loop is now `CODEX_LOOP.md`. The workflow file `claude-fix-copilot-review.yml` has had its `on:` trigger neutered to `workflow_dispatch:` only. To re-enable, restore the original `pull_request_review` trigger.

Copy these three workflows into another repo and the loop works after a one-time secret + setup-workflow step. No GitHub web-UI settings, no per-repo file edits.

## Files to copy

- `.github/workflows/claude.yml` — responds to `@claude` mentions in issues / PR comments.
- `.github/workflows/claude-fix-copilot-review.yml` — fires when Copilot submits a review; Claude fixes the feedback and pushes back to the PR branch.
- `.github/workflows/setup-copilot-loop.yml` — one-shot, creates the `copilot_code_review` ruleset so pushes by the PAT owner auto-trigger the next Copilot review.

## One-time setup per repo

1. **Create two secrets** in *Settings → Secrets and variables → Actions*:
   - `CLAUDE_CODE_OAUTH_TOKEN` — from `claude setup-token` (or the Claude Code install flow).
   - `COPILOT_LOOP_PAT` — a fine-grained Personal Access Token scoped to just this repo with:
     - Contents: **Read and write**
     - Pull requests: **Read and write**
     - Administration: **Read and write** — this is the permission that covers creating/updating rulesets. Only needed while running `setup-copilot-loop`; you can remove it afterward and regenerate the PAT with just Contents + Pull requests.
2. **Run the setup workflow once.** Actions tab → *Setup Copilot ↔ Claude loop* → *Run workflow*. It creates/updates the ruleset via the REST API.
3. Open a PR and request a Copilot review on it once — from then on, every Claude push triggers the next Copilot round until Copilot has no feedback left (or the iteration cap is hit).

## Why the PAT is unavoidable

GitHub's `copilot_code_review` ruleset silently ignores pushes authenticated as `github-actions[bot]` (verified empirically on PR #21, 2026-04-20 — bot pushes produced no `review_requested` event, user pushes did). The REST endpoint `POST /pulls/{n}/requested_reviewers` with `copilot-pull-request-reviewer` is not a reliable fallback either. So the loop depends on Claude's push being attributed to a real user; the PAT provides that identity. Everything *else* (the ruleset, the git author config) is automated by the workflows.

## Iteration cap

`claude-fix-copilot-review.yml` has `MAX_COPILOT_ITERATIONS: 5`. After that many Copilot reviews on a single PR, Claude posts a comment and stops auto-fixing so humans can take over. Bump the env var if you want more rounds.

## Project-specific check commands

The prompt in `claude-fix-copilot-review.yml` mentions `ego_sdk/flutter/bin/flutter analyze` / `flutter test` as the checks Claude should run before committing. When copying to another repo, edit that single `run the project checks` paragraph to point at the destination repo's build/test commands. Nothing else in the workflow is repo-specific.
