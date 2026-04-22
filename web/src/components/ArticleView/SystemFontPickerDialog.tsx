import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

interface FontData {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
}

declare global {
  interface Window {
    queryLocalFonts?: (options?: {
      postscriptNames?: string[];
    }) => Promise<FontData[]>;
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (family: string) => void;
  title: string;
}

type LoadState =
  | { status: "idle" }
  | { status: "unsupported" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; families: string[] };

export default function SystemFontPickerDialog({
  open,
  onClose,
  onSelect,
  title,
}: Props) {
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!open) return;
    setFilter("");
    if (typeof window === "undefined" || !window.queryLocalFonts) {
      setState({ status: "unsupported" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    window
      .queryLocalFonts()
      .then((fonts) => {
        if (cancelled) return;
        const families = Array.from(new Set(fonts.map((f) => f.family)))
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
        setState({ status: "ready", families });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Could not read local fonts";
        setState({ status: "error", message });
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filtered = useMemo(() => {
    if (state.status !== "ready") return [];
    const q = filter.trim().toLowerCase();
    if (!q) return state.families;
    return state.families.filter((f) => f.toLowerCase().includes(q));
  }, [state, filter]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description="Pick any font installed on this device. The app asks for permission the first time."
      className="max-w-md"
    >
      {state.status === "unsupported" && (
        <UnsupportedNotice />
      )}
      {state.status === "loading" && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Reading installed fonts…
        </p>
      )}
      {state.status === "error" && (
        <p className="py-6 text-center text-sm text-destructive">
          {state.message}. You can still type a font name manually.
        </p>
      )}
      {state.status === "ready" && (
        <div className="flex flex-col gap-3">
          <Input
            autoFocus
            placeholder="Filter fonts…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div className="max-h-80 overflow-y-auto rounded-md border">
            {filtered.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">
                No fonts match “{filter}”.
              </p>
            ) : (
              <ul className="divide-y">
                {filtered.map((family) => (
                  <li key={family}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(family);
                        onClose();
                      }}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                      )}
                      style={{ fontFamily: `"${family}", sans-serif` }}
                    >
                      <span className="truncate">{family}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function UnsupportedNotice() {
  return (
    <div className="space-y-2 py-4 text-sm text-muted-foreground">
      <p>
        This browser does not expose the list of installed fonts. The feature
        is currently available only in Chromium-based browsers (Chrome, Edge,
        Brave, Opera, Arc) on desktop.
      </p>
      <p>
        You can still type a font name manually in the appearance panel —
        anything installed on your device will apply.
      </p>
    </div>
  );
}
