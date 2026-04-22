import { useEffect } from "react";
import { useUpdateEntryStatus } from "@/api/mutations";
import type { Entry } from "@/api/types";

const AUTO_MARK_DELAY_MS = 500;

export function useAutoMarkRead(entry: Entry | undefined) {
  const mutation = useUpdateEntryStatus();

  useEffect(() => {
    if (!entry || entry.status !== "unread") return;
    const id = entry.id;
    const timer = window.setTimeout(() => {
      mutation.mutate({ entryId: id, status: "read" });
    }, AUTO_MARK_DELAY_MS);
    return () => window.clearTimeout(timer);
    // Intentionally only re-run when the selected entry identity changes —
    // mutation re-creations must not re-trigger the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id, entry?.status]);
}
