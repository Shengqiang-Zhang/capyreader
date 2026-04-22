import { useEffect, useRef } from "react";
import { useUpdateEntryStatus } from "@/api/mutations";
import type { Entry } from "@/api/types";

const AUTO_MARK_DELAY_MS = 500;

export function useAutoMarkRead(entry: Entry | undefined) {
  const mutation = useUpdateEntryStatus();
  const entryRef = useRef(entry);
  entryRef.current = entry;

  // Only re-run when the entry identity changes. Status changes within the
  // same entry (e.g. the user manually toggling "Unread" on an already-read
  // article) must not re-arm the timer, or the auto-mark would immediately
  // flip the optimistic "unread" state back to "read".
  useEffect(() => {
    const current = entryRef.current;
    if (!current || current.status !== "unread") return;
    const id = current.id;
    const timer = window.setTimeout(() => {
      mutation.mutate({ entryId: id, status: "read" });
    }, AUTO_MARK_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id]);
}
