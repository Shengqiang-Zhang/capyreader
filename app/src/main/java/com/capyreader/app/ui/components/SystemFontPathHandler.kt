package com.capyreader.app.ui.components

import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import com.capyreader.app.common.SystemFontResolver
import java.io.File

class SystemFontPathHandler : WebViewAssetLoader.PathHandler {
    override fun handle(path: String): WebResourceResponse? {
        val file = SystemFontResolver.sansSerifFile
        if (file == null || !file.canRead()) {
            return notFound()
        }

        return WebResourceResponse(
            mimeTypeFor(file),
            null,
            file.inputStream(),
        )
    }

    private fun mimeTypeFor(file: File): String {
        return when (file.extension.lowercase()) {
            "otf" -> "font/otf"
            "ttc" -> "font/collection"
            else -> "font/ttf"
        }
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
