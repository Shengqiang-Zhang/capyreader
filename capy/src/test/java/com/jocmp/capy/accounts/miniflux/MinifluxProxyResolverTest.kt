package com.jocmp.capy.accounts.miniflux

import org.junit.Test
import kotlin.test.assertEquals

class MinifluxProxyResolverTest {
    private val base = "https://miniflux.example.com"

    @Test
    fun resolve_leavesEmptyContentUntouched() {
        assertEquals("", MinifluxProxyResolver.resolve("", base))
    }

    @Test
    fun resolve_leavesContentUntouchedWhenBaseIsEmpty() {
        val html = """<img src="/proxy/abc/def">"""
        assertEquals(html, MinifluxProxyResolver.resolve(html, ""))
    }

    @Test
    fun resolve_leavesContentUntouchedWhenBaseIsUnparseable() {
        val html = """<img src="/proxy/abc/def">"""
        assertEquals(html, MinifluxProxyResolver.resolve(html, "not a url"))
    }

    @Test
    fun resolve_rewritesRelativeProxySrcToAbsoluteMinifluxUrl() {
        val html = """<img src="/proxy/abc123/base64encoded">"""
        assertEquals(
            """<img src="https://miniflux.example.com/proxy/abc123/base64encoded">""",
            MinifluxProxyResolver.resolve(html, base),
        )
    }

    @Test
    fun resolve_handlesSingleQuotedAttributes() {
        val html = """<img src='/proxy/h/u'>"""
        assertEquals(
            """<img src='https://miniflux.example.com/proxy/h/u'>""",
            MinifluxProxyResolver.resolve(html, base),
        )
    }

    @Test
    fun resolve_rewritesDataSrcPosterAndHref() {
        val html =
            """<img data-src="/proxy/a/b"><video poster="/proxy/c/d"></video><a href="/proxy/e/f">x</a>"""
        val out = MinifluxProxyResolver.resolve(html, base)
        assertEquals(
            true,
            out.contains("""data-src="$base/proxy/a/b""""),
            "Expected data-src rewritten in: $out",
        )
        assertEquals(
            true,
            out.contains("""poster="$base/proxy/c/d""""),
            "Expected poster rewritten in: $out",
        )
        assertEquals(
            true,
            out.contains("""href="$base/proxy/e/f""""),
            "Expected href rewritten in: $out",
        )
    }

    @Test
    fun resolve_rewritesSrcsetEntriesStartingWithProxy() {
        val html = """<img srcset="/proxy/a/b 1x, /proxy/c/d 2x">"""
        assertEquals(
            """<img srcset="$base/proxy/a/b 1x, $base/proxy/c/d 2x">""",
            MinifluxProxyResolver.resolve(html, base),
        )
    }

    @Test
    fun resolve_doesNotTouchAbsoluteOrNonProxyUrls() {
        val html =
            """<img src="https://cdn.example.com/img.jpg"><img src="/other/path.jpg">"""
        assertEquals(html, MinifluxProxyResolver.resolve(html, base))
    }

    @Test
    fun resolve_stripsTrailingSlashesOnBaseUrl() {
        val html = """<img src="/proxy/a/b">"""
        assertEquals(
            """<img src="$base/proxy/a/b">""",
            MinifluxProxyResolver.resolve(html, "$base///"),
        )
    }

    @Test
    fun resolve_doesNotSplitSrcsetOnCommasInsideAUrl() {
        val html =
            """<img srcset="https://cdn.example.com/img/w_400,h_300,c_fill/img.jpg 2x">"""
        assertEquals(html, MinifluxProxyResolver.resolve(html, base))
    }

    @Test
    fun resolve_rewritesProxySrcsetEntryWithoutCorruptingUrlInternalCommas() {
        val html =
            """<img srcset="/proxy/a/b 1x, https://cdn.example.com/img/w_400,h_300/img.jpg 2x">"""
        assertEquals(
            """<img srcset="$base/proxy/a/b 1x, https://cdn.example.com/img/w_400,h_300/img.jpg 2x">""",
            MinifluxProxyResolver.resolve(html, base),
        )
    }

    // Miniflux servers with MEDIA_PROXY_MODE=all but BASE_URL unset emit
    // absolute proxy URLs anchored at `http://localhost/`. These reach the
    // WebView and ERR_CONNECTION_REFUSED unless we swap the host.
    @Test
    fun resolve_rewritesAbsoluteLocalhostProxySrcToConfiguredBase() {
        val html = """<img src="http://localhost/proxy/abc123/base64encoded">"""
        assertEquals(
            """<img src="$base/proxy/abc123/base64encoded">""",
            MinifluxProxyResolver.resolve(html, base),
        )
    }

    @Test
    fun resolve_rewritesAbsolute127ProxySrc() {
        val html = """<img src="http://127.0.0.1/proxy/abc/def">"""
        assertEquals(
            """<img src="$base/proxy/abc/def">""",
            MinifluxProxyResolver.resolve(html, base),
        )
    }

    @Test
    fun resolve_rewritesLocalhostProxyUrlsWithExplicitPort() {
        val html = """<img src="http://localhost:8080/proxy/h/u">"""
        assertEquals(
            """<img src="$base/proxy/h/u">""",
            MinifluxProxyResolver.resolve(html, base),
        )
    }

    @Test
    fun resolve_rewritesLocalhostProxyUrlsInSrcsetEntries() {
        val html =
            """<img srcset="http://localhost/proxy/a/b 1x, http://localhost/proxy/c/d 2x">"""
        assertEquals(
            """<img srcset="$base/proxy/a/b 1x, $base/proxy/c/d 2x">""",
            MinifluxProxyResolver.resolve(html, base),
        )
    }

    @Test
    fun resolve_doesNotRewriteAbsoluteProxyUrlsOnUnrelatedHosts() {
        val html = """<img src="https://other.example.com/proxy/abc/def">"""
        assertEquals(html, MinifluxProxyResolver.resolve(html, base))
    }

    // The Android client stores the API URL (`https://server/v1/`); strip the
    // /v1 segment so /proxy/... is rewritten at the application root.
    @Test
    fun resolve_acceptsApiBaseUrlWithV1Path() {
        val html = """<img src="/proxy/h/u">"""
        assertEquals(
            """<img src="$base/proxy/h/u">""",
            MinifluxProxyResolver.resolve(html, "$base/v1/"),
        )
    }

    @Test
    fun resolve_preservesPortInRewrittenOrigin() {
        val html = """<img src="/proxy/h/u">"""
        assertEquals(
            """<img src="https://miniflux.example.com:8443/proxy/h/u">""",
            MinifluxProxyResolver.resolve(html, "https://miniflux.example.com:8443/v1/"),
        )
    }

    // Miniflux can be deployed at a subpath via BASE_URL (e.g. BASE_URL=https://example.org/rss/).
    // The stored API URL is then `https://example.org/rss/v1/`, and proxy URLs live at
    // `https://example.org/rss/proxy/...` — not at the origin root.
    @Test
    fun resolve_preservesSubpathForSubfolderDeployment() {
        val html = """<img src="/proxy/h/u">"""
        assertEquals(
            """<img src="https://example.org/rss/proxy/h/u">""",
            MinifluxProxyResolver.resolve(html, "https://example.org/rss/v1/"),
        )
    }
}
