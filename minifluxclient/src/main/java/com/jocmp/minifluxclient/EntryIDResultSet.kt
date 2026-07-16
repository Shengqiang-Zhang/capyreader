package com.jocmp.minifluxclient

import com.squareup.moshi.JsonClass

/**
 * Response for `GET /entries/ids`, available since Miniflux 2.3.2.
 *
 * [total] is the count of entries matching the query, which may exceed
 * [entry_ids] when the result is paginated.
 */
@JsonClass(generateAdapter = true)
data class EntryIDResultSet(
    val total: Int,
    val entry_ids: List<Long>
)
