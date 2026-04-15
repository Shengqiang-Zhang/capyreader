package com.capyreader.app.ui.components

import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import com.capyreader.app.common.SystemFontResolver

class SystemFontPathHandler : WebViewAssetLoader.PathHandler {
    override fun handle(path: String): WebResourceResponse? {
        val file = SystemFontResolver.sansSerifFile
        if (file == null || !file.canRead()) {
            return notFound()
        }

        return WebResourceResponse(
            "font/ttf",
            null,
            file.inputStream(),
        )
    }

    private fun notFound(): WebResourceResponse {
        return WebResourceResponse(
            "text/plain",
            null,
            404,
            "Not Found",
            emptyMap(),
            null,
        )
    }
}
