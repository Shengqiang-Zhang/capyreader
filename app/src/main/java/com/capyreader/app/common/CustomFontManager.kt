package com.capyreader.app.common

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import com.jocmp.capy.logging.CapyLog
import java.io.File

/**
 * Stores a user-supplied font file in our app-private directory and makes it
 * available to the article WebView. The user picks a file via SAF; we copy its
 * contents into [FILE_NAME] so we don't depend on long-lived content-URI
 * permissions.
 */
object CustomFontManager {
    private const val FILE_NAME = "article-custom-font"
    private const val NAME_FILE = "article-custom-font-name"

    fun save(context: Context, uri: Uri): File? {
        return try {
            val dest = File(context.filesDir, FILE_NAME)
            context.contentResolver.openInputStream(uri).use { input ->
                if (input == null) return null
                dest.outputStream().use { output ->
                    input.copyTo(output)
                }
            }
            if (!dest.exists() || dest.length() == 0L) {
                dest.delete()
                return null
            }
            val displayName = resolveDisplayName(context, uri)
            File(context.filesDir, NAME_FILE).writeText(displayName.orEmpty())
            dest
        } catch (e: Exception) {
            CapyLog.error("custom_font_save", e)
            null
        }
    }

    fun getFile(context: Context): File? {
        val file = File(context.filesDir, FILE_NAME)
        return if (file.exists() && file.canRead() && file.length() > 0) file else null
    }

    fun getDisplayName(context: Context): String? {
        val file = File(context.filesDir, NAME_FILE)
        return if (file.exists()) file.readText().takeIf { it.isNotBlank() } else null
    }

    fun clear(context: Context) {
        File(context.filesDir, FILE_NAME).delete()
        File(context.filesDir, NAME_FILE).delete()
    }

    private fun resolveDisplayName(context: Context, uri: Uri): String? {
        return context.contentResolver.query(
            uri,
            arrayOf(OpenableColumns.DISPLAY_NAME),
            null,
            null,
            null,
        )?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        }
    }
}
