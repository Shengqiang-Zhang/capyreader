package com.capyreader.app.ui.components

import android.webkit.WebResourceRequest
import java.net.URI

object WebRequestProxyPolicy {
    fun shouldProxy(url: String, request: WebResourceRequest, pageUrl: String?): Boolean {
        if (isKnownHTMLRedirect(url)) {
            return false
        }

        return isCorsRequest(url, request) ||
                isIframeNavigation(url, request) ||
                isMediaRequest(url, request, pageUrl)
    }

    /**
     * Referer value to attach to a proxied request.
     *
     * For media sub-resources we use the request URL's own origin so that hotlink-protected
     * CDNs that allow same-origin Referers (but reject unrelated hosts) still serve the asset.
     * It also keeps the article URL from leaking to third-party image hosts.
     * Issue #1878 (needs-a-Referer CDNs) is still satisfied because we always send one.
     *
     * Iframe and CORS proxies keep the article URL as Referer, since some embeds depend on it.
     */
    fun refererFor(url: String, request: WebResourceRequest, pageUrl: String?): String? {
        if (isMediaRequest(url, request, pageUrl)) {
            return originOf(url) ?: pageUrl
        }
        return pageUrl
    }

    // XHR/fetch from null origin (loadDataWithBaseURL)
    // Issue #1616
    private fun isCorsRequest(url: String, request: WebResourceRequest): Boolean {
        val origin = request.requestHeaders["Origin"]
        return origin == "null" && url.startsWith("http")
    }

    // iframe document load
    // Strips X-Frame-Options to allow embeds like Slashdot
    // Issue #1605
    private fun isIframeNavigation(url: String, request: WebResourceRequest): Boolean {
        val accept = request.requestHeaders["Accept"]
        return !request.isForMainFrame &&
                accept?.startsWith("text/html") == true &&
                url.startsWith("http")
    }

    // Sub-resource requests that need a Referer header for CDNs
    // Only proxy article sub-resources (null or absent origin from loadDataWithBaseURL),
    // not iframe sub-resources which have their own origin (Issue #1878)
    private fun isMediaRequest(
        url: String,
        request: WebResourceRequest,
        pageUrl: String?,
    ): Boolean {
        val origin = request.requestHeaders["Origin"]
        val accept = request.requestHeaders["Accept"]
        return pageUrl != null &&
                !request.isForMainFrame &&
                isMediaOrigin(origin) &&
                accept?.startsWith("text/html") != true &&
                url.startsWith("http")
    }

    private fun originOf(url: String): String? {
        return try {
            val uri = URI(url)
            val scheme = uri.scheme ?: return null
            val authority = uri.authority ?: return null
            "$scheme://$authority"
        } catch (_: Exception) {
            null
        }
    }

    // Skips if the origin is missing which is the case
    // with Mercury Parser, or if it's a string of "null"
    // which is the case with main frame images
    // Issue #1315, Issue #1901
    fun isMediaOrigin(origin: String?): Boolean {
        return origin == null || origin == "null"
    }

    // Reddit embeds www.reddit.com/media?url=... as image srcs in feeds,
    // but that endpoint serves an HTML viewer page, not the image itself.
    // Issue #1888
    internal fun isKnownHTMLRedirect(url: String): Boolean {
        return try {
            val uri = URI(url)
            val host = uri.host ?: return false
            (host.endsWith("reddit.com") && uri.path == "/media") ||
                    host.endsWith("preview.redd.it")
        } catch (_: Exception) {
            false
        }
    }
}
