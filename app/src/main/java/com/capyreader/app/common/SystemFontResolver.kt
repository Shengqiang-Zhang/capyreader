package com.capyreader.app.common

import android.graphics.fonts.Font
import android.graphics.fonts.SystemFonts
import java.io.File

/**
 * Picks a CJK-capable sans-serif face from the device's system fonts so the article
 * WebView can render in the OEM's custom system font (Mi Sans on MIUI, HarmonyOS Sans,
 * OPPO Sans, etc). Chromium's `system-ui` keyword on Android only reaches a fixed
 * Roboto/Noto stack, so OEM-registered families need to be served explicitly through
 * `@font-face`.
 */
object SystemFontResolver {
    private const val WEIGHT_REGULAR = 400
    private const val SLANT_UPRIGHT = 0

    private val OEM_FILE_HINTS = listOf(
        "misans",
        "harmony",
        "oppo",
        "oplus",
        "oneplus",
        "samsung",
        "vivo",
        "bbk",
    )

    val sansSerifFile: File? by lazy {
        runCatching { resolveFont()?.file }.getOrNull()
    }

    private fun resolveFont(): Font? {
        val candidates = SystemFonts.getAvailableFonts()
            .filter { it.file != null && it.isRegularUpright() }

        return candidates.firstOrNull { it.looksOEMBranded() }
            ?: candidates.firstOrNull { it.coversChinese() }
    }

    private fun Font.isRegularUpright(): Boolean {
        return style.weight == WEIGHT_REGULAR && style.slant == SLANT_UPRIGHT
    }

    private fun Font.looksOEMBranded(): Boolean {
        val name = file?.name.orEmpty().lowercase()
        return OEM_FILE_HINTS.any { name.contains(it) }
    }

    private fun Font.coversChinese(): Boolean {
        val tags = localeList.toLanguageTags().lowercase()
        return tags.contains("zh") || tags.contains("hans") || tags.contains("hant")
    }
}
