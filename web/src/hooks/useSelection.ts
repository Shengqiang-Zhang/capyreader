import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export type Scope =
  | { kind: "all" }
  | { kind: "starred" }
  | { kind: "category"; id: number }
  | { kind: "feed"; id: number };

export type StatusFilter = "unread" | "all";

export interface Selection {
  scope: Scope;
  status: StatusFilter;
  entryId: number | null;
  search: string | null;
}

function parseScope(
  sp: URLSearchParams,
): Scope {
  const starred = sp.get("starred");
  if (starred === "1") return { kind: "starred" };
  const feed = sp.get("feed");
  if (feed) {
    const id = Number(feed);
    if (Number.isFinite(id)) return { kind: "feed", id };
  }
  const category = sp.get("category");
  if (category) {
    const id = Number(category);
    if (Number.isFinite(id)) return { kind: "category", id };
  }
  return { kind: "all" };
}

export function useSelection() {
  const [sp, setSp] = useSearchParams();

  const selection: Selection = useMemo(() => {
    const scope = parseScope(sp);
    const status = (sp.get("status") as StatusFilter | null) ?? "unread";
    const entryParam = sp.get("entry");
    const entryId = entryParam ? Number(entryParam) : null;
    const search = sp.get("q");
    return {
      scope,
      status: status === "all" ? "all" : "unread",
      entryId: entryId && Number.isFinite(entryId) ? entryId : null,
      search: search && search.length > 0 ? search : null,
    };
  }, [sp]);

  const setScope = useCallback(
    (scope: Scope) => {
      setSp((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("feed");
        next.delete("category");
        next.delete("starred");
        next.delete("entry");
        if (scope.kind === "feed") next.set("feed", String(scope.id));
        if (scope.kind === "category") next.set("category", String(scope.id));
        if (scope.kind === "starred") next.set("starred", "1");
        return next;
      });
    },
    [setSp],
  );

  const setStatus = useCallback(
    (status: StatusFilter) => {
      setSp((prev) => {
        const next = new URLSearchParams(prev);
        if (status === "all") next.set("status", "all");
        else next.delete("status");
        return next;
      });
    },
    [setSp],
  );

  const setEntry = useCallback(
    (entryId: number | null) => {
      setSp((prev) => {
        const next = new URLSearchParams(prev);
        if (entryId === null) next.delete("entry");
        else next.set("entry", String(entryId));
        return next;
      });
    },
    [setSp],
  );

  const setSearch = useCallback(
    (query: string | null) => {
      setSp((prev) => {
        const next = new URLSearchParams(prev);
        if (!query) next.delete("q");
        else next.set("q", query);
        return next;
      });
    },
    [setSp],
  );

  return { selection, setScope, setStatus, setEntry, setSearch };
}
