import { useEffect, useRef, useState } from "react";
import { Check, Search, Type, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import {
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
  useArticleAppearance,
} from "@/hooks/useArticleAppearance";
import SystemFontPickerDialog from "@/components/ArticleView/SystemFontPickerDialog";

type Target = "body" | "title";

export default function ArticleSettingsMenu() {
  const [open, setOpen] = useState(false);
  const [browseFor, setBrowseFor] = useState<Target | null>(null);
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
          className="absolute right-0 top-full z-40 mt-2 w-80 rounded-lg border bg-card p-3 text-card-foreground shadow-lg"
        >
          <FontSection
            label="Body font"
            selectedPreset={appearance.fontFamily}
            custom={appearance.customFontFamily}
            onSelectPreset={(key) => setAppearance({ fontFamily: key })}
            onCustomChange={(value) => setAppearance({ customFontFamily: value })}
            onBrowse={() => setBrowseFor("body")}
          />

          <FontSection
            label="Title font"
            selectedPreset={appearance.titleFontFamily}
            custom={appearance.customTitleFontFamily}
            onSelectPreset={(key) => setAppearance({ titleFontFamily: key })}
            onCustomChange={(value) =>
              setAppearance({ customTitleFontFamily: value })
            }
            onBrowse={() => setBrowseFor("title")}
          />

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
      <SystemFontPickerDialog
        open={browseFor !== null}
        onClose={() => setBrowseFor(null)}
        title={
          browseFor === "title"
            ? "Pick a title font"
            : "Pick a body font"
        }
        onSelect={(family) => {
          if (browseFor === "title") {
            setAppearance({ customTitleFontFamily: family });
          } else if (browseFor === "body") {
            setAppearance({ customFontFamily: family });
          }
        }}
      />
    </div>
  );
}

interface FontSectionProps {
  label: string;
  selectedPreset: (typeof FONT_FAMILY_OPTIONS)[number]["key"];
  custom: string | null;
  onSelectPreset: (key: (typeof FONT_FAMILY_OPTIONS)[number]["key"]) => void;
  onCustomChange: (value: string | null) => void;
  onBrowse: () => void;
}

function FontSection({
  label,
  selectedPreset,
  custom,
  onSelectPreset,
  onCustomChange,
  onBrowse,
}: FontSectionProps) {
  const [draft, setDraft] = useState(custom ?? "");

  useEffect(() => {
    setDraft(custom ?? "");
  }, [custom]);

  const commit = () => {
    const next = draft.trim();
    onCustomChange(next.length > 0 ? next : null);
  };

  const usingCustom = Boolean(custom);

  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {usingCustom && (
          <button
            type="button"
            onClick={() => onCustomChange(null)}
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear custom
          </button>
        )}
      </div>

      <div className="mb-2 flex gap-1">
        <Input
          className="h-8 text-xs"
          placeholder="Type a font name, e.g. Helvetica Neue"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit();
              (e.target as HTMLInputElement).blur();
            }
          }}
          style={
            usingCustom ? { fontFamily: `"${custom}", inherit` } : undefined
          }
        />
        <Button
          variant="outline"
          size="sm"
          onClick={onBrowse}
          aria-label={`Browse installed fonts for ${label}`}
        >
          <Search className="h-3.5 w-3.5" />
          Browse
        </Button>
      </div>

      <div className={cn(usingCustom && "opacity-60")}>
        {FONT_FAMILY_OPTIONS.map((opt) => (
          <OptionRow
            key={opt.key}
            label={opt.label}
            labelClassName={opt.previewClass}
            selected={!usingCustom && selectedPreset === opt.key}
            onClick={() => onSelectPreset(opt.key)}
          />
        ))}
      </div>
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
