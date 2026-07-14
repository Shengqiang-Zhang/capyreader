# Miniflux Folder/Feed-Scoped Pull-to-Refresh — Design

**Date:** 2026-07-14
**Status:** Approved, pending implementation
**Scope:** Miniflux account delegate only (`capy` + `minifluxclient` modules)

## Problem

Refresh takes too long. Every Miniflux refresh is a full-account sync that ignores
which folder/feed the user is currently viewing. In particular, on **pull-to-refresh
while inside a folder**, the app still downloads the user's entire account:

1. `refreshIntegrationStatus()` — 1 call
2. `refreshFeeds()` — GET `/feeds` + icon fetch for new feeds
3. `refreshArticles()`:
   - `refreshUnreadEntries()` — paginates **all** unread entries (250/page) to reconcile read-state
   - `refreshStarredEntries()` — paginates **all** starred entries to reconcile stars
   - `fetchAllEntries()` — content changed since `lastRefreshedAt`, 4 concurrent

Steps 2–3 dominate wall-clock: they pull full entry payloads across the whole account
on every refresh, regardless of the selected folder.

A separately raised idea — lazy-loading article images — does **not** affect refresh
time: refresh never downloads images. Images are fetched by the WebView only when an
article is opened, and are already `loading="lazy"` (every image except the first per
article). This idea is out of scope.

## Goal

When the user pulls to refresh **inside a folder or a single feed**, sync only that
scope's new/changed articles. Leave the full-refresh paths (app open, "refresh all"
toolbar button, background worker) exactly as they are today.

Non-goals (explicitly decided with the user):

- App-open auto-refresh stays a full account sync.
- Scoped refresh is **content-only**: it does not reconcile read/star state changes
  made elsewhere (e.g. the Miniflux web UI). Those reconcile on the next full refresh.
- No changes to other account delegates (Local, Feedbin, Reader).

## Existing wiring (verified — no UI/ViewModel changes needed)

- Pull-to-refresh (`ArticleScreen.kt:593`) → `refreshFeeds()` (`:337`) →
  `viewModel.refresh(filter)` → `refreshFilter(filter)` → `account.refresh(filter)` →
  `delegate.refresh(filter, cutoffDate)`. **The current folder/feed filter is already
  passed all the way down to the delegate.**
- "Refresh all" toolbar button (`ArticleScreen.kt:499`) → `refreshAll()` → full sync
  (`ArticleFilter.default()` = `Articles(ALL)`).

`MinifluxAccountDelegate.refresh(filter, …)` currently **ignores** `filter`. Making it
branch on `filter` is sufficient to make pull-to-refresh scoped — the entire change
lives in the delegate + client.

## The load-bearing correctness constraint

`markAllUnread` / `markAllStarred` (`ArticleRecords.kt:158,173`) reconcile **globally**:

```sql
-- updateStaleUnreads
UPDATE article_statuses SET read = 1
WHERE article_id NOT IN (SELECT article_id FROM excluded_statuses WHERE type = 'unread');
```

If a scoped refresh fetched only one folder's unread IDs and reused `markAllUnread`, it
would mark **every other folder's** articles read. Therefore scoped refresh **must not**
call the global reconciliation.

Scoped refresh is safe because `saveEntries()` → `createStatus` is
`INSERT … ON CONFLICT(article_id) DO NOTHING` (`articles.sq`): new articles get their
correct read/star status from the payload, existing articles are never clobbered, and
articles outside the scope are never touched.

## Design

### 1. Branch in the delegate

`MinifluxAccountDelegate.refresh(filter, cutoffDate)`:

```kotlin
override suspend fun refresh(filter: ArticleFilter, cutoffDate: ZonedDateTime?): Result<Unit> {
    return try {
        when (filter) {
            is ArticleFilter.Folders -> refreshFolderScope(filter.folderTitle)
            is ArticleFilter.Feeds   -> refreshFeedScope(filter.feedID)
            else                     -> refreshAll()
        }
        Result.success(Unit)
    } catch (exception: IOException) {
        Result.failure(exception)
    } catch (e: UnauthorizedError) {
        Result.failure(e)
    }
}
```

`refreshAll()` is the **current body extracted verbatim** (behavior-preserving):

```kotlin
private suspend fun refreshAll() {
    refreshIntegrationStatus()
    refreshFeeds()
    refreshArticles()
    preferences.touchLastRefreshedAt()
}
```

### 2. Scoped fetch — content only

Extract a paginated helper from `fetchAllEntries()` so both the full and scoped paths
share it (net DRY):

```kotlin
private suspend fun fetchEntriesPaged(
    fetch: suspend (offset: Int) -> Response<EntryResultSet>,
) = coroutineScope {
    val first = fetch(0).body() ?: return@coroutineScope
    saveEntries(first.entries)

    val semaphore = Semaphore(MAX_CONCURRENT_FETCHES)
    (MAX_ENTRY_LIMIT until first.total step MAX_ENTRY_LIMIT).map { offset ->
        async {
            semaphore.withPermit {
                fetch(offset).body()?.entries?.let { saveEntries(it) }
            }
        }
    }.awaitAll()
}
```

Callers:

```kotlin
// full path (unchanged semantics)
private suspend fun fetchAllEntries() {
    val changedAfter = preferences.lastRefreshedAt.get().takeIf { it > 0 }
    fetchEntriesPaged { offset ->
        miniflux.entries(
            limit = MAX_ENTRY_LIMIT, offset = offset,
            order = "published_at", direction = "desc",
            changedAfter = changedAfter,
        )
    }
}

private suspend fun refreshFolderScope(folderTitle: String) {
    val categoryId = resolveCategoryId(folderTitle) ?: return
    val changedAfter = preferences.lastRefreshedAt.get().takeIf { it > 0 }
    fetchEntriesPaged { offset ->
        miniflux.entries(
            categoryId = categoryId,
            limit = MAX_ENTRY_LIMIT, offset = offset,
            order = "published_at", direction = "desc",
            changedAfter = changedAfter,
        )
    }
}

private suspend fun refreshFeedScope(feedID: String) {
    val id = feedID.toLongOrNull() ?: return
    val changedAfter = preferences.lastRefreshedAt.get().takeIf { it > 0 }
    fetchEntriesPaged { offset ->
        miniflux.entries(
            feedId = id,
            limit = MAX_ENTRY_LIMIT, offset = offset,
            order = "published_at", direction = "desc",
            changedAfter = changedAfter,
        )
    }
}

private suspend fun resolveCategoryId(folderTitle: String): Long? =
    miniflux.categories().body()?.find { it.title == folderTitle }?.id
```

**Use the top-level `entries(categoryId = …)` endpoint, not the dedicated
`categoryEntries(categoryID)` / `feedEntries(feedID)` endpoints.** Only the top-level
`/entries` endpoint declares `changed_after`; the category- and feed-scoped endpoints do
not, so using them would silently turn every scoped pull into a full backlog fetch.

### 3. Client change (`minifluxclient/Miniflux.kt`)

Add one nullable query parameter to the existing `entries()` method. The Miniflux
`/v1/entries` API supports `feed_id`; the Retrofit interface just doesn't declare it.
`category_id` and `changed_after` are already declared.

```kotlin
@GET("entries")
suspend fun entries(
    …existing params…,
    @Query("category_id") categoryId: Long? = null,
    @Query("feed_id") feedId: Long? = null,      // ← new
    @Query("changed_after") changedAfter: Long? = null,
): Response<EntryResultSet>
```

Nullable with a default, so all existing call sites compile unchanged.

### 4. What scoped refresh deliberately skips

- `refreshIntegrationStatus()`
- `refreshFeeds()` + icon fetches (feed list/icons refresh on full refresh only)
- global unread/starred reconciliation (`refreshUnreadEntries`/`refreshStarredEntries`)
- `preferences.touchLastRefreshedAt()` — **the global watermark is preserved**, so the
  next full refresh still fetches everything account-wide changed since the last full
  refresh.

## Data flow

```
pull-to-refresh (in folder "News")
  → account.refresh(Folders("News"))
    → delegate.refresh(Folders("News"))
      → refreshFolderScope("News")
        → resolveCategoryId("News")            GET /categories
        → fetchEntriesPaged { … }              GET /entries?category_id=7&changed_after=…&order=published_at&direction=desc
          → saveEntries(page)                  INSERT articles; createStatus ON CONFLICT DO NOTHING
      (no integration/feeds/reconciliation; lastRefreshedAt untouched)
```

## Edge cases

| Case | Behavior |
|------|----------|
| Folder title has no matching server category | `resolveCategoryId` returns null → no-op, `Result.success` |
| `feedID` not a valid Long | `toLongOrNull()` null → no-op, `Result.success` |
| `lastRefreshedAt == 0` (never fully synced) | `changedAfter` omitted → fetches the scope's full backlog (bounded to one folder/feed) |
| Network / auth failure mid-scope | Propagates as `IOException` / `UnauthorizedError` → `Result.failure`, same as full path |
| Auto-delete cutoff | Handled account-wide in `Account.refresh` after the delegate returns; unaffected |

## Testing (`MinifluxAccountDelegateTest`)

1. **Folder scope request:** `refresh(Folders("News"))` issues `GET /entries` with
   `category_id` = the resolved id and `changed_after` = prior `lastRefreshedAt`, and
   saves the returned entries.
2. **Feed scope request:** `refresh(Feeds(feedID, …))` issues `GET /entries` with
   `feed_id` = feedID.
3. **Cross-folder safety (key test):** seed two unread articles in feeds belonging to
   different folders; run a scoped refresh of folder A; assert folder B's article is
   still unread (i.e. no global reconciliation ran).
4. **Watermark preserved:** scoped refresh does not advance `lastRefreshedAt`.
5. **Full path unchanged:** `refresh(Articles(ALL))` still runs
   integration + feeds + reconciliation + `fetchAllEntries` (existing coverage).
6. **Unknown folder / bad feed id:** returns `Result.success` with no article writes.

## Files touched

- `capy/src/main/java/com/jocmp/capy/accounts/miniflux/MinifluxAccountDelegate.kt`
- `minifluxclient/src/main/java/com/jocmp/minifluxclient/Miniflux.kt`
- `capy/src/test/java/com/jocmp/capy/accounts/miniflux/MinifluxAccountDelegateTest.kt`

## Expected impact

Pull-to-refresh inside a folder/feed drops from a full-account sync (all feeds + all
unread + all starred + changed content) to a single scoped `/entries` query plus one
`/categories` lookup — proportional to the selected scope rather than the whole account.
Full-refresh paths are unchanged.
