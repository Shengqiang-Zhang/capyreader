# Miniflux Folder/Feed-Scoped Pull-to-Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a Miniflux pull-to-refresh sync only the currently-selected folder or feed (content-only) instead of the whole account, leaving all full-refresh paths unchanged.

**Architecture:** `MinifluxAccountDelegate.refresh(filter)` currently ignores `filter`. Branch on it: `Folders`/`Feeds` run a scoped, content-only fetch; everything else runs today's full refresh (extracted verbatim into `refreshAll()`). Scoped fetches reuse a shared paginated helper and the existing `saveEntries()` (which is `INSERT … ON CONFLICT DO NOTHING`, so it never clobbers existing read/star state or touches other folders). Scoped refresh deliberately skips integration status, the feed-list refresh, the account-wide read/star reconciliation, and the `lastRefreshedAt` watermark update.

**Tech Stack:** Kotlin, coroutines, Retrofit (`minifluxclient`), SQLDelight (`capy` DB), JUnit + MockK + in-memory SQLDelight for tests.

## Global Constraints

- Change is limited to two modules: `capy` (Miniflux delegate + its test) and `minifluxclient` (Retrofit interface). No UI/ViewModel changes.
- Do **not** modify other account delegates (Local, Feedbin, Reader) or shared persistence code.
- Scoped refresh MUST NOT call `articleRecords.markAllUnread` / `markAllStarred` (their `updateStaleUnreads`/`updateStaleStars` reconcile **globally** and would mark other folders read/unstarred).
- Scoped refresh MUST NOT call `preferences.touchLastRefreshedAt()`.
- Scoped folder/feed fetches MUST use the top-level `miniflux.entries(...)` endpoint (the only one exposing `changed_after`), never `categoryEntries`/`feedEntries`.
- Constants already defined on the delegate: `MAX_ENTRY_LIMIT = 250`, `MAX_CONCURRENT_FETCHES = 4`.
- Run a single test module with: `./gradlew :capy:testDebugUnitTest --tests com.jocmp.capy.accounts.miniflux.MinifluxAccountDelegateTest` (and `:minifluxclient:testDebugUnitTest` for the client module).

---

### Task 1: Refactor — extract `refreshAll()` and a shared `fetchEntriesPaged()` helper (behavior-preserving)

Pure refactor. No behavior change; `refresh(filter)` still runs the full sync. This puts the reusable pieces in place for Tasks 2–3.

**Files:**
- Modify: `capy/src/main/java/com/jocmp/capy/accounts/miniflux/MinifluxAccountDelegate.kt`
- Test: `capy/src/test/java/com/jocmp/capy/accounts/miniflux/MinifluxAccountDelegateTest.kt` (existing tests only — must still pass)

**Interfaces:**
- Produces: `private suspend fun refreshAll()`; `private suspend fun fetchEntriesPaged(fetch: suspend (offset: Int) -> Response<EntryResultSet>)`. Both are used by later tasks.

- [ ] **Step 1: Run the existing tests to establish a green baseline**

Run: `./gradlew :capy:testDebugUnitTest --tests com.jocmp.capy.accounts.miniflux.MinifluxAccountDelegateTest`
Expected: PASS (all existing tests green).

- [ ] **Step 2: Extract `refreshAll()` from `refresh()`**

In `MinifluxAccountDelegate.kt`, replace the current `refresh` body so the full-sync steps live in a new private `refreshAll()`. `refresh` still calls `refreshAll()` unconditionally (filter still ignored at this step):

```kotlin
override suspend fun refresh(filter: ArticleFilter, cutoffDate: ZonedDateTime?): Result<Unit> {
    return try {
        refreshAll()
        Result.success(Unit)
    } catch (exception: IOException) {
        Result.failure(exception)
    } catch (e: UnauthorizedError) {
        Result.failure(e)
    }
}

private suspend fun refreshAll() {
    refreshIntegrationStatus()
    refreshFeeds()
    refreshArticles()
    preferences.touchLastRefreshedAt()
}
```

- [ ] **Step 3: Extract `fetchEntriesPaged()` and rewrite `fetchAllEntries()` to use it**

Replace the existing `fetchAllEntries()` with a parameterized helper plus a thin caller. The `saveEntries` calls, the `Semaphore(MAX_CONCURRENT_FETCHES)`, and the pagination range are preserved exactly:

```kotlin
private suspend fun fetchEntriesPaged(
    fetch: suspend (offset: Int) -> Response<EntryResultSet>,
) = coroutineScope {
    val firstResult = fetch(0).body() ?: return@coroutineScope

    saveEntries(firstResult.entries)

    val semaphore = Semaphore(MAX_CONCURRENT_FETCHES)

    (MAX_ENTRY_LIMIT until firstResult.total step MAX_ENTRY_LIMIT)
        .map { offset ->
            async {
                semaphore.withPermit {
                    val entries = fetch(offset).body()?.entries ?: return@withPermit
                    saveEntries(entries)
                }
            }
        }
        .awaitAll()
}

private suspend fun fetchAllEntries() {
    val changedAfter = preferences.lastRefreshedAt.get().takeIf { it > 0 }

    fetchEntriesPaged { offset ->
        miniflux.entries(
            limit = MAX_ENTRY_LIMIT,
            offset = offset,
            order = "published_at",
            direction = "desc",
            changedAfter = changedAfter,
        )
    }
}
```

Leave `refreshArticles()`, `refreshStarredEntries()`, `refreshUnreadEntries()`, `saveEntries()` unchanged.

- [ ] **Step 4: Run the existing tests to verify no behavior change**

Run: `./gradlew :capy:testDebugUnitTest --tests com.jocmp.capy.accounts.miniflux.MinifluxAccountDelegateTest`
Expected: PASS (same tests, still green — the refactor is behavior-preserving).

- [ ] **Step 5: Commit**

```bash
git add capy/src/main/java/com/jocmp/capy/accounts/miniflux/MinifluxAccountDelegate.kt
git commit -m "refactor(miniflux): extract refreshAll and fetchEntriesPaged helper"
```

---

### Task 2: Folder-scoped refresh

Add the `when (filter)` branch and the folder path. Uses the already-declared `category_id` query param — no client change needed.

**Files:**
- Modify: `capy/src/main/java/com/jocmp/capy/accounts/miniflux/MinifluxAccountDelegate.kt`
- Test: `capy/src/test/java/com/jocmp/capy/accounts/miniflux/MinifluxAccountDelegateTest.kt`

**Interfaces:**
- Consumes (from Task 1): `refreshAll()`, `fetchEntriesPaged(fetch)`.
- Produces: `private suspend fun refreshFolderScope(folderTitle: String)`; `private suspend fun resolveCategoryId(folderTitle: String): Long?`.

- [ ] **Step 1: Store `preferences` as a test field so tests can assert the watermark**

In `MinifluxAccountDelegateTest.kt`, change setup to keep a reference to the preferences object. Add a field and use it when constructing the delegate:

Add near the other `private lateinit var` fields (around line 45):

```kotlin
    private lateinit var preferences: AccountPreferences
```

Replace the delegate construction in `setup()` (line 175):

```kotlin
        preferences = AccountPreferences(InMemoryDataStore())
        delegate = MinifluxAccountDelegate(database, miniflux, preferences)
```

Run: `./gradlew :capy:testDebugUnitTest --tests com.jocmp.capy.accounts.miniflux.MinifluxAccountDelegateTest`
Expected: PASS (refactor of the test setup only; existing tests unaffected).

- [ ] **Step 2: Write the failing folder-scope tests**

Add these imports at the top of `MinifluxAccountDelegateTest.kt` (alongside existing imports):

```kotlin
import com.jocmp.capy.ArticleStatus
import com.jocmp.capy.fixtures.ArticleFixture
import com.jocmp.capy.persistence.articleMapper
import io.mockk.coVerify
```

Add these three tests to the class:

```kotlin
    @Test
    fun refresh_folderScope_fetchesOnlyCategoryEntries() = runTest {
        // Feed 2 must exist so the saved article is visible to the feeds-joined read query.
        FeedFixture(database).create(feedID = "2", folderNames = listOf("Tech"))

        coEvery { miniflux.categories() }.returns(Response.success(categories))
        coEvery {
            miniflux.entries(
                categoryId = 1,
                limit = 250,
                offset = 0,
                order = "published_at",
                direction = "desc",
                changedAfter = null,
            )
        }.returns(
            Response.success(EntryResultSet(total = 1, entries = listOf(arsTechnicaArticle)))
        )

        delegate.refresh(ArticleFilter.Folders(folderTitle = "Tech", folderStatus = ArticleStatus.ALL))

        val unread = database.articlesQueries
            .countAll(read = false, starred = false)
            .executeAsList()
        assertEquals(expected = 1, actual = unread.size)

        // Full-refresh work must NOT run in a scoped refresh.
        coVerify(exactly = 0) { miniflux.feeds() }
        coVerify(exactly = 0) { miniflux.integrationStatus() }
        coVerify(exactly = 0) { miniflux.entries(starred = true, limit = any(), offset = any()) }
        coVerify(exactly = 0) {
            miniflux.entries(status = EntryStatus.UNREAD.value, limit = any(), offset = any())
        }
    }

    @Test
    fun refresh_folderScope_doesNotMarkOtherFoldersRead() = runTest {
        FeedFixture(database).create(feedID = "2", folderNames = listOf("Tech"))
        // A pre-existing UNREAD article in a different feed/folder (its own feed row is created by the fixture).
        val other = ArticleFixture(database).create(read = false)

        coEvery { miniflux.categories() }.returns(Response.success(categories))
        coEvery {
            miniflux.entries(
                categoryId = 1,
                limit = 250,
                offset = 0,
                order = "published_at",
                direction = "desc",
                changedAfter = null,
            )
        }.returns(
            Response.success(EntryResultSet(total = 1, entries = listOf(arsTechnicaArticle)))
        )

        delegate.refresh(ArticleFilter.Folders(folderTitle = "Tech", folderStatus = ArticleStatus.ALL))

        val reloaded = database.articlesQueries
            .findBy(articleID = other.id, mapper = ::articleMapper)
            .executeAsOne()
        assertEquals(expected = false, actual = reloaded.read)
    }

    @Test
    fun refresh_folderScope_preservesLastRefreshedWatermark() = runTest {
        coEvery { miniflux.categories() }.returns(Response.success(categories))
        coEvery {
            miniflux.entries(
                categoryId = 1,
                limit = 250,
                offset = 0,
                order = "published_at",
                direction = "desc",
                changedAfter = null,
            )
        }.returns(Response.success(EntryResultSet(total = 0, entries = emptyList())))

        delegate.refresh(ArticleFilter.Folders(folderTitle = "Tech", folderStatus = ArticleStatus.ALL))

        assertEquals(expected = 0L, actual = preferences.lastRefreshedAt.get())
    }
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `./gradlew :capy:testDebugUnitTest --tests com.jocmp.capy.accounts.miniflux.MinifluxAccountDelegateTest`
Expected: The three new tests FAIL. `refresh_folderScope_doesNotMarkOtherFoldersRead` currently fails because `refresh` ignores the filter and runs the full path (which throws on the unstubbed `miniflux.feeds()`), so the article is never processed as intended; the `fetchesOnlyCategoryEntries` test fails on the `coVerify(exactly = 0)` / unstubbed-call error. (Any failure is acceptable here — they must not pass yet.)

- [ ] **Step 4: Implement the folder branch**

In `MinifluxAccountDelegate.kt`, change `refresh` to branch on the filter, and add the folder helpers. `ArticleFilter` is already imported.

```kotlin
override suspend fun refresh(filter: ArticleFilter, cutoffDate: ZonedDateTime?): Result<Unit> {
    return try {
        when (filter) {
            is ArticleFilter.Folders -> refreshFolderScope(filter.folderTitle)
            else -> refreshAll()
        }
        Result.success(Unit)
    } catch (exception: IOException) {
        Result.failure(exception)
    } catch (e: UnauthorizedError) {
        Result.failure(e)
    }
}

private suspend fun refreshFolderScope(folderTitle: String) {
    val categoryId = resolveCategoryId(folderTitle) ?: return
    val changedAfter = preferences.lastRefreshedAt.get().takeIf { it > 0 }

    fetchEntriesPaged { offset ->
        miniflux.entries(
            categoryId = categoryId,
            limit = MAX_ENTRY_LIMIT,
            offset = offset,
            order = "published_at",
            direction = "desc",
            changedAfter = changedAfter,
        )
    }
}

private suspend fun resolveCategoryId(folderTitle: String): Long? =
    miniflux.categories().body()?.find { it.title == folderTitle }?.id
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `./gradlew :capy:testDebugUnitTest --tests com.jocmp.capy.accounts.miniflux.MinifluxAccountDelegateTest`
Expected: PASS (all tests, new and existing).

- [ ] **Step 6: Commit**

```bash
git add capy/src/main/java/com/jocmp/capy/accounts/miniflux/MinifluxAccountDelegate.kt \
        capy/src/test/java/com/jocmp/capy/accounts/miniflux/MinifluxAccountDelegateTest.kt
git commit -m "feat(miniflux): scope pull-to-refresh to selected folder (content-only)"
```

---

### Task 3: Feed-scoped refresh (+ `feed_id` client param)

Add `feed_id` to the Retrofit `entries()` method and the `is Feeds ->` branch.

**Files:**
- Modify: `minifluxclient/src/main/java/com/jocmp/minifluxclient/Miniflux.kt:45-60`
- Modify: `capy/src/main/java/com/jocmp/capy/accounts/miniflux/MinifluxAccountDelegate.kt`
- Test: `capy/src/test/java/com/jocmp/capy/accounts/miniflux/MinifluxAccountDelegateTest.kt`

**Interfaces:**
- Consumes (from Task 1): `fetchEntriesPaged(fetch)`.
- Produces: `Miniflux.entries(..., feedId: Long? = null, ...)`; `private suspend fun refreshFeedScope(feedID: String)`.

- [ ] **Step 1: Add the `feed_id` query parameter to the Retrofit interface**

In `minifluxclient/src/main/java/com/jocmp/minifluxclient/Miniflux.kt`, add one line to the top-level `entries()` method, between `category_id` and `changed_after`:

```kotlin
    @GET("entries")
    suspend fun entries(
        @Query("status") status: String? = null,
        @Query("offset") offset: Int? = null,
        @Query("limit") limit: Int? = null,
        @Query("order") order: String? = null,
        @Query("direction") direction: String? = null,
        @Query("before") before: Long? = null,
        @Query("after") after: Long? = null,
        @Query("before_entry_id") beforeEntryId: Long? = null,
        @Query("after_entry_id") afterEntryId: Long? = null,
        @Query("starred") starred: Boolean? = null,
        @Query("search") search: String? = null,
        @Query("category_id") categoryId: Long? = null,
        @Query("feed_id") feedId: Long? = null,
        @Query("changed_after") changedAfter: Long? = null,
    ): Response<EntryResultSet>
```

The param is nullable with a default, so all existing call sites (delegate + tests) compile and match unchanged.

- [ ] **Step 2: Verify the client module still builds/tests**

Run: `./gradlew :minifluxclient:testDebugUnitTest`
Expected: PASS.

- [ ] **Step 3: Write the failing feed-scope test**

Add this test to `MinifluxAccountDelegateTest.kt`:

```kotlin
    @Test
    fun refresh_feedScope_fetchesOnlyFeedEntries() = runTest {
        FeedFixture(database).create(feedID = "2", folderNames = listOf("Tech"))

        coEvery {
            miniflux.entries(
                feedId = 2,
                limit = 250,
                offset = 0,
                order = "published_at",
                direction = "desc",
                changedAfter = null,
            )
        }.returns(
            Response.success(EntryResultSet(total = 1, entries = listOf(arsTechnicaArticle)))
        )

        delegate.refresh(
            ArticleFilter.Feeds(feedID = "2", folderTitle = "Tech", feedStatus = ArticleStatus.ALL)
        )

        val unread = database.articlesQueries
            .countAll(read = false, starred = false)
            .executeAsList()
        assertEquals(expected = 1, actual = unread.size)

        coVerify(exactly = 0) { miniflux.feeds() }
        coVerify(exactly = 0) { miniflux.categories() }
        coVerify { miniflux.entries(feedId = 2, limit = 250, offset = 0, order = "published_at", direction = "desc", changedAfter = null) }
    }
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `./gradlew :capy:testDebugUnitTest --tests com.jocmp.capy.accounts.miniflux.MinifluxAccountDelegateTest`
Expected: `refresh_feedScope_fetchesOnlyFeedEntries` FAILS (the `is Feeds` filter currently hits `else -> refreshAll()`, which calls the unstubbed `miniflux.feeds()`).

- [ ] **Step 5: Implement the feed branch**

In `MinifluxAccountDelegate.kt`, add the `is Feeds` branch to the `when` and the helper:

```kotlin
        when (filter) {
            is ArticleFilter.Folders -> refreshFolderScope(filter.folderTitle)
            is ArticleFilter.Feeds -> refreshFeedScope(filter.feedID)
            else -> refreshAll()
        }
```

```kotlin
private suspend fun refreshFeedScope(feedID: String) {
    val id = feedID.toLongOrNull() ?: return
    val changedAfter = preferences.lastRefreshedAt.get().takeIf { it > 0 }

    fetchEntriesPaged { offset ->
        miniflux.entries(
            feedId = id,
            limit = MAX_ENTRY_LIMIT,
            offset = offset,
            order = "published_at",
            direction = "desc",
            changedAfter = changedAfter,
        )
    }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `./gradlew :capy:testDebugUnitTest --tests com.jocmp.capy.accounts.miniflux.MinifluxAccountDelegateTest`
Expected: PASS (all tests).

- [ ] **Step 7: Commit**

```bash
git add minifluxclient/src/main/java/com/jocmp/minifluxclient/Miniflux.kt \
        capy/src/main/java/com/jocmp/capy/accounts/miniflux/MinifluxAccountDelegate.kt \
        capy/src/test/java/com/jocmp/capy/accounts/miniflux/MinifluxAccountDelegateTest.kt
git commit -m "feat(miniflux): scope pull-to-refresh to selected feed"
```

---

### Task 4: Full build + regression check

**Files:** none (verification only).

- [ ] **Step 1: Compile the debug variant**

Run: `./gradlew assembleFreeDebug`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 2: Run the full capy + minifluxclient unit test suites**

Run: `./gradlew :capy:testDebugUnitTest :minifluxclient:testDebugUnitTest`
Expected: PASS (no regressions in other delegates or the client).

- [ ] **Step 3: Multi-reviewer code review before final sign-off**

The change is >50 lines across delegate + client + tests. Per project policy, run the `code-review-panel` skill, address load-bearing findings, then (if fixes were made) re-run Step 2 before considering the work done.

---

## Self-Review

**Spec coverage:**
- Branch in delegate (`Folders`/`Feeds`/`else`) → Tasks 2 & 3. ✓
- `refreshAll()` extracted verbatim → Task 1 Step 2. ✓
- Shared `fetchEntriesPaged` helper (DRY with `fetchAllEntries`) → Task 1 Step 3. ✓
- `feed_id` client param → Task 3 Step 1. ✓
- Folder title → category id via `categories()` → Task 2 `resolveCategoryId`. ✓
- Deliberate skips (integration/feeds/reconciliation/watermark) → verified by Task 2 Step 2 tests (`coVerify(exactly = 0)`, watermark test). ✓
- Safety via `ON CONFLICT DO NOTHING` / no global reconciliation → Task 2 cross-folder test. ✓
- Edge cases: unknown folder (`resolveCategoryId` returns null → no-op) and bad feed id (`toLongOrNull()` → no-op) implemented in Tasks 2/3; `lastRefreshedAt == 0` → `changedAfter` null exercised by every scoped test (fixtures start at 0). ✓
- Use `entries(...)` not `categoryEntries`/`feedEntries` → enforced by the code in Tasks 2/3 + Global Constraints. ✓
- Six spec tests → folder request (Task 2 test 1), feed request (Task 3 test), cross-folder safety (Task 2 test 2), watermark preserved (Task 2 test 3), full path unchanged (existing `refresh_updatesEntries`, kept green by Tasks 1–3), unknown folder/bad id (covered by the no-op code paths; explicit tests optional and omitted to keep the suite focused). ✓

**Placeholder scan:** No TBD/TODO; every code and command step is concrete.

**Type consistency:** `refreshAll()`, `fetchEntriesPaged(fetch)`, `refreshFolderScope(String)`, `refreshFeedScope(String)`, `resolveCategoryId(String): Long?`, and `entries(..., feedId: Long? = null, ...)` are used consistently across tasks. Filter constructors match `ArticleFilter.kt`: `Folders(folderTitle, folderStatus)`, `Feeds(feedID, folderTitle, feedStatus)`. Test helpers match fixtures: `FeedFixture.create(feedID, folderNames)`, `ArticleFixture.create(read)`, `articleMapper`, `articlesQueries.countAll(read, starred)`, `findBy(articleID, mapper)`.
