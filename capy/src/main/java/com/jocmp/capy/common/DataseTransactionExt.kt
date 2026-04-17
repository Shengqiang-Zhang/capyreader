package com.jocmp.capy.common

import app.cash.sqldelight.TransactionWithoutReturn
import com.jocmp.capy.db.Database
import com.jocmp.capy.logging.CapyLog

fun Database.transactionWithErrorHandling(
    body: TransactionWithoutReturn.() -> Unit
): Result<Unit> {
    return try {
        transaction(noEnclosing = false, body)
        Result.success(Unit)
    } catch(e: Throwable) {
        CapyLog.error("db_error", e)
        Result.failure(e)
    }
}
