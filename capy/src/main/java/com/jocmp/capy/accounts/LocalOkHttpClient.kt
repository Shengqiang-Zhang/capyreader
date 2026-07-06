package com.jocmp.capy.accounts

import com.jocmp.capy.UserAgentInterceptor
import okhttp3.Credentials
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.brotli.BrotliInterceptor
import java.net.URI

internal object LocalOkHttpClient {
    /**
     * The local account fetches feeds and article content directly from arbitrary
     * third-party sites, some of which sit behind CDNs/WAFs that reject non-browser
     * User-Agents (e.g. the default `okhttp/x.y.z`, or CapyReader's own identifier)
     * with an empty 403 body — which surfaces to the user as an unparseable feed.
     * Presenting the device's real browser User-Agent avoids that bot filtering.
     * Backend sync clients (Feedbin/Miniflux/Reader) keep the CapyReader identifier.
     */
    fun forAccount(path: URI, userAgent: String): OkHttpClient {
        return httpClientBuilder(
            cachePath = path,
            userAgent = userAgent.ifBlank { UserAgentInterceptor.USER_AGENT },
        )
            .addInterceptor(BrotliInterceptor)
            .addNetworkInterceptor(CacheInterceptor())
            .addInterceptor(LocalBasicAuthInterceptor())
            .build()
    }
}

class LocalBasicAuthInterceptor() : Interceptor {
    override fun intercept(chain: Interceptor.Chain): okhttp3.Response {
        val request = chain.request()
        val url = request.url

        if (url.username.isNotBlank() && url.password.isNotBlank()) {
            val basicAuth = Credentials.basic(url.username, url.password)

            val parsedURL = url.newBuilder()
                .username("")
                .password("")
                .build()

            val authenticatedRequest = request
                .newBuilder()
                .header("Authorization", basicAuth)
                .url(parsedURL)
                .build()

            return chain.proceed(authenticatedRequest)
        }

        return chain.proceed(request)
    }
}

// https://square.github.io/okhttp/features/interceptors/#rewriting-responses
class CacheInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val response = chain.proceed(chain.request())

        return response.newBuilder()
            .header("cache-control", "no-cache")
            .removeHeader("expires")
            .build()
    }
}
