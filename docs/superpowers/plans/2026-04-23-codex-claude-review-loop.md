# Codex ↔ Claude Review-Fix Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Codex ↔ Claude review-fix loop that mirrors the existing Copilot loop, and disable the Copilot loop's PR triggers so only Codex fires going forward.

**Architecture:** One new GitHub Actions workflow `claude-fix-codex-review.yml` listens for `pull_request_review` events from `chatgpt-codex-connector[bot]`, checks an iteration cap, runs Claude Code on the runner to address the review, and pushes commits attributed to a real-user PAT (`CODEX_LOOP_PAT`) so Codex's auto-review-on-push setting re-fires the next round. The existing Copilot workflow gets its `on:` trigger neutered to `workflow_dispatch:` only — it stays on disk for reference. A new `.github/CODEX_LOOP.md` documents the setup.

**Tech Stack:** GitHub Actions YAML, `gh` CLI, `anthropics/claude-code-action/base-action@v1`.

---

## File Structure

**Create:**
- `.github/workflows/claude-fix-codex-review.yml` — the fix loop (single self-contained workflow file)
- `.github/CODEX_LOOP.md` — setup docs

**Modify:**
- `.github/workflows/claude-fix-copilot-review.yml` — change `on:` block only

**Untouched:**
- `.github/workflows/claude.yml` — generic `@claude` mention responder, useful for both loops
- `.github/workflows/setup-copilot-loop.yml` — already `workflow_dispatch:` only

---

### Task 1: Create the Codex fix-loop workflow

**Files:**
- Create: `.github/workflows/claude-fix-codex-review.yml`

- [ ] **Step 1: Write the workflow file**

Create `.github/workflows/claude-fix-codex-review.yml` with the following exact content:

```yaml
name: Claude Fix Codex Review

# The fix half of the Codex ↔ Claude review loop. Fires whenever the ChatGPT
# Codex Connector submits a review, lets Claude address the feedback, and
# pushes the fixes back to the PR branch. The push is attributed to the
# CODEX_LOOP_PAT owner so that Codex's "auto-review on push" UI setting
# re-fires the next round of review (it's not yet known whether Codex
# auto-review fires on github-actions[bot] pushes — using the PAT is the
# safe default; can be simplified later if observation confirms bot-push
# auto-review works).
#
# Portability: no repo-specific values here other than the project-specific
# pre-commit checks paragraph in the prompt. See .github/CODEX_LOOP.md for
# setup instructions.

on:
  pull_request_review:
    types: [submitted]

env:
  # Hard cap on Codex review iterations per PR. Once Codex has submitted
  # this many reviews, Claude stops auto-fixing and asks for manual review.
  MAX_CODEX_ITERATIONS: 7

jobs:
  fix-codex-review:
    # Only run when the ChatGPT Codex Connector is the reviewer, and skip
    # fork PRs — we need write access to the PR branch to push fixes.
    if: |
      github.event.review.user.login == 'chatgpt-codex-connector[bot]' &&
      github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: read
      id-token: write
      actions: read
    steps:
      - name: Verify CODEX_LOOP_PAT secret is configured
        env:
          CODEX_LOOP_PAT: ${{ secrets.CODEX_LOOP_PAT }}
        run: |
          if [ -z "${CODEX_LOOP_PAT:-}" ]; then
            echo "::error::CODEX_LOOP_PAT secret is missing. Add it — see .github/CODEX_LOOP.md." >&2
            exit 1
          fi

      - name: Check Codex iteration cap
        id: cap
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          set -euo pipefail
          count=$(gh api --paginate \
            "repos/${{ github.repository }}/pulls/${{ github.event.pull_request.number }}/reviews" \
            --jq '[.[] | select(.user.login == "chatgpt-codex-connector[bot]")] | length' \
            | awk '{s+=$1} END {print s+0}')
          echo "Codex reviews so far: $count (cap: $MAX_CODEX_ITERATIONS)"
          if [ "$count" -ge "$MAX_CODEX_ITERATIONS" ]; then
            gh pr comment ${{ github.event.pull_request.number }} --body \
              "Claude auto-fix stopped after $count Codex review iterations (cap: $MAX_CODEX_ITERATIONS). Remaining feedback needs manual attention."
            echo "skip=true" >> "$GITHUB_OUTPUT"
          else
            echo "skip=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Checkout PR head branch
        if: steps.cap.outputs.skip != 'true'
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.ref }}
          fetch-depth: 0
          # Push as the PAT owner (not github-actions[bot]) so that Codex's
          # auto-review-on-push setting fires reliably on the next push.
          token: ${{ secrets.CODEX_LOOP_PAT }}

      - name: Derive git identity from PAT owner
        if: steps.cap.outputs.skip != 'true'
        # Attribute commits to the PAT owner via their GitHub noreply email so
        # they show up as regular user-authored commits on the PR timeline.
        # Derived at runtime so this file is portable across repos/owners.
        env:
          GH_TOKEN: ${{ secrets.CODEX_LOOP_PAT }}
        run: |
          set -euo pipefail
          owner_json=$(gh api /user)
          login=$(jq -r '.login' <<<"$owner_json")
          id=$(jq -r '.id' <<<"$owner_json")
          name=$(jq -r '.name // .login' <<<"$owner_json")
          git config user.name "$name"
          git config user.email "${id}+${login}@users.noreply.github.com"

      # We intentionally use the sub-path `base-action` instead of the
      # top-level `anthropics/claude-code-action@v1`. The top-level action's
      # `checkHumanActor` unconditionally calls `GET /users/<actor>` before
      # consulting `allowed_bots`, and that crashes for some bot logins. The
      # base-action skips all actor/permission checks and just runs Claude
      # Code with our prompt — the job-level `if:` already restricts execution
      # to Codex reviews on same-repo PRs.
      - name: Run Claude Code to address Codex review
        if: steps.cap.outputs.skip != 'true'
        uses: anthropics/claude-code-action/base-action@v1
        timeout-minutes: 30
        env:
          # Use the PAT so Claude's `gh api` calls (inline review replies,
          # PR comments, etc.) are attributed to the PAT owner instead of
          # github-actions[bot]. Matches the git push identity set above.
          GH_TOKEN: ${{ secrets.CODEX_LOOP_PAT }}
          GITHUB_TOKEN: ${{ secrets.CODEX_LOOP_PAT }}
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          prompt: |
            The ChatGPT Codex Connector just submitted a review on PR #${{ github.event.pull_request.number }}
            (review id ${{ github.event.review.id }}). Address its feedback so that the Codex ↔ Claude
            review-fix loop can continue until Codex has no more issues.

            1. Fetch the review body and all inline comments attached to it:
                 gh api repos/${{ github.repository }}/pulls/${{ github.event.pull_request.number }}/reviews/${{ github.event.review.id }}
                 gh api --paginate repos/${{ github.repository }}/pulls/${{ github.event.pull_request.number }}/comments
               Only act on inline comments whose `pull_request_review_id` equals ${{ github.event.review.id }}.

            2. For each comment, decide whether the suggestion is valid:
               - If it is a legitimate bug, code smell, or style issue, fix it by editing the code on the PR branch.
               - If it is a false positive, leave the code alone and reply to that specific comment explaining why.

            3. Before committing, run ONLY the cheap checks that can realistically finish in this
               runner (no Android SDK is installed and no Gradle cache is warmed, so a cold
               `./gradlew assembleFreeDebug` will hang for tens of minutes downloading SDK
               components and typically fail on license acceptance — do NOT run it here).
               - Kotlin/Android changes: rely on the repo's existing `test.yml` CI workflow to
                 validate the build after you push. Do not invoke `./gradlew` from this job.
                 Limit yourself to static reasoning (read the code, check types by inspection)
                 and, at most, `./gradlew help` or `./gradlew :<module>:tasks --offline` as a
                 sanity check — and even those only if you can confirm the Gradle daemon starts
                 within a minute. If in doubt, skip the check entirely and push; CI will catch it.
               - `.js` / `.liquid` asset changes: run `make` to recompile assets, then `make check`
                 to typecheck. These do not need the Android SDK and are safe to run here.
               If you are running this workflow on a different repo, substitute the project's own
               lightweight check commands — never a full Android build.

            4. Commit each logical group of fixes with a message like
               `fix: address Codex review feedback on <topic>` and push to the PR branch.
               Do not force-push, do not amend existing commits, and do not resolve review conversations.

            5. Do NOT manually request a Codex re-review. Codex's "auto-review on push" UI
               setting handles re-triggering when the next push lands. If you pushed nothing
               (all comments were false positives or the review was purely approving), the loop
               terminates naturally — do not post an empty review or comment.

            A workflow-level cap (MAX_CODEX_ITERATIONS = ${{ env.MAX_CODEX_ITERATIONS }}) will stop
            this job from running after too many Codex review rounds, so you do not need to track that yourself.
          claude_args: '--allowed-tools Bash(gh:*),Bash(git:*),Bash(make:*),Edit,Write,Read,Grep,Glob'
```

- [ ] **Step 2: Validate the YAML syntax locally**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/claude-fix-codex-review.yml'))" && echo OK`

Expected: `OK`. If you see a `yaml.scanner.ScannerError` or similar, fix the indentation/quoting in Step 1 and re-run.

- [ ] **Step 3: Sanity-check the iteration-cap jq filter**

Run: `echo '[{"user":{"login":"chatgpt-codex-connector[bot]"}},{"user":{"login":"alice"}},{"user":{"login":"chatgpt-codex-connector[bot]"}}]' | jq '[.[] | select(.user.login == "chatgpt-codex-connector[bot]")] | length'`

Expected: `2` (proves the filter only counts Codex reviews, not human/other reviews).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/claude-fix-codex-review.yml
git commit -m "ci: add codex ↔ claude review-fix loop workflow"
```

---

### Task 2: Disable the Copilot fix-loop trigger

**Files:**
- Modify: `.github/workflows/claude-fix-copilot-review.yml:12-14`

- [ ] **Step 1: Replace the `on:` block**

In `.github/workflows/claude-fix-copilot-review.yml`, find the existing trigger block:

```yaml
on:
  pull_request_review:
    types: [submitted]
```

Replace it with:

```yaml
on:
  # Triggers neutered while the Codex ↔ Claude loop (claude-fix-codex-review.yml)
  # is the active review-fix loop. The Copilot workflow stays on disk for
  # reference / future re-enable; restore the original `pull_request_review`
  # trigger to bring the Copilot loop back online.
  workflow_dispatch:
```

Use the Edit tool, not sed.

- [ ] **Step 2: Verify only the trigger changed**

Run: `git diff .github/workflows/claude-fix-copilot-review.yml`

Expected: only the `on:` block is modified — no other lines touched. If anything else changed, revert and redo Step 1.

- [ ] **Step 3: Validate YAML still parses**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/claude-fix-copilot-review.yml'))" && echo OK`

Expected: `OK`.

- [ ] **Step 4: Confirm the workflow won't fire on PR events**

Run: `grep -E "^on:|pull_request|push:|schedule:" .github/workflows/claude-fix-copilot-review.yml`

Expected: only the `on:` line and lines inside the surrounding comment block — no top-level `pull_request_review:` or `push:` entries. If you see an active `pull_request_review:` line, Step 1 wasn't applied correctly.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/claude-fix-copilot-review.yml
git commit -m "ci: disable copilot fix-loop trigger; codex loop is now primary"
```

---

### Task 3: Write the Codex loop setup docs

**Files:**
- Create: `.github/CODEX_LOOP.md`

- [ ] **Step 1: Write the docs file**

Create `.github/CODEX_LOOP.md` with the following exact content:

````markdown
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
````

- [ ] **Step 2: Verify the markdown renders**

Run: `head -5 .github/CODEX_LOOP.md`

Expected output:
```
# Codex ↔ Claude review loop

Mirrors the (now-disabled) Copilot ↔ Claude loop documented in `COPILOT_LOOP.md`, but driven by the ChatGPT Codex Connector instead of GitHub Copilot.

## Files involved
```

- [ ] **Step 3: Commit**

```bash
git add .github/CODEX_LOOP.md
git commit -m "docs: add codex ↔ claude review loop setup guide"
```

---

### Task 4: Note the disabled Copilot loop in COPILOT_LOOP.md

**Files:**
- Modify: `.github/COPILOT_LOOP.md` (top of file)

- [ ] **Step 1: Add a status note at the top of the existing file**

Read `.github/COPILOT_LOOP.md` first (use the Read tool) so you can see the existing top of the file. Then use the Edit tool to insert this block immediately after the existing first heading line `# Copilot ↔ Claude review loop` and before the existing first paragraph. The new content to insert (with a blank line before and after, but no other changes to the file):

```markdown
> **Status (2026-04-23):** This loop is **disabled** in this repo — the active review-fix loop is now `CODEX_LOOP.md`. The workflow file `claude-fix-copilot-review.yml` has had its `on:` trigger neutered to `workflow_dispatch:` only. To re-enable, restore the original `pull_request_review` trigger.
```

The exact Edit operation:
- `old_string`: `# Copilot ↔ Claude review loop\n\nCopy these three workflows`
- `new_string`: `# Copilot ↔ Claude review loop\n\n> **Status (2026-04-23):** This loop is **disabled** in this repo — the active review-fix loop is now \`CODEX_LOOP.md\`. The workflow file \`claude-fix-copilot-review.yml\` has had its \`on:\` trigger neutered to \`workflow_dispatch:\` only. To re-enable, restore the original \`pull_request_review\` trigger.\n\nCopy these three workflows`

(Use real backticks and real newlines in the Edit call — the escapes above are just for readability in this plan.)

- [ ] **Step 2: Verify the note landed**

Run: `head -5 .github/COPILOT_LOOP.md`

Expected: line 1 is `# Copilot ↔ Claude review loop`, line 3 starts with `> **Status (2026-04-23):**`.

- [ ] **Step 3: Commit**

```bash
git add .github/COPILOT_LOOP.md
git commit -m "docs(copilot-loop): mark loop disabled; codex loop is now primary"
```

---

### Task 5: Pre-merge validation

**Files:** none modified — verification only.

- [ ] **Step 1: Confirm all four workflow files still parse**

Run:
```bash
for f in .github/workflows/claude.yml \
         .github/workflows/claude-fix-codex-review.yml \
         .github/workflows/claude-fix-copilot-review.yml \
         .github/workflows/setup-copilot-loop.yml; do
  python3 -c "import yaml; yaml.safe_load(open('$f'))" && echo "OK $f" || { echo "FAIL $f"; exit 1; }
done
```

Expected: four `OK` lines, no `FAIL`.

- [ ] **Step 2: Confirm the new workflow has the right trigger and login filter**

Run: `grep -E "pull_request_review|chatgpt-codex-connector" .github/workflows/claude-fix-codex-review.yml`

Expected output includes:
```
  pull_request_review:
      github.event.review.user.login == 'chatgpt-codex-connector[bot]' &&
            --jq '[.[] | select(.user.login == "chatgpt-codex-connector[bot]")] | length' \
```

- [ ] **Step 3: Confirm the Copilot workflow's PR trigger is gone**

Run: `grep -E "^on:|^  pull_request_review:" .github/workflows/claude-fix-copilot-review.yml`

Expected: no `pull_request_review:` line at column 3 (the only `on:` should be followed by `workflow_dispatch:`). If `pull_request_review:` still appears, Task 2 wasn't applied.

- [ ] **Step 4: Confirm the new workflow file has not accidentally referenced `COPILOT_LOOP_PAT`**

Run: `grep -c "COPILOT_LOOP_PAT" .github/workflows/claude-fix-codex-review.yml`

Expected: `0` (the new workflow must use `CODEX_LOOP_PAT`, not the Copilot secret name — a stray reference would mean the workflow silently fails on repos that only have the Codex secret set).

- [ ] **Step 5: Confirm the new workflow file does not reference Copilot in the prompt**

Run: `grep -in "copilot" .github/workflows/claude-fix-codex-review.yml || echo "no Copilot references found"`

Expected: `no Copilot references found` — the entire workflow should be Codex-specific.

- [ ] **Step 6: Open a PR**

```bash
git push -u origin HEAD
gh pr create --title "ci: add codex ↔ claude review-fix loop, disable copilot loop" --body "$(cat <<'EOF'
## Summary
- Add `claude-fix-codex-review.yml` — mirrors the existing Copilot fix-loop but triggered by `chatgpt-codex-connector[bot]` reviews.
- Disable `claude-fix-copilot-review.yml`'s PR trigger (set `on:` to `workflow_dispatch:` only). File stays on disk for reference; restore the original trigger to re-enable.
- Add `.github/CODEX_LOOP.md` with setup instructions, including the new `CODEX_LOOP_PAT` secret and the manual step to delete the GitHub `copilot_code_review` ruleset if/when fully retiring Copilot.
- Add a status note to `.github/COPILOT_LOOP.md` pointing readers to the new loop.

## Test plan
- [ ] Add `CODEX_LOOP_PAT` secret in repo settings (same value as `COPILOT_LOOP_PAT` is fine).
- [ ] Verify Codex "auto-review on push" is enabled in the Codex UI for this repo.
- [ ] After merge, open a small test PR with a deliberate `.js` issue, request a Codex review, and confirm: the workflow fires, Claude pushes a fix commit, Codex re-reviews on the next push, and the iteration cap fires correctly when the count hits 7.
- [ ] Confirm the disabled Copilot workflow does NOT fire on the test PR.
EOF
)"
```

Expected: PR is created and the URL is printed. Hand off to the user for the manual setup steps in the test plan.

---

## Self-Review

**Spec coverage:**
- ✅ New workflow `claude-fix-codex-review.yml` (Task 1) — matches "Architecture" and "claude-fix-codex-review.yml — behavior" sections of the spec.
- ✅ Codex login filter `chatgpt-codex-connector[bot]` (Task 1, Step 1; Task 5, Step 2) — matches spec.
- ✅ `MAX_CODEX_ITERATIONS = 7` (Task 1, Step 1) — matches spec.
- ✅ PAT-attributed push pattern (Task 1, Step 1) — matches spec.
- ✅ `base-action` sub-path with comment explaining why (Task 1, Step 1) — matches spec.
- ✅ Project-specific pre-commit checks (skip `./gradlew`, run `make` for `.js`/`.liquid`) (Task 1, Step 1) — matches spec.
- ✅ No explicit re-request step (Task 1, Step 1; spec architecture point 2) — matches spec.
- ✅ Disable Copilot loop trigger to `workflow_dispatch:` only (Task 2) — matches "Coexistence" section.
- ✅ `.github/CODEX_LOOP.md` with setup, PAT rationale, iteration cap, project-specific checks, and the manual ruleset-cleanup note (Task 3) — matches spec.
- ✅ Open question about Codex bot-push behavior surfaced in the new docs (Task 3, "Why a PAT?" section) — matches spec.
- ✅ Pointer from old `COPILOT_LOOP.md` to the new loop (Task 4) — covers the user-experience need not explicitly in the spec but flagged during brainstorming.

**Placeholder scan:** No TBD/TODO/"implement later" anywhere. All code blocks contain the actual content. Commands have expected output. Login filter, secret name, and iteration cap are concrete throughout.

**Type/identifier consistency:**
- Secret name: `CODEX_LOOP_PAT` — used consistently across Task 1 (verify step, checkout token, git identity, claude env), Task 3 (docs), Task 5 (verification grep).
- Bot login: `chatgpt-codex-connector[bot]` — used consistently in Task 1 (job-level `if`, jq filter) and Task 5 (verification grep).
- Iteration cap: `MAX_CODEX_ITERATIONS = 7` — defined once in Task 1, referenced consistently.
- Workflow file name: `claude-fix-codex-review.yml` — used identically across Tasks 1, 3, 4, 5.

No drift detected.
