package com.capyreader.app.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontFamily
import androidx.core.view.WindowCompat
import com.capyreader.app.preferences.AppPreferences
import com.capyreader.app.preferences.AppTheme
import com.capyreader.app.preferences.ThemeMode
import com.jocmp.capy.articles.FontOption
import com.capyreader.app.ui.EdgeToEdgeHelper.isEdgeToEdgeAvailable
import com.capyreader.app.ui.collectChangesWithCurrent
import com.capyreader.app.ui.theme.colorschemes.BaseColorScheme
import com.capyreader.app.ui.theme.colorschemes.MonochromeColorScheme
import com.capyreader.app.ui.theme.colorschemes.NewsprintColorScheme
import com.capyreader.app.ui.theme.colorschemes.SunsetColorScheme
import com.capyreader.app.ui.theme.colorschemes.TachiyomiColorScheme
import com.capyreader.app.ui.theme.colorschemes.applyPureBlack

data class AppThemeState(
    val value: AppTheme = AppTheme.DEFAULT,
    val isDark: Boolean = false,
)

val LocalAppTheme = staticCompositionLocalOf { AppThemeState() }

@Composable
fun CapyTheme(
    appTheme: AppTheme = AppTheme.DEFAULT,
    themeMode: ThemeMode = ThemeMode.default,
    pureBlack: Boolean = false,
    preview: Boolean = false,
    fontFamily: FontFamily? = null,
    content: @Composable () -> Unit,
) {
    val isDark = when (themeMode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }

    val colorScheme = getThemeColorScheme(
        appTheme = appTheme,
        isDark = isDark,
        pureBlack = pureBlack,
    )
    val view = LocalView.current

    if (!(preview || view.isInEditMode)) {
        StatusBarColorListener(colorScheme, themeMode, pureBlack)
    }

    val typography = remember(fontFamily) {
        fontFamily?.let { buildTypographyWithFontFamily(it) } ?: Typography()
    }

    CompositionLocalProvider(LocalAppTheme provides AppThemeState(appTheme, isDark)) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = typography,
            content = content,
        )
    }
}

@Composable
fun CapyTheme(
    appPreferences: AppPreferences,
    content: @Composable () -> Unit,
) {
    val themeMode by appPreferences.themeMode.collectChangesWithCurrent()
    val appTheme by appPreferences.appTheme.collectChangesWithCurrent()
    val pureBlack by appPreferences.pureBlackDarkMode.collectChangesWithCurrent()
    val applyArticleFontToApp by appPreferences.applyArticleFontToApp.collectChangesWithCurrent()
    val articleFontOption by appPreferences.readerOptions.fontFamily.collectChangesWithCurrent()

    val fontOption = if (applyArticleFontToApp) articleFontOption else FontOption.SYSTEM_DEFAULT
    val fontFamily = rememberAppFontFamily(fontOption)

    CapyTheme(
        appTheme = appTheme,
        themeMode = themeMode,
        pureBlack = pureBlack,
        fontFamily = fontFamily,
        content = content,
    )
}

private fun buildTypographyWithFontFamily(fontFamily: FontFamily): Typography {
    val base = Typography()
    return Typography(
        displayLarge = base.displayLarge.copy(fontFamily = fontFamily),
        displayMedium = base.displayMedium.copy(fontFamily = fontFamily),
        displaySmall = base.displaySmall.copy(fontFamily = fontFamily),
        headlineLarge = base.headlineLarge.copy(fontFamily = fontFamily),
        headlineMedium = base.headlineMedium.copy(fontFamily = fontFamily),
        headlineSmall = base.headlineSmall.copy(fontFamily = fontFamily),
        titleLarge = base.titleLarge.copy(fontFamily = fontFamily),
        titleMedium = base.titleMedium.copy(fontFamily = fontFamily),
        titleSmall = base.titleSmall.copy(fontFamily = fontFamily),
        bodyLarge = base.bodyLarge.copy(fontFamily = fontFamily),
        bodyMedium = base.bodyMedium.copy(fontFamily = fontFamily),
        bodySmall = base.bodySmall.copy(fontFamily = fontFamily),
        labelLarge = base.labelLarge.copy(fontFamily = fontFamily),
        labelMedium = base.labelMedium.copy(fontFamily = fontFamily),
        labelSmall = base.labelSmall.copy(fontFamily = fontFamily),
    )
}

@Composable
@ReadOnlyComposable
private fun getThemeColorScheme(
    appTheme: AppTheme,
    isDark: Boolean,
    pureBlack: Boolean,
): ColorScheme {
    val theme = appTheme.normalized()

    return if (theme == AppTheme.MONET && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        if (isDark) {
            dynamicDarkColorScheme(LocalContext.current)
                .applyPureBlack(pureBlack)
        } else {
            dynamicLightColorScheme(LocalContext.current)
        }
    } else {
        colorSchemes
            .getOrDefault(theme, TachiyomiColorScheme)
            .getColorScheme(
                isDark = isDark,
                pureBlack,
            )
    }
}

private val colorSchemes: Map<AppTheme, BaseColorScheme> = mapOf(
    AppTheme.DEFAULT to TachiyomiColorScheme,
    AppTheme.SUNSET to SunsetColorScheme,
    AppTheme.MONOCHROME to MonochromeColorScheme,
    AppTheme.NEWSPRINT to NewsprintColorScheme,
)

@Composable
fun ThemeMode.showAppearanceLightStatusBars(): Boolean {
    return !(this == ThemeMode.DARK ||
            this == ThemeMode.SYSTEM && isSystemInDarkTheme())
}

@Composable
fun StatusBarColorListener(colorScheme: ColorScheme, themeMode: ThemeMode, pureBlack: Boolean) {
    val view = LocalView.current

    val isAppearanceLightStatusBars = themeMode.showAppearanceLightStatusBars()

    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window

            if (!isEdgeToEdgeAvailable()) {
                window.statusBarColor =
                    findStatusBarColor(colorScheme, pureBlack, isAppearanceLightStatusBars)
                        .toArgb()
            }

            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars =
                isAppearanceLightStatusBars
        }
    }
}

fun findStatusBarColor(
    colorScheme: ColorScheme,
    pureBlack: Boolean,
    isLightStatusBar: Boolean
): Color {
    return if (isLightStatusBar || !pureBlack) {
        colorScheme.surface
    } else {
        Color.Black
    }
}
