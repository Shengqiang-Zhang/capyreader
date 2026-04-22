import { forwardRef, useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { useSelection } from "@/hooks/useSelection";

export const SearchBar = forwardRef<HTMLInputElement>(function SearchBar(
  _,
  ref,
) {
  const { selection, setSearch } = useSelection();
  const [draft, setDraft] = useState(selection.search ?? "");

  useEffect(() => {
    setDraft(selection.search ?? "");
  }, [selection.search]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = draft.trim();
      const current = selection.search ?? "";
      if (next !== current) {
        setSearch(next.length > 0 ? next : null);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [draft, selection.search, setSearch]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={ref}
        type="search"
        placeholder="Search articles…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="h-9 pl-8 pr-8"
      />
      {draft.length > 0 && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setDraft("")}
          className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
});
