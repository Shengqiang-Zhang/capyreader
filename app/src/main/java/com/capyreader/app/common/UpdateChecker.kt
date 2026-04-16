package com.capyreader.app.common

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request

sealed class UpdateCheckResult {
    data class UpdateAvailable(val tagName: String, val releaseUrl: String) : UpdateCheckResult()
    object UpToDate : UpdateCheckResult()
    object Failure : UpdateCheckResult()
}

class UpdateChecker(
    private val httpClient: OkHttpClient,
    private val owner: String = GITHUB_OWNER,
    private val repo: String = GITHUB_REPO,
) {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun check(currentVersion: String): UpdateCheckResult = withContext(Dispatchers.IO) {
        runCatching {
            val request = Request.Builder()
                .url("https://api.github.com/repos/$owner/$repo/releases/latest")
                .header("Accept", "application/vnd.github+json")
                .build()

            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext UpdateCheckResult.Failure
                val body = response.body.string()
                val release = json.decodeFromString<GitHubRelease>(body)
                if (isNewer(currentVersion, release.tagName)) {
                    UpdateCheckResult.UpdateAvailable(release.tagName, release.htmlUrl)
                } else {
                    UpdateCheckResult.UpToDate
                }
            }
        }.getOrElse { UpdateCheckResult.Failure }
    }

    @Serializable
    private data class GitHubRelease(
        @SerialName("tag_name") val tagName: String,
        @SerialName("html_url") val htmlUrl: String,
    )

    companion object {
        const val GITHUB_OWNER = "Shengqiang-Zhang"
        const val GITHUB_REPO = "capyreader"
        const val RELEASES_URL = "https://github.com/$GITHUB_OWNER/$GITHUB_REPO/releases"

        fun isNewer(currentVersion: String, latestTag: String): Boolean {
            val current = parseVersion(currentVersion)
            val latest = parseVersion(latestTag)
            val length = maxOf(current.size, latest.size)
            (0 until length).forEach { i ->
                val a = current.getOrElse(i) { 0 }
                val b = latest.getOrElse(i) { 0 }
                if (b != a) return b > a
            }
            return false
        }

        private fun parseVersion(value: String): List<Int> =
            value.removePrefix("v")
                .split('.', '-', '_')
                .mapNotNull { it.toIntOrNull() }
    }
}
