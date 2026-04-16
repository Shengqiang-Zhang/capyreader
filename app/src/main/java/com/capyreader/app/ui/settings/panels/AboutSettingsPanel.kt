package com.capyreader.app.ui.settings.panels

import android.content.ClipData
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.rounded.BugReport
import androidx.compose.material.icons.rounded.SystemUpdate
import androidx.compose.material.icons.rounded.VolunteerActivism
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import com.capyreader.app.BuildConfig.VERSION_NAME
import com.capyreader.app.R
import com.capyreader.app.common.UpdateCheckResult
import com.capyreader.app.common.UpdateChecker
import com.capyreader.app.ui.LocalLinkOpener
import com.capyreader.app.ui.components.FormSection
import com.capyreader.app.ui.components.LocalSnackbarHost
import com.capyreader.app.ui.fixtures.PreviewKoinApplication
import com.capyreader.app.ui.theme.CapyTheme
import kotlinx.coroutines.launch
import org.koin.compose.koinInject

@Composable
fun AboutSettingsPanel(updateChecker: UpdateChecker = koinInject()) {
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    val snackbar = LocalSnackbarHost.current
    val linkOpener = LocalLinkOpener.current
    val displayedVersion = "v$VERSION_NAME"
    var isChecking by remember { mutableStateOf(false) }

    val copyVersionToClipboard = {
        scope.launch {
            clipboard.setClipEntry(
                ClipEntry(ClipData.newPlainText("", "Capy Reader $displayedVersion"))
            )
        }
    }

    val checkingMessage = stringResource(R.string.settings_check_for_updates_checking)
    val upToDateMessage = stringResource(R.string.settings_check_for_updates_up_to_date)
    val failureMessage = stringResource(R.string.settings_check_for_updates_failure)

    val checkForUpdates = {
        if (!isChecking) {
            isChecking = true
            scope.launch {
                val checkingJob = launch { snackbar.showSnackbar(checkingMessage) }
                val result = updateChecker.check(VERSION_NAME)
                checkingJob.cancel()
                snackbar.currentSnackbarData?.dismiss()
                isChecking = false
                when (result) {
                    is UpdateCheckResult.UpdateAvailable ->
                        linkOpener.open(result.releaseUrl.toUri())
                    UpdateCheckResult.UpToDate ->
                        snackbar.showSnackbar(upToDateMessage)
                    UpdateCheckResult.Failure ->
                        snackbar.showSnackbar(failureMessage)
                }
            }
        }
    }

    Column(
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.verticalScroll(rememberScrollState()),
    ) {
        Column {
            Box(
                modifier = Modifier.clickable {
                    linkOpener.open(Support.URL.toUri())
                }
            ) {
                ListItem(
                    leadingContent = { Icon(Icons.Rounded.BugReport, contentDescription = null) },
                    headlineContent = { Text(stringResource(R.string.settings_support_button)) }
                )
            }
            Box(
                modifier = Modifier.clickable {
                    linkOpener.open(Support.DONATE_URL.toUri())
                }
            ) {
                ListItem(
                    leadingContent = {
                        Icon(
                            Icons.Rounded.VolunteerActivism,
                            contentDescription = null
                        )
                    },
                    headlineContent = { Text(stringResource(R.string.settings_donate_button)) }
                )
            }
            Box(
                modifier = Modifier.clickable(enabled = !isChecking) {
                    checkForUpdates()
                }
            ) {
                ListItem(
                    leadingContent = {
                        Icon(Icons.Rounded.SystemUpdate, contentDescription = null)
                    },
                    headlineContent = {
                        Text(stringResource(R.string.settings_check_for_updates))
                    }
                )
            }
        }

        FormSection(title = stringResource(R.string.settings_section_version)) {
            Row(
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        copyVersionToClipboard()
                    }
            ) {
                Text(
                    text = displayedVersion,
                    modifier = Modifier
                        .padding(16.dp)
                )
                Icon(
                    imageVector = Icons.Filled.ContentCopy,
                    contentDescription = stringResource(
                        R.string.settings_option_copy_version
                    ),
                    modifier = Modifier
                        .padding(end = 16.dp)
                )
            }
        }
        HorizontalDivider()
        FormSection {
            Box(Modifier.padding(horizontal = 4.dp)) {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                    TextButton(onClick = { linkOpener.open(Support.ABOUT_URL.toUri()) }) {
                        Text(
                            text = "Made with ♥ in ✶✶✶✶",
                        )
                    }
                }
            }
        }
        Spacer(Modifier.height(16.dp))
    }
}

private object Support {
    const val DONATE_URL = "https://capyreader.com/donate"

    const val URL = "https://capyreader.com/support"

    const val ABOUT_URL = "https://jocmp.com"
}

@Preview
@Composable
private fun AboutSettingsPanelPreview() {
    PreviewKoinApplication {
        CapyTheme {
            AboutSettingsPanel()
        }
    }
}
