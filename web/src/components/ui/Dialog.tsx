import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function Dialog({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  className,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const prior = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    requestAnimationFrame(() => {
      if (!panelRef.current) return;
      const first = panelRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? panelRef.current).focus();
    });

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      prior?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-card shadow-xl",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2
              id={titleId}
              className="font-display text-lg font-semibold tracking-tight"
            >
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="border-t bg-background/50 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
