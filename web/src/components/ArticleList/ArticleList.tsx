import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2, Star } from "lucide-react";
import type { Entry } from "@/api/types";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/time";

interface ArticleListProps {
  entries: Entry[] | undefined;
  selectedEntryId: number | null;
  onSelect: (entry: Entry) => void;
  isLoading: boolean;
  isError: boolean;
  emptyLabel?: string;
}

export default function ArticleList({
  entries,
  selectedEntryId,
  onSelect,
  isLoading,
  isError,
  emptyLabel = "No articles.",
}: ArticleListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: entries?.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92,
    overscan: 8,
  });

  useEffect(() => {
    if (selectedEntryId === null || !entries) return;
    const idx = entries.findIndex((e) => e.id === selectedEntryId);
    if (idx >= 0) rowVirtualizer.scrollToIndex(idx, { align: "auto" });
  }, [selectedEntryId, entries, rowVirtualizer]);

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-destructive">
        Failed to load articles.
      </div>
    );
  }

  if (isLoading && (!entries || entries.length === 0)) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading articles…
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-y-auto">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const entry = entries[virtualRow.index];
          return (
            <div
              key={entry.id}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <ArticleRow
                entry={entry}
                selected={selectedEntryId === entry.id}
                onClick={() => onSelect(entry)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ArticleRowProps {
  entry: Entry;
  selected: boolean;
  onClick: () => void;
}

function ArticleRow({ entry, selected, onClick }: ArticleRowProps) {
  const unread = entry.status === "unread";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full flex-col gap-1 border-b px-5 py-3 text-left transition-colors",
        selected
          ? "bg-accent/80"
          : "hover:bg-accent/40",
      )}
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        {unread && (
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-primary"
          />
        )}
        <span className="truncate font-medium">{entry.feed.title}</span>
        <span className="ml-auto flex-shrink-0">
          {relativeTime(entry.published_at)}
        </span>
      </div>
      <div
        className={cn(
          "line-clamp-2 text-sm leading-snug",
          unread ? "font-semibold text-foreground" : "text-foreground/70",
        )}
      >
        {entry.title}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {entry.starred && (
          <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
        )}
        {entry.reading_time > 0 && <span>{entry.reading_time} min read</span>}
      </div>
    </button>
  );
}
