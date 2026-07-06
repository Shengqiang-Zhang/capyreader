package com.jocmp.capy

import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Test
import kotlin.test.assertEquals

class UserAgentInterceptorTest {
    private val browserUserAgent =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"

    @Test
    fun overridesUserAgentWithProvidedValue() {
        // Feeds behind CDNs/WAFs reject the default `okhttp/x.y.z` identifier; the
        // interceptor must replace it with the browser value we pass in.
        assertEquals(browserUserAgent, sentUserAgent(UserAgentInterceptor(browserUserAgent)))
    }

    @Test
    fun defaultsToCapyReaderIdentifier() {
        assertEquals(UserAgentInterceptor.USER_AGENT, sentUserAgent(UserAgentInterceptor()))
    }

    private fun sentUserAgent(interceptor: UserAgentInterceptor): String? {
        var captured: String? = null

        val client = OkHttpClient.Builder()
            .addInterceptor(interceptor)
            .addInterceptor(Interceptor { chain ->
                captured = chain.request().header("User-Agent")
                Response.Builder()
                    .request(chain.request())
                    .protocol(Protocol.HTTP_1_1)
                    .code(200)
                    .message("OK")
                    .body("".toResponseBody())
                    .build()
            })
            .build()

        client.newCall(Request.Builder().url("https://example.com/feed").build())
            .execute()
            .close()

        return captured
    }
}
