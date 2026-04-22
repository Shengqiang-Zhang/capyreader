import { useMemo } from "react";
import type { ShortcutBinding } from "@/keyboard/shortcuts";
import { Dialog } from "@/components/ui/Dialog";

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

  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts">
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
    </Dialog>
  );
}
