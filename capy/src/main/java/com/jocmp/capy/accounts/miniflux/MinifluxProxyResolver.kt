package com.jocmp.capy.accounts.miniflux

import java.net.URI

// Miniflux rewrites image URLs to `/proxy/{hash}/{encoded}` paths when its
// server-side MEDIA_PROXY_MODE (or PROXY_MEDIA_TYPES) is configured. Those
// paths resolve against Miniflux in its own web UI, but in a third-party
// client they resolve against `null` (loadDataWithBaseURL) and 404. Rewrite
// them to absolute URLs on the user's Miniflux origin so the WebView loads
// them from the Miniflux instance instead — that also lets Miniflux bypass
// cross-origin hotlink blocks for CDNs that reject non-server requests
// (e.g. `*.jintiankansha.me`, Tencent COS, `i.qbitai.com`).
//
// Mirrors `web/src/api/resolveProxyUrls.ts`. Keep the two in sync.
//
// Two rewrite cases:
//   (a) Relative `/proxy/...` — emitted when Miniflux's BASE_URL is unset.
//   (b) Absolute `http(s)://localhost[:port]/proxy/...` and
//       `http(s)://127.0.0.1[:port]/proxy/...` — emitted when BASE_URL
//       defaults to `http://localhost` (a common Heroku/Docker
//       misconfiguration). The HMAC signature in the URL only covers the
//       encoded image path, so swapping the host is safe.
internal object MinifluxProxyResolver {
    private val URL_ATTR_REGEX =
        Regex(
            """(\b(?:src|data-src|poster|href)=)(['"])(/|https?://(?:localhost|127\.0\.0\.1)(?::\d+)?/)proxy/""",
            RegexOption.IGNORE_CASE,
        )

    private val SRCSET_ATTR_REGEX = Regex("""(\bsrcset=)(['"])([^'"]*)(['"])""")

    private val LOCALHOST_PROXY_PREFIX_REGEX =
        Regex(
            """^https?://(?:localhost|127\.0\.0\.1)(?::\d+)?/proxy/""",
            RegexOption.IGNORE_CASE,
        )

    /**
     * Extract the application root from [rawBaseUrl] so proxy requests route
     * correctly. The stored URL is typically the API endpoint
     * (`https://server/v1/` or `https://server/rss/v1/` for subfolder
     * deployments); strip the trailing `/v1` segment (if present) and any
     * trailing slashes to recover the Miniflux application base where
     * `/proxy/...` lives.
     * Returns an empty string when the URL is missing or unparseable, which
     * makes [resolve] a no-op.
     */
    fun originOf(rawBaseUrl: String): String {
        if (rawBaseUrl.isBlank()) return ""
        return try {
            val uri = URI(rawBaseUrl.trim())
            val scheme = uri.scheme ?: return ""
            val host = uri.host ?: return ""
            val port = uri.port
            val authority = if (port != -1) "$scheme://$host:$port" else "$scheme://$host"
            val path = (uri.path ?: "")
                .trimEnd('/')
                .removeSuffix("/v1")
                .trimEnd('/')
            if (path.isEmpty()) authority else "$authority$path"
        } catch (_: Exception) {
            ""
        }
    }

    fun resolve(html: String, minifluxBaseUrl: String): String {
        if (html.isEmpty()) return html
        val base = originOf(minifluxBaseUrl)
        if (base.isEmpty()) return html

        val attrsRewritten = URL_ATTR_REGEX.replace(html) { match ->
            "${match.groupValues[1]}${match.groupValues[2]}$base/proxy/"
        }

        return SRCSET_ATTR_REGEX.replace(attrsRewritten) { match ->
            val prefix = match.groupValues[1]
            val openQuote = match.groupValues[2]
            val value = match.groupValues[3]
            val closeQuote = match.groupValues[4]
            val rewritten = parseSrcsetCandidates(value)
                .joinToString(", ") { (url, descriptor) ->
                    val resolved = rewriteSrcsetCandidate(url, base)
                    if (descriptor.isEmpty()) resolved else "$resolved $descriptor"
                }
            "$prefix$openQuote$rewritten$closeQuote"
        }
    }

    private fun rewriteSrcsetCandidate(url: String, base: String): String {
        if (url.startsWith("/proxy/")) return "$base$url"
        val match = LOCALHOST_PROXY_PREFIX_REGEX.find(url)
        if (match != null) return "$base/proxy/${url.substring(match.range.last + 1)}"
        return url
    }

    // Parse a srcset attribute value into URL+descriptor pairs following the
    // HTML spec (https://html.spec.whatwg.org/multipage/images.html#parsing-a-srcset-attribute).
    // Candidate URLs may contain commas (Cloudinary transform params, etc.),
    // so we cannot simply split on "," — the spec collects each URL as a run
    // of non-whitespace chars and only treats a trailing comma as the
    // candidate separator.
    private fun parseSrcsetCandidates(srcset: String): List<Pair<String, String>> {
        val candidates = mutableListOf<Pair<String, String>>()
        var i = 0
        val len = srcset.length

        while (i < len) {
            while (i < len && (srcset[i] == ',' || srcset[i].isWhitespace())) i++
            if (i >= len) break

            val start = i
            while (i < len && !srcset[i].isWhitespace()) i++
            var url = srcset.substring(start, i)

            val hadTrailingComma = url.endsWith(",")
            if (hadTrailingComma) url = url.trimEnd(',')

            val descriptorParts = mutableListOf<String>()
            if (!hadTrailingComma) {
                while (i < len) {
                    while (i < len && srcset[i].isWhitespace()) i++
                    if (i >= len || srcset[i] == ',') {
                        if (i < len) i++
                        break
                    }
                    val t = i
                    while (i < len && !srcset[i].isWhitespace() && srcset[i] != ',') i++
                    descriptorParts.add(srcset.substring(t, i))
                }
            }

            candidates.add(url to descriptorParts.joinToString(" "))
        }

        return candidates
    }
}
