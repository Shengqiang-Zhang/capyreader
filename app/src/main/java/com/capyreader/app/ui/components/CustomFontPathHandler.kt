package com.capyreader.app.ui.components

import android.content.Context
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import com.capyreader.app.common.CustomFontManager
import java.io.File

class CustomFontPathHandler(private val context: Context) : WebViewAssetLoader.PathHandler {
    override fun handle(path: String): WebResourceResponse? {
        val file = CustomFontManager.getFile(context) ?: return notFound()
        return WebResourceResponse(
            mimeTypeFor(file),
            null,
            file.inputStream(),
        )
    }

    private fun mimeTypeFor(file: File): String {
        return runCatching {
            file.inputStream().use { stream ->
                val header = ByteArray(4)
                val read = stream.read(header)
                if (read < 4) return "font/ttf"
                when {
                    header[0] == 0x4F.toByte() && header[1] == 0x54.toByte() &&
                        header[2] == 0x54.toByte() && header[3] == 0x4F.toByte() -> "font/otf"
                    header[0] == 0x74.toByte() && header[1] == 0x74.toByte() &&
                        header[2] == 0x63.toByte() && header[3] == 0x66.toByte() -> "font/collection"
                    else -> "font/ttf"
                }
            }
        }.getOrDefault("font/ttf")
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
