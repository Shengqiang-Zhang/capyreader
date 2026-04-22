import { useEffect, useRef, useState } from "react";
import { Check, Type } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
  useArticleAppearance,
} from "@/hooks/useArticleAppearance";

export default function ArticleSettingsMenu() {
  const [open, setOpen] = useState(false);
  const { appearance, setAppearance, reset } = useArticleAppearance();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Article appearance"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Type className="h-4 w-4" />
      </Button>
      {open && (
        <div
          role="dialog"
          aria-label="Article appearance"
          className="absolute right-0 top-full z-40 mt-2 w-72 rounded-lg border bg-card p-3 text-card-foreground shadow-lg"
        >
          <OptionSection label="Body font">
            {FONT_FAMILY_OPTIONS.map((opt) => (
              <OptionRow
                key={opt.key}
                label={opt.label}
                labelClassName={opt.previewClass}
                selected={appearance.fontFamily === opt.key}
                onClick={() => setAppearance({ fontFamily: opt.key })}
              />
            ))}
          </OptionSection>

          <OptionSection label="Title font">
            {FONT_FAMILY_OPTIONS.map((opt) => (
              <OptionRow
                key={opt.key}
                label={opt.label}
                labelClassName={opt.previewClass}
                selected={appearance.titleFontFamily === opt.key}
                onClick={() => setAppearance({ titleFontFamily: opt.key })}
              />
            ))}
          </OptionSection>

          <OptionSection label="Size">
            <div className="grid grid-cols-4 gap-1">
              {FONT_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setAppearance({ fontSize: opt.key })}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-xs transition-colors",
                    appearance.fontSize === opt.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input hover:bg-accent",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </OptionSection>

          <div className="mt-3 flex justify-end border-t pt-3">
            <Button variant="ghost" size="sm" onClick={reset}>
              Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function OptionSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function OptionRow({
  label,
  labelClassName,
  selected,
  onClick,
}: {
  label: string;
  labelClassName?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
        selected
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/50",
      )}
    >
      <span className={cn("truncate", labelClassName)}>{label}</span>
      {selected && <Check className="h-3.5 w-3.5 text-primary" />}
    </button>
  );
}
