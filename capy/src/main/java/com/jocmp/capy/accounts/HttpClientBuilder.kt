package com.jocmp.capy.accounts

import com.jocmp.capy.ClientCertManager
import com.jocmp.capy.UserAgentInterceptor
import okhttp3.Cache
import okhttp3.OkHttpClient
import java.io.File
import java.net.URI
import java.util.concurrent.TimeUnit

private const val TIMEOUT_SECONDS = 30L

fun baseHttpClient() = baseHttpClientBuilder().build()

private fun baseHttpClientBuilder(userAgent: String = UserAgentInterceptor.USER_AGENT) =
    OkHttpClient
        .Builder()
        .addInterceptor(UserAgentInterceptor(userAgent))
        .connectTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .readTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .writeTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)

fun httpClientBuilder(
    cachePath: URI,
    userAgent: String = UserAgentInterceptor.USER_AGENT,
) =
    baseHttpClientBuilder(userAgent)
        .cache(
            Cache(
                directory = File(File(cachePath), "http_cache"),
                maxSize = 50L * 1024L * 1024L // 50 MiB
            )
        )

fun OkHttpClient.Builder.clientCertAlias(
    clientCertManager: ClientCertManager,
    certAlias: String
): OkHttpClient.Builder {
    if (certAlias.isNotEmpty()) {
        return clientCertManager.configure(this, certAlias)
    }
    return this
}
