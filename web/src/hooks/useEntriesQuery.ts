import { useEntries } from "@/api/queries";
import type { EntriesQuery } from "@/api/types";
import type { Selection } from "@/hooks/useSelection";

const PAGE_SIZE = 100;

export function buildEntriesQuery(selection: Selection): EntriesQuery {
  const base: EntriesQuery = {
    limit: PAGE_SIZE,
    order: "published_at",
    direction: "desc",
  };

  if (selection.search) base.search = selection.search;
  if (selection.status === "unread") base.status = "unread";

  switch (selection.scope.kind) {
    case "starred":
      base.starred = true;
      break;
    case "feed":
      base.feed_id = selection.scope.id;
      break;
    case "category":
      base.category_id = selection.scope.id;
      break;
  }

  return base;
}

export function useEntriesForSelection(selection: Selection) {
  return useEntries(buildEntriesQuery(selection));
}
