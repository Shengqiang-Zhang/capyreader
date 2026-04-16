package com.capyreader.app.common

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UpdateCheckerTest {
    @Test
    fun isNewer_returnsTrueWhenLatestTagIsHigher() {
        assertTrue(UpdateChecker.isNewer(currentVersion = "1.3", latestTag = "v2.0"))
        assertTrue(UpdateChecker.isNewer(currentVersion = "v1.3", latestTag = "v1.4"))
        assertTrue(UpdateChecker.isNewer(currentVersion = "2.0", latestTag = "v2.0.1"))
    }

    @Test
    fun isNewer_returnsFalseWhenSame() {
        assertFalse(UpdateChecker.isNewer(currentVersion = "2.0", latestTag = "v2.0"))
        assertFalse(UpdateChecker.isNewer(currentVersion = "v2.0", latestTag = "2.0"))
    }

    @Test
    fun isNewer_returnsFalseWhenCurrentIsHigher() {
        assertFalse(UpdateChecker.isNewer(currentVersion = "2.1", latestTag = "v2.0"))
        assertFalse(UpdateChecker.isNewer(currentVersion = "v2.0.1", latestTag = "v2.0"))
    }

    @Test
    fun isNewer_ignoresNonNumericSuffix() {
        assertFalse(UpdateChecker.isNewer(currentVersion = "2.0", latestTag = "v2.0-beta"))
    }
}
