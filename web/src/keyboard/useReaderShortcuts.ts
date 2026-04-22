import { useMemo } from "react";
import type { Entry } from "@/api/types";
import { useToggleBookmark, useUpdateEntryStatus } from "@/api/mutations";
import { useSelection } from "@/hooks/useSelection";
import {
  useKeyboardShortcuts,
  type ShortcutBinding,
} from "@/keyboard/shortcuts";

interface ReaderShortcutOptions {
  entries: Entry[] | undefined;
  onShowHelp: () => void;
  onFocusSearch: () => void;
}

export function useReaderShortcuts({
  entries,
  onShowHelp,
  onFocusSearch,
}: ReaderShortcutOptions): ShortcutBinding[] {
  const { selection, setScope, setStatus, setEntry } = useSelection();
  const updateStatus = useUpdateEntryStatus();
  const toggleBookmark = useToggleBookmark();

  const bindings = useMemo<ShortcutBinding[]>(() => {
    const currentIndex =
      entries && selection.entryId !== null
        ? entries.findIndex((e) => e.id === selection.entryId)
        : -1;
    const current =
      entries && currentIndex >= 0 ? entries[currentIndex] : undefined;

    function move(delta: 1 | -1) {
      if (!entries || entries.length === 0) return;
      let target: Entry | undefined;
      if (currentIndex < 0) {
        target = entries[delta > 0 ? 0 : entries.length - 1];
      } else {
        const nextIndex = currentIndex + delta;
        target = entries[nextIndex];
      }
      if (target) setEntry(target.id);
    }

    return [
      {
        sequence: "j",
        description: "Next article",
        group: "Navigation",
        handler: () => move(1),
      },
      {
        sequence: "k",
        description: "Previous article",
        group: "Navigation",
        handler: () => move(-1),
      },
      {
        sequence: "m",
        description: "Toggle read / unread",
        group: "Article",
        handler: () => {
          if (!current) return;
          updateStatus.mutate({
            entryId: current.id,
            status: current.status === "unread" ? "read" : "unread",
          });
        },
      },
      {
        sequence: "s",
        description: "Toggle star",
        group: "Article",
        handler: () => {
          if (!current) return;
          toggleBookmark.mutate({
            entryId: current.id,
            currentStarred: current.starred,
          });
        },
      },
      {
        sequence: "o",
        description: "Open original in new tab",
        group: "Article",
        handler: () => {
          if (!current) return;
          window.open(current.url, "_blank", "noopener,noreferrer");
        },
      },
      {
        sequence: "u",
        description: "Clear article selection",
        group: "Navigation",
        handler: () => setEntry(null),
      },
      {
        sequence: "g i",
        description: "Go to Inbox (all articles)",
        group: "Navigation",
        handler: () => setScope({ kind: "all" }),
      },
      {
        sequence: "g s",
        description: "Go to Starred",
        group: "Navigation",
        handler: () => setScope({ kind: "starred" }),
      },
      {
        sequence: "g u",
        description: "Filter: unread",
        group: "Filter",
        handler: () => setStatus("unread"),
      },
      {
        sequence: "g a",
        description: "Filter: all",
        group: "Filter",
        handler: () => setStatus("all"),
      },
      {
        sequence: "/",
        description: "Focus search",
        group: "Search",
        handler: onFocusSearch,
      },
      {
        sequence: "?",
        description: "Show keyboard shortcuts",
        group: "Help",
        handler: onShowHelp,
      },
    ];
  }, [
    entries,
    selection.entryId,
    setEntry,
    setScope,
    setStatus,
    updateStatus,
    toggleBookmark,
    onFocusSearch,
    onShowHelp,
  ]);

  useKeyboardShortcuts(bindings);

  return bindings;
}
