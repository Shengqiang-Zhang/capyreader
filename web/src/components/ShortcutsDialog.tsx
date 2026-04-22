import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import type { ShortcutBinding } from "@/keyboard/shortcuts";
import { Button } from "@/components/ui/Button";

interface ShortcutsDialogProps {
  bindings: ShortcutBinding[];
  open: boolean;
  onClose: () => void;
}

export default function ShortcutsDialog({
  bindings,
  open,
  onClose,
}: ShortcutsDialogProps) {
  const groups = useMemo(() => {
    const map = new Map<string, ShortcutBinding[]>();
    for (const binding of bindings) {
      const list = map.get(binding.group) ?? [];
      list.push(binding);
      map.set(binding.group, list);
    }
    return Array.from(map.entries());
  }, [bindings]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-display text-lg font-semibold">
            Keyboard shortcuts
          </h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          {groups.map(([group, items]) => (
            <section key={group} className="mb-4 last:mb-0">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </h3>
              <dl className="divide-y">
                {items.map((binding) => (
                  <div
                    key={binding.sequence}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <dt>{binding.description}</dt>
                    <dd className="flex gap-1">
                      {binding.sequence.split(" ").map((token, i) => (
                        <kbd
                          key={i}
                          className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs"
                        >
                          {token}
                        </kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
