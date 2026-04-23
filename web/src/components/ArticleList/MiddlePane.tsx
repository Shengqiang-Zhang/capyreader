import { Loader2, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { minifluxApi } from "@/api/miniflux";
import { useEntriesForSelection } from "@/hooks/useEntriesQuery";
import { useSelection } from "@/hooks/useSelection";
import { useFeeds, useCategories } from "@/api/queries";
import { useMarkEntriesAsRead } from "@/api/mutations";
import { Button } from "@/components/ui/Button";
import ArticleList from "@/components/ArticleList/ArticleList";
import { cn } from "@/lib/cn";
import { useState } from "react";

export default function MiddlePane() {
  const { credentials } = useAuth();
  const queryClient = useQueryClient();
  const { selection, setStatus, setEntry } = useSelection();
  const entriesQ = useEntriesForSelection(selection);
  const feedsQ = useFeeds();
  const categoriesQ = useCategories();
  const markEntriesAsRead = useMarkEntriesAsRead();
  const [refreshing, setRefreshing] = useState(false);

  const headline = (() => {
    if (selection.search) return `Search: "${selection.search}"`;
    const scope = selection.scope;
    switch (scope.kind) {
      case "all":
        return "All articles";
      case "starred":
        return "Starred";
      case "feed": {
        const feedId = scope.id;
        const feed = feedsQ.data?.find((f) => f.id === feedId);
        return feed?.title ?? "Feed";
      }
      case "category": {
        const categoryId = scope.id;
        const category = categoriesQ.data?.find((c) => c.id === categoryId);
        return category?.title ?? "Category";
      }
    }
  })();

  async function handleRefresh() {
    if (!credentials) return;
    setRefreshing(true);
    try {
      // Invalidate first so any cross-device state changes (e.g., a
      // mark-read from Android) surface within a network round-trip.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["entries"] }),
        queryClient.invalidateQueries({ queryKey: ["counters"] }),
        queryClient.invalidateQueries({ queryKey: ["feeds"] }),
      ]);
      // Then ask Miniflux to re-poll upstream feeds in the background.
      // We don't await this — it can take 30s+ on a large feed list and
      // its results trickle in via the next poll cycle anyway.
      minifluxApi.refreshAllFeeds(credentials).catch(() => {
        // Ignore; periodic poller on the server will catch up.
      });
    } finally {
      setRefreshing(false);
    }
  }

  const total = entriesQ.data?.total ?? 0;

  return (
    <section className="flex h-full flex-col">
      <header className="flex flex-col gap-2 border-b px-5 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold tracking-tight">
            {headline}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh feeds"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <FilterToggle
            active={selection.status === "unread"}
            onClick={() => setStatus("unread")}
          >
            Unread
          </FilterToggle>
          <FilterToggle
            active={selection.status === "all"}
            onClick={() => setStatus("all")}
          >
            All
          </FilterToggle>
          <span className="ml-auto text-muted-foreground">
            {entriesQ.data ? `${total} articles` : ""}
          </span>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <ArticleList
          entries={entriesQ.data?.entries}
          selectedEntryId={selection.entryId}
          onSelect={(entry) => setEntry(entry.id)}
          onMarkAboveAsRead={(entryIds) => {
            if (entryIds.length === 0) return;
            markEntriesAsRead.mutate({ entryIds });
          }}
          isLoading={entriesQ.isLoading}
          isError={entriesQ.isError}
          emptyLabel={
            selection.status === "unread"
              ? "Inbox zero. Nothing unread here."
              : "No articles match this view."
          }
        />
      </div>
    </section>
  );
}

interface FilterToggleProps {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FilterToggle({ active, onClick, children }: FilterToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2 py-1 font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
