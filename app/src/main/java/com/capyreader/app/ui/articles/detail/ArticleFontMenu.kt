package com.capyreader.app.ui.articles.detail

import android.content.Context
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts.OpenDocument
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType.Companion.PrimaryNotEditable
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.font.toFontFamily
import androidx.compose.ui.unit.sp
import com.capyreader.app.R
import com.capyreader.app.common.CustomFontManager
import com.jocmp.capy.articles.FontOption

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArticleFontMenu(
    updateFontFamily: (fontOption: FontOption) -> Unit,
    fontOption: FontOption,
) {
    val context = LocalContext.current
    val (expanded, setExpanded) = remember { mutableStateOf(false) }
    var customFontName by remember { mutableStateOf(CustomFontManager.getDisplayName(context)) }

    val picker = rememberLauncherForActivityResult(OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val saved = CustomFontManager.save(context, uri)
        if (saved == null) {
            Toast.makeText(
                context,
                context.getString(R.string.font_option_custom_pick_error),
                Toast.LENGTH_SHORT,
            ).show()
            return@rememberLauncherForActivityResult
        }
        customFontName = CustomFontManager.getDisplayName(context)
        updateFontFamily(FontOption.CUSTOM)
    }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { setExpanded(it) },
    ) {
        OutlinedTextField(
            modifier = Modifier
                .menuAnchor(PrimaryNotEditable)
                .fillMaxWidth(),
            readOnly = true,
            value = context.fontOptionLabel(fontOption, customFontName),
            onValueChange = {},
            label = { Text(stringResource(R.string.article_font_menu_label)) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors(),
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { setExpanded(false) }
        ) {
            FontOption.entries.forEach { option ->
                DropdownMenuItem(
                    text = {
                        Text(
                            text = context.fontOptionLabel(option, customFontName),
                            fontFamily = findFont(option),
                            fontWeight = FontWeight.Normal,
                            fontSize = 16.sp
                        )
                    },
                    onClick = {
                        setExpanded(false)
                        if (option == FontOption.CUSTOM) {
                            picker.launch(arrayOf("*/*"))
                        } else {
                            updateFontFamily(option)
                        }
                    }
                )
            }
        }
    }
}

private fun Context.fontOptionLabel(option: FontOption, customFontName: String?): String {
    if (option == FontOption.CUSTOM && !customFontName.isNullOrBlank()) {
        return getString(R.string.font_option_custom_with_name, customFontName)
    }
    return translationKey(option)
}

private fun Context.translationKey(option: FontOption): String {
    return when (option) {
        FontOption.SYSTEM_DEFAULT -> getString(R.string.font_option_system_default)
        FontOption.SYSTEM_UI -> getString(R.string.font_option_system_ui)
        FontOption.CUSTOM -> getString(R.string.font_option_custom)
        FontOption.ATKINSON_HYPERLEGIBLE -> getString(R.string.font_option_atkinson_hyperlegible)
        FontOption.INTER -> getString(R.string.font_option_inter)
        FontOption.JOST -> getString(R.string.font_option_jost)
        FontOption.LITERATA -> getString(R.string.font_option_literata)
        FontOption.POPPINS -> getString(R.string.font_option_poppins)
        FontOption.VOLLKORN -> getString(R.string.font_option_vollkorn)
    }
}

private fun findFont(fontOption: FontOption) = when (fontOption) {
    FontOption.SYSTEM_DEFAULT, FontOption.SYSTEM_UI, FontOption.CUSTOM -> null
    FontOption.ATKINSON_HYPERLEGIBLE -> Font(resId = R.font.atkinson_hyperlegible)
    FontOption.INTER -> Font(resId = R.font.inter)
    FontOption.JOST -> Font(resId = R.font.jost)
    FontOption.LITERATA -> Font(resId = R.font.literata)
    FontOption.POPPINS -> Font(resId = R.font.poppins)
    FontOption.VOLLKORN -> Font(resId = R.font.vollkorn)
}?.toFontFamily()
