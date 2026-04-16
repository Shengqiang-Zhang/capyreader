package com.capyreader.app.common

import android.graphics.fonts.Font
import android.graphics.fonts.SystemFonts
import com.jocmp.capy.logging.CapyLog
import java.io.File

/**
 * Picks a sans-serif face from the device's system fonts so the article WebView
 * can render in the OEM's default system font (Samsung One UI on Samsung, Mi Sans
 * on MIUI, HarmonyOS Sans, OPPO Sans, etc). Chromium's `system-ui` keyword on
 * Android only reaches a fixed Roboto/Noto stack, so OEM-registered families need
 * to be served explicitly through `@font-face`.
 *
 * Custom user-selected fonts installed by OEM theme engines (e.g. Samsung Galaxy
 * Themes) are stored in private directories that our app process cannot read, so
 * this resolver cannot surface them. See the `CUSTOM` [FontOption] for an escape
 * hatch where the user can supply their own font file.
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
        "oneui",
        "samsung",
        "secsans",
        "seccjk",
        "sansation",
        "vivo",
        "bbk",
        "honor",
        "magicui",
        "nubia",
    )

    private val SCRIPT_HINTS = listOf(
        "cjk", "korean", "japanese", "chinese", "arabic", "hebrew",
        "devanagari", "thai", "tibetan", "myanmar", "khmer", "georgian",
        "armenian", "ethiopic", "kannada", "malayalam", "tamil", "telugu",
        "bengali", "gurmukhi", "gujarati", "sinhala", "cherokee",
    )

    private val STOCK_PREFIXES = listOf("roboto", "noto", "droid")
    private val SUPPORTED_EXTENSIONS = setOf("ttf", "otf", "ttc")

    val sansSerifFile: File? by lazy { resolveAndLog() }

    private fun resolveAndLog(): File? {
        val candidates = runCatching {
            SystemFonts.getAvailableFonts().filter { it.isViableSansSerif() }
        }.getOrDefault(emptyList())

        val chosen = resolveFont(candidates)

        if (chosen == null) {
            CapyLog.info(
                "system_font_unresolved",
                mapOf(
                    "candidates" to candidates.joinToString(",") { it.file?.name.orEmpty() },
                ),
            )
        } else {
            CapyLog.info(
                "system_font_resolved",
                mapOf(
                    "file" to chosen.file?.absolutePath.orEmpty(),
                    "locale" to chosen.localeList.toLanguageTags(),
                ),
            )
        }
        return chosen?.file
    }

    private fun resolveFont(candidates: List<Font>): Font? {
        val oem = candidates.filter { it.looksOEMBranded() }

        return oem.firstOrNull { !it.isScriptSpecific() }
            ?: oem.firstOrNull()
            ?: candidates.firstOrNull { it.isLikelyOEMLatin() }
            ?: candidates.firstOrNull { it.coversChinese() }
    }

    private fun Font.isViableSansSerif(): Boolean {
        val path = file ?: return false
        if (path.extension.lowercase() !in SUPPORTED_EXTENSIONS) return false
        return style.weight == WEIGHT_REGULAR && style.slant == SLANT_UPRIGHT
    }

    private fun Font.looksOEMBranded(): Boolean {
        val name = file?.name.orEmpty().lowercase()
        if (isNonTextFont()) return false
        return OEM_FILE_HINTS.any { name.contains(it) }
    }

    private fun Font.isNonTextFont(): Boolean {
        val name = file?.name.orEmpty().lowercase()
        return name.contains("emoji") || name.contains("symbol") || name.contains("color")
    }

    private fun Font.isScriptSpecific(): Boolean {
        val name = file?.name.orEmpty().lowercase()
        return SCRIPT_HINTS.any { name.contains(it) }
    }

    private fun Font.coversChinese(): Boolean {
        val tags = localeList.toLanguageTags().lowercase()
        return tags.contains("zh") || tags.contains("hans") || tags.contains("hant")
    }

    private fun Font.isLikelyOEMLatin(): Boolean {
        val name = file?.name.orEmpty().lowercase()
        if (STOCK_PREFIXES.any { name.startsWith(it) }) return false
        if (isScriptSpecific()) return false
        if (isNonTextFont()) return false
        if (name.contains("serif") && !name.contains("sans")) return false
        if (name.contains("mono")) return false
        return true
    }
}
