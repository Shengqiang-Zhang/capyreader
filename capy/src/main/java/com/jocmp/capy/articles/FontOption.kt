package com.jocmp.capy.articles

enum class FontOption {
    SYSTEM_DEFAULT,
    SYSTEM_UI,
    CUSTOM,
    ATKINSON_HYPERLEGIBLE,
    INTER,
    JOST,
    LITERATA,
    POPPINS,
    VOLLKORN;

    val slug: String
        get() = when(this) {
            SYSTEM_DEFAULT -> "default"
            SYSTEM_UI -> "system_ui"
            CUSTOM -> "custom"
            ATKINSON_HYPERLEGIBLE -> "atkinson_hyperlegible"
            INTER -> "inter"
            JOST -> "jost"
            LITERATA -> "literata"
            POPPINS -> "poppins"
            VOLLKORN -> "vollkorn"
        }

    val hasBundledFont: Boolean
        get() = when (this) {
            SYSTEM_DEFAULT, SYSTEM_UI, CUSTOM -> false
            else -> true
        }

    companion object {
        val default = SYSTEM_DEFAULT
    }
}
