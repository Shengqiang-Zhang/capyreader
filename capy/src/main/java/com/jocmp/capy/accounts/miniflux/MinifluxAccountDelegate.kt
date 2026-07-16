package com.jocmp.capy.accounts.miniflux

import com.jocmp.capy.AccountDelegate
import com.jocmp.capy.AccountPreferences
import com.jocmp.capy.ArticleFilter
import com.jocmp.capy.Feed
import com.jocmp.capy.accounts.AddFeedResult
import com.jocmp.capy.accounts.withErrorHandling
import com.jocmp.capy.common.ContentFormatter
import com.jocmp.capy.common.TimeHelpers
import com.jocmp.capy.common.UnauthorizedError
import com.jocmp.capy.common.toDateTime
import com.jocmp.capy.common.transactionWithErrorHandling
import com.jocmp.capy.db.Database
import com.jocmp.capy.logging.CapyLog
import com.jocmp.capy.persistence.ArticleRecords
import com.jocmp.capy.persistence.EnclosureRecords
import com.jocmp.capy.persistence.FeedRecords
import com.jocmp.capy.persistence.TaggingRecords
import com.jocmp.minifluxclient.CreateCategoryRequest
import com.jocmp.minifluxclient.CreateFeedRequest
import com.jocmp.minifluxclient.Enclosure
import com.jocmp.minifluxclient.Entry
import com.jocmp.minifluxclient.EntryResultSet
import com.jocmp.minifluxclient.EntryStatus
import com.jocmp.minifluxclient.Miniflux
import com.jocmp.minifluxclient.UpdateCategoryRequest
import com.jocmp.minifluxclient.UpdateEntriesRequest
import com.jocmp.minifluxclient.UpdateFeedRequest
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import okio.IOException
import org.jsoup.Jsoup
import retrofit2.Response
import java.net.HttpURLConnection
import java.time.ZonedDateTime
import com.jocmp.minifluxclient.Feed as MinifluxFeed

internal class MinifluxAccountDelegate(
    private val database: Database,
    private val miniflux: Miniflux,
    private val preferences: AccountPreferences,
) : AccountDelegate {
    private val articleRecords = ArticleRecords(database)
    private val enclosureRecords = EnclosureRecords(database)
    private val feedRecords = FeedRecords(database)
    private val taggingRecords = TaggingRecords(database)

    /** Outcome of fetching a complete set of entry IDs. */
    private sealed interface EntryIDSync {
        data class Complete(val ids: List<String>) : EntryIDSync

        /** The server has no `/entries/ids` route (Miniflux < 2.3.2). */
        object Unsupported : EntryIDSync

        /** A request failed, so the set cannot be reconciled against. */
        object Incomplete : EntryIDSync
    }

    override suspend fun refresh(filter: ArticleFilter, cutoffDate: ZonedDateTime?): Result<Unit> {
        return try {
            when (filter) {
                is ArticleFilter.Folders -> refreshFolderScope(filter.folderTitle)
                is ArticleFilter.Feeds -> refreshFeedScope(filter.feedID)
                else -> refreshAll()
            }

            Result.success(Unit)
        } catch (exception: IOException) {
            Result.failure(exception)
        } catch (e: UnauthorizedError) {
            Result.failure(e)
        }
    }

    private suspend fun refreshAll() {
        // The integration status is independent of everything else, so it rides
        // alongside the feed fetch rather than adding a round trip ahead of it.
        coroutineScope {
            val integrationStatus = async { refreshIntegrationStatus() }
            val feeds = async { refreshFeeds() }

            integrationStatus.await()
            feeds.await()
        }

        refreshArticles()
        preferences.touchLastRefreshedAt()
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

    private suspend fun resolveCategoryId(folderTitle: String): Long? {
        val categoryId = miniflux.categories().body()?.find { it.title == folderTitle }?.id

        if (categoryId == null) {
            // Category lookup failed (transient HTTP error) or the folder was
            // renamed/removed server-side. The scoped refresh becomes a no-op;
            // log so the silent path is at least diagnosable.
            CapyLog.warn("resolve_category", mapOf("folder" to folderTitle))
        }

        return categoryId
    }

    override suspend fun markRead(articleIDs: List<String>): Result<Unit> {
        val entryIDs = articleIDs.map { it.toLong() }

        return withErrorHandling {
            miniflux.updateEntries(
                UpdateEntriesRequest(
                    entry_ids = entryIDs,
                    status = EntryStatus.READ
                )
            )
            Unit
        }
    }

    override suspend fun markUnread(articleIDs: List<String>): Result<Unit> {
        val entryIDs = articleIDs.map { it.toLong() }

        return withErrorHandling {
            miniflux.updateEntries(
                UpdateEntriesRequest(
                    entry_ids = entryIDs,
                    status = EntryStatus.UNREAD
                )
            )
            Unit
        }
    }

    override suspend fun addStar(articleIDs: List<String>): Result<Unit> {
        val entryIDs = articleIDs.map { it.toLong() }

        return withErrorHandling {
            entryIDs.forEach { entryID ->
                miniflux.toggleBookmark(entryID)
            }
            Unit
        }
    }

    override suspend fun removeStar(articleIDs: List<String>): Result<Unit> {
        val entryIDs = articleIDs.map { it.toLong() }

        return withErrorHandling {
            entryIDs.forEach { entryID ->
                miniflux.toggleBookmark(entryID)
            }
            Unit
        }
    }

    override suspend fun addSavedSearch(articleID: String, savedSearchID: String): Result<Unit> {
        return Result.failure(UnsupportedOperationException("Labels not supported"))
    }

    override suspend fun removeSavedSearch(articleID: String, savedSearchID: String): Result<Unit> {
        return Result.failure(UnsupportedOperationException("Labels not supported"))
    }

    override suspend fun createSavedSearch(name: String): Result<String> {
        return Result.failure(UnsupportedOperationException("Labels not supported"))
    }

    override suspend fun createPage(url: String) =
        Result.failure<Unit>(UnsupportedOperationException("Pages not supported"))

    override suspend fun saveArticleExternally(articleID: String): Result<Unit> {
        return try {
            val response = miniflux.saveEntry(articleID.toLong())
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(IOException("Save failed"))
            }
        } catch (e: IOException) {
            Result.failure(e)
        }
    }

    override suspend fun addFeed(
        url: String,
        title: String?,
        folderTitles: List<String>?
    ): AddFeedResult {
        return try {
            val categoryId = folderTitles?.firstOrNull()?.let { folderTitle ->
                findOrCreateCategory(folderTitle)
            }

            val response = miniflux.createFeed(
                CreateFeedRequest(feed_url = url, category_id = categoryId)
            )
            val createResponse = response.body()

            if (response.code() > 300 || createResponse == null) {
                return AddFeedResult.Failure(AddFeedResult.Error.FeedNotFound())
            }

            val feedResponse = miniflux.feed(createResponse.feed_id)
            val feed = feedResponse.body()

            return if (feed != null) {
                val icons = fetchIcons(listOf(feed))
                upsertFeed(feed, icons)

                val localFeed = feedRecords.find(feed.id.toString())

                if (localFeed != null) {
                    coroutineScope {
                        launch { refreshArticles() }
                    }

                    AddFeedResult.Success(localFeed)
                } else {
                    AddFeedResult.Failure(AddFeedResult.Error.SaveFailure())
                }
            } else {
                AddFeedResult.Failure(AddFeedResult.Error.FeedNotFound())
            }
        } catch (e: IOException) {
            AddFeedResult.networkError()
        }
    }

    override suspend fun updateFeed(
        feed: Feed,
        title: String,
        folderTitles: List<String>,
    ): Result<Feed> = withErrorHandling {
        val categoryId = folderTitles.firstOrNull()?.let { folderTitle ->
            findOrCreateCategory(folderTitle)
        }

        miniflux.updateFeed(
            feedID = feed.id.toLong(),
            request = UpdateFeedRequest(title = title, category_id = categoryId)
        )

        database.transactionWithErrorHandling {
            feedRecords.update(
                feedID = feed.id,
                title = title,
            )

            if (categoryId != null) {
                folderTitles.forEach { folderTitle ->
                    taggingRecords.upsert(
                        id = taggingID(feed.id, categoryId),
                        feedID = feed.id,
                        name = folderTitle,
                    )
                }
            }

            val taggingIDsToDelete = taggingRecords.findFeedTaggingsToDelete(
                feed = feed,
                excludedTaggingNames = folderTitles
            )

            taggingIDsToDelete.forEach { taggingID ->
                taggingRecords.deleteTagging(taggingID = taggingID)
            }
        }

        feedRecords.find(feed.id)
    }

    override suspend fun updateFolder(
        oldTitle: String,
        newTitle: String
    ): Result<Unit> = withErrorHandling {
        val categories = miniflux.categories().body() ?: emptyList()
        val category = categories.find { it.title == oldTitle }

        if (category != null) {
            miniflux.updateCategory(
                categoryID = category.id,
                request = UpdateCategoryRequest(title = newTitle)
            )

            taggingRecords.updateTitle(previousTitle = oldTitle, title = newTitle)
        }

        Unit
    }

    override suspend fun removeFeed(feed: Feed): Result<Unit> = withErrorHandling {
        miniflux.deleteFeed(feedID = feed.id.toLong())

        Unit
    }

    override suspend fun removeFolder(folderTitle: String): Result<Unit> = withErrorHandling {
        val categories = miniflux.categories().body() ?: emptyList()
        val category = categories.find { it.title == folderTitle }

        if (category != null) {
            miniflux.deleteCategory(categoryID = category.id)
            taggingRecords.deleteByFolderName(folderTitle)
        }

        Unit
    }

    private suspend fun refreshIntegrationStatus() {
        try {
            val response = miniflux.integrationStatus()
            val status = response.body()
            if (response.isSuccessful && status != null) {
                preferences.canSaveArticleExternally.set(status.has_integrations)
            }
        } catch (e: CancellationException) {
            // This runs alongside refreshFeeds(), so a failure there cancels
            // this coroutine. Swallowing that below would break the scope's
            // structured cancellation.
            throw e
        } catch (e: Exception) {
            CapyLog.warn("refresh_integration_status", mapOf("error" to e.message))
        }
    }

    private suspend fun refreshFeeds() {
        val feedsResponse = miniflux.feeds()
        val feeds = feedsResponse.body()

        if (!feedsResponse.isSuccessful || feeds == null) {
            return
        }

        val feedIDsWithIcons = database.feedsQueries.all()
            .executeAsList()
            .filter { it.favicon_url != null }
            .map { it.id }
            .toSet()

        val icons = fetchIcons(feeds.filterNot { it.id.toString() in feedIDsWithIcons })

        database.transactionWithErrorHandling {
            feeds.forEach { feed ->
                upsertFeed(feed, icons)
            }
        }

        val feedsToKeep = feeds.map { it.id.toString() }
        database.feedsQueries.deleteAllExcept(feedsToKeep)
    }

    private suspend fun refreshArticles() = coroutineScope {
        val starred = async { refreshStarredEntries() }
        val unread = async { refreshUnreadEntries() }
        starred.await()
        unread.await()
        fetchAllEntries()
    }

    private suspend fun refreshStarredEntries() {
        val ids = entryIDs(starred = true) ?: return

        articleRecords.markAllStarred(articleIDs = ids)
    }

    private suspend fun refreshUnreadEntries() {
        val ids = entryIDs(status = EntryStatus.UNREAD.value) ?: return

        articleRecords.markAllUnread(articleIDs = ids)
    }

    /**
     * The complete set of entry IDs matching the query, or null when it could
     * not be fetched in full.
     *
     * Callers reconcile local state against the whole set: [ArticleRecords.markAllUnread]
     * marks every article *outside* it as read, and [ArticleRecords.markAllStarred]
     * un-stars every article outside it. Reconciling against a partial list would
     * silently mark unread articles read and drop stars, so a failed or truncated
     * fetch returns null and the caller skips reconciliation entirely.
     */
    private suspend fun entryIDs(status: String? = null, starred: Boolean? = null): List<String>? {
        val ids = when (val result = fetchEntryIDs(status = status, starred = starred)) {
            is EntryIDSync.Complete -> result.ids
            EntryIDSync.Incomplete -> null
            // Probed on every refresh rather than cached. A 400/404 also comes
            // from proxies, rolling deploys, and route-level policies, so a
            // remembered "unsupported" would strand the account on the expensive
            // fallback for the rest of the session and miss a server upgrade.
            // The probe is a single small request; the fallback it guards
            // downloads the entire backlog.
            EntryIDSync.Unsupported -> fetchEntryIDsFromEntries(status = status, starred = starred)
        }

        if (ids == null) {
            // Reconciliation is skipped this refresh. refresh() still reports
            // success, so without this the account would silently stop syncing
            // read and starred state for as long as the server keeps failing.
            CapyLog.warn(
                "entry_ids_incomplete",
                mapOf("status" to status.orEmpty(), "starred" to starred.toString())
            )
        }

        return ids
    }

    /**
     * Fetches IDs via `GET /entries/ids`, which omits entry content. One request
     * covers up to [MAX_ENTRY_ID_LIMIT] entries.
     */
    private suspend fun fetchEntryIDs(status: String?, starred: Boolean?): EntryIDSync {
        val response = miniflux.entryIDs(
            status = status,
            starred = starred,
            limit = MAX_ENTRY_ID_LIMIT,
            offset = 0,
        )

        // Miniflux older than 2.3.2 has no `/entries/ids` route, so the path
        // falls through to `GET /entries/{entryID}` and is rejected as an
        // invalid entry ID with a 400. 404 covers servers (or proxies) that
        // match the path to nothing at all.
        if (response.code() == HttpURLConnection.HTTP_BAD_REQUEST ||
            response.code() == HttpURLConnection.HTTP_NOT_FOUND
        ) {
            CapyLog.info("entry_ids_unsupported", mapOf("code" to response.code().toString()))

            return EntryIDSync.Unsupported
        }

        val firstPage = response.body() ?: return EntryIDSync.Incomplete

        val ids = pagedEntryIDs(
            total = firstPage.total,
            firstPageIDs = firstPage.entry_ids.map { it.toString() },
            pageSize = MAX_ENTRY_ID_LIMIT,
        ) { offset ->
            miniflux.entryIDs(
                status = status,
                starred = starred,
                limit = MAX_ENTRY_ID_LIMIT,
                offset = offset,
            ).body()?.entry_ids?.map { it.toString() }
        }

        return ids?.let { EntryIDSync.Complete(it) } ?: EntryIDSync.Incomplete
    }

    /**
     * Fallback for servers without `GET /entries/ids`. Every page carries the
     * full content of all [MAX_ENTRY_LIMIT] entries only for their IDs to be
     * kept, so this downloads the entire unread (or starred) backlog on each
     * refresh. It exists solely for Miniflux older than 2.3.2.
     */
    private suspend fun fetchEntryIDsFromEntries(status: String?, starred: Boolean?): List<String>? {
        val firstPage = miniflux.entries(
            status = status,
            starred = starred,
            limit = MAX_ENTRY_LIMIT,
            offset = 0,
        ).body() ?: return null

        return pagedEntryIDs(
            total = firstPage.total,
            firstPageIDs = firstPage.entries.map { it.id.toString() },
            pageSize = MAX_ENTRY_LIMIT,
        ) { offset ->
            miniflux.entries(
                status = status,
                starred = starred,
                limit = MAX_ENTRY_LIMIT,
                offset = offset,
            ).body()?.entries?.map { it.id.toString() }
        }
    }

    /**
     * Collects the remaining pages after [firstPageIDs], or null if the complete
     * set of [total] IDs could not be assembled.
     */
    private suspend fun pagedEntryIDs(
        total: Int,
        firstPageIDs: List<String>,
        pageSize: Int,
        fetchPage: suspend (offset: Int) -> List<String>?,
    ): List<String>? {
        if (firstPageIDs.size >= total) {
            return firstPageIDs
        }

        val remaining = fetchPagesConcurrently(pageSize until total step pageSize, fetchPage)
            ?: return null

        // Offset pagination is not a snapshot. Entries added or removed
        // server-side between page requests shift rows across page boundaries,
        // so a page can come back short or repeat an entry already seen. Since
        // the caller reconciles against the whole set, a set that does not
        // account for every advertised entry has to be treated as a failed
        // fetch -- reconciling against it would mark the missing articles read
        // and drop their stars. The next refresh retries from a fresh snapshot.
        val ids = (firstPageIDs + remaining).distinct()

        return ids.takeIf { it.size == total }
    }

    /**
     * Runs [fetch] across [offsets] with bounded concurrency, preserving offset
     * order. Returns null if any page fails, since callers need the full set.
     */
    private suspend fun fetchPagesConcurrently(
        offsets: IntProgression,
        fetch: suspend (offset: Int) -> List<String>?,
    ): List<String>? = coroutineScope {
        val semaphore = Semaphore(MAX_CONCURRENT_FETCHES)

        val pages = offsets.map { offset ->
            async { semaphore.withPermit { fetch(offset) } }
        }.awaitAll()

        if (pages.any { it == null }) {
            null
        } else {
            pages.filterNotNull().flatten()
        }
    }

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

    private fun saveEntries(entries: List<Entry>) {
        // Resolve Miniflux MEDIA_PROXY_MODE rewrites at sync time so /proxy/{hash}
        // image URLs reach the WebView as absolute URLs anchored at the user's
        // Miniflux origin. Otherwise they 404 — loadDataWithBaseURL(null) leaves
        // relative paths unresolvable.
        val minifluxBaseUrl = preferences.url.get()

        // A scoped (folder/feed) refresh skips the account-wide refreshFeeds(),
        // so a feed referenced by these entries may not exist locally yet (e.g. a
        // feed added to the category from another client since the last full sync).
        // Every article-listing query INNER JOINs feeds, so an article whose feed
        // is missing would be invisible. Miniflux embeds each entry's feed in the
        // /entries payload, so upsert any missing ones (favicon backfills on the
        // next full refresh). Feeds already present are left untouched.
        val knownFeedIDs = database.feedsQueries.all().executeAsList().map { it.id }.toSet()
        val missingFeeds = entries
            .mapNotNull { it.feed }
            .distinctBy { it.id }
            .filterNot { it.id.toString() in knownFeedIDs }

        // Parse titles, rewrite proxy URLs, and build summaries before opening
        // the transaction. That work dominates the cost of saving a page, and
        // SQLite has a single writer -- doing it inside the transaction holds
        // the write lock against the other concurrent page fetches and against
        // the article list's own reads.
        val prepared = entries.map { entry -> prepare(entry, minifluxBaseUrl) }

        database.transactionWithErrorHandling {
            missingFeeds.forEach { feed ->
                upsertFeed(feed, icons = emptyMap())
            }

            prepared.forEach { entry ->
                database.articlesQueries.create(
                    id = entry.articleID,
                    feed_id = entry.feedID,
                    title = entry.title,
                    author = entry.author,
                    content_html = entry.content,
                    extracted_content_url = null,
                    url = entry.url,
                    summary = entry.summary,
                    image_url = entry.imageURL,
                    published_at = entry.publishedAt,
                    enclosure_type = entry.enclosures.firstOrNull()?.mime_type,
                )

                articleRecords.createStatus(
                    articleID = entry.articleID,
                    updatedAt = entry.updatedAt,
                    read = entry.read,
                    // Persist the server's starred flag for new articles. A scoped
                    // refresh skips refreshStarredEntries(); without this a newly
                    // fetched, already-starred entry would be stored unstarred, and
                    // tapping the star would toggle the remote bookmark OFF (Miniflux
                    // uses a toggle endpoint), silently deleting it. ON CONFLICT DO
                    // NOTHING keeps existing/pending local star state intact.
                    starred = entry.starred,
                )

                entry.enclosures.forEach { enclosure ->
                    enclosureRecords.create(
                        url = enclosure.url,
                        type = enclosure.mime_type,
                        articleID = entry.articleID,
                        itunesDurationSeconds = null,
                        itunesImage = null,
                    )
                }
            }
        }
    }

    private fun prepare(entry: Entry, minifluxBaseUrl: String): PreparedEntry {
        val updated = TimeHelpers.nowUTC()
        val resolvedContent = MinifluxProxyResolver.resolve(entry.content, minifluxBaseUrl)

        return PreparedEntry(
            articleID = entry.id.toString(),
            feedID = entry.feed_id.toString(),
            title = Jsoup.parse(entry.title).text(),
            author = entry.author,
            content = resolvedContent,
            url = entry.url,
            summary = ContentFormatter.summary(resolvedContent),
            imageURL = MinifluxEnclosureParsing.parsedImageURL(entry),
            publishedAt = entry.published_at.toDateTime?.toEpochSecond() ?: updated.toEpochSecond(),
            updatedAt = updated,
            read = entry.status == EntryStatus.READ,
            starred = entry.starred,
            enclosures = entry.enclosures.orEmpty(),
        )
    }

    /** An [Entry] with its content parsed, ready for insertion. */
    private data class PreparedEntry(
        val articleID: String,
        val feedID: String,
        val title: String,
        val author: String?,
        val content: String,
        val url: String,
        val summary: String,
        val imageURL: String?,
        val publishedAt: Long,
        val updatedAt: ZonedDateTime,
        val read: Boolean,
        val starred: Boolean,
        val enclosures: List<Enclosure>,
    )

    private fun upsertFeed(feed: MinifluxFeed, icons: Map<Long, String>) {
        val icon = feed.icon?.icon_id?.let { icons[it] }

        database.feedsQueries.upsert(
            id = feed.id.toString(),
            subscription_id = feed.id.toString(),
            title = feed.title,
            feed_url = feed.feed_url,
            site_url = feed.site_url,
            favicon_url = icon,
            priority = null,
            itunes_image_url = null,
            read_later = false,
        )

        feed.category?.let { category ->
            database.taggingsQueries.upsert(
                id = taggingID(feed.id.toString(), category.id),
                feed_id = feed.id.toString(),
                name = category.title
            )
        }
    }

    private suspend fun findOrCreateCategory(title: String): Long {
        val categories = miniflux.categories().body() ?: emptyList()
        val existing = categories.find { it.title == title }

        return if (existing != null) {
            existing.id
        } else {
            val response = miniflux.createCategory(CreateCategoryRequest(title = title))
            response.body()?.id ?: throw IOException("Failed to create category")
        }
    }

    private fun taggingID(feedID: String, categoryId: Long) = "${feedID}-${categoryId}"

    private suspend fun fetchIcons(feeds: List<MinifluxFeed>): Map<Long, String> = coroutineScope {
        val iconIds = feeds.mapNotNull { it.icon?.icon_id }.filter { it > 0 }.distinct()

        iconIds.map { iconId ->
            async {
                try {
                    val response = miniflux.icon(iconId)
                    val iconData = response.body()

                    if (response.isSuccessful && iconData != null) {
                        iconId to "data:${iconData.data}"
                    } else {
                        null
                    }
                } catch (_: Exception) {
                    CapyLog.warn("fetch_icon", mapOf("icon_id" to iconId.toString()))
                    null
                }
            }
        }.awaitAll().filterNotNull().toMap()
    }

    companion object {
        const val MAX_ENTRY_LIMIT = 250

        /** Miniflux caps `GET /entries/ids` at 10,000 IDs per request. */
        const val MAX_ENTRY_ID_LIMIT = 10_000

        private const val MAX_CONCURRENT_FETCHES = 4
    }
}
