package com.capyreader.app.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.toFontFamily
import com.capyreader.app.R
import com.capyreader.app.common.CustomFontManager
import com.jocmp.capy.articles.FontOption

@Composable
fun rememberAppFontFamily(fontOption: FontOption): FontFamily? {
    val context = LocalContext.current
    val customFontPath = remember(fontOption) {
        if (fontOption == FontOption.CUSTOM) {
            CustomFontManager.getFile(context)?.absolutePath
        } else {
            null
        }
    }

    return remember(fontOption, customFontPath) {
        when (fontOption) {
            FontOption.SYSTEM_DEFAULT, FontOption.SYSTEM_UI -> null
            FontOption.CUSTOM -> customFontPath
                ?.let { java.io.File(it) }
                ?.let { Font(it).toFontFamily() }
            FontOption.ATKINSON_HYPERLEGIBLE -> Font(resId = R.font.atkinson_hyperlegible).toFontFamily()
            FontOption.INTER -> Font(resId = R.font.inter).toFontFamily()
            FontOption.JOST -> Font(resId = R.font.jost).toFontFamily()
            FontOption.LITERATA -> Font(resId = R.font.literata).toFontFamily()
            FontOption.POPPINS -> Font(resId = R.font.poppins).toFontFamily()
            FontOption.VOLLKORN -> Font(resId = R.font.vollkorn).toFontFamily()
        }
    }
}
