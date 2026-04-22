import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { FontFamilyKey } from "@/article/render";

export type FontSizeKey = "sm" | "md" | "lg" | "xl";

export interface ArticleAppearance {
  fontFamily: FontFamilyKey;
  titleFontFamily: FontFamilyKey;
  fontSize: FontSizeKey;
  customFontFamily: string | null;
  customTitleFontFamily: string | null;
}

export const FONT_FAMILY_OPTIONS: Array<{
  key: FontFamilyKey;
  label: string;
  previewClass: string;
}> = [
  { key: "literata", label: "Literata", previewClass: "font-[Literata,serif]" },
  { key: "vollkorn", label: "Vollkorn", previewClass: "font-[Vollkorn,serif]" },
  { key: "inter", label: "Inter", previewClass: "font-[Inter,sans-serif]" },
  { key: "jost", label: "Jost", previewClass: "font-[Jost,sans-serif]" },
  { key: "poppins", label: "Poppins", previewClass: "font-[Poppins,sans-serif]" },
  {
    key: "atkinson_hyperlegible",
    label: "Atkinson Hyperlegible",
    previewClass: "font-['Atkinson_Hyperlegible',sans-serif]",
  },
  { key: "system_ui", label: "System UI", previewClass: "font-sans" },
];

export const FONT_SIZE_OPTIONS: Array<{
  key: FontSizeKey;
  label: string;
  value: string;
}> = [
  { key: "sm", label: "Small", value: "0.9375rem" },
  { key: "md", label: "Medium", value: "1.0625rem" },
  { key: "lg", label: "Large", value: "1.1875rem" },
  { key: "xl", label: "X-Large", value: "1.3125rem" },
];

const DEFAULT_APPEARANCE: ArticleAppearance = {
  fontFamily: "literata",
  titleFontFamily: "jost",
  fontSize: "md",
  customFontFamily: null,
  customTitleFontFamily: null,
};

const MAX_CUSTOM_FAMILY_LENGTH = 200;

function normalizeCustom(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_CUSTOM_FAMILY_LENGTH) return null;
  return trimmed;
}

const STORAGE_KEY = "capy.article.appearance";
const CHANGE_EVENT = "capy:article-appearance";

const VALID_FONT_KEYS = new Set(FONT_FAMILY_OPTIONS.map((o) => o.key));
const VALID_SIZE_KEYS = new Set(FONT_SIZE_OPTIONS.map((o) => o.key));

function readFromStorage(): ArticleAppearance {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = JSON.parse(raw) as Partial<ArticleAppearance>;
    return {
      fontFamily:
        parsed.fontFamily && VALID_FONT_KEYS.has(parsed.fontFamily)
          ? parsed.fontFamily
          : DEFAULT_APPEARANCE.fontFamily,
      titleFontFamily:
        parsed.titleFontFamily && VALID_FONT_KEYS.has(parsed.titleFontFamily)
          ? parsed.titleFontFamily
          : DEFAULT_APPEARANCE.titleFontFamily,
      fontSize:
        parsed.fontSize && VALID_SIZE_KEYS.has(parsed.fontSize)
          ? parsed.fontSize
          : DEFAULT_APPEARANCE.fontSize,
      customFontFamily: normalizeCustom(parsed.customFontFamily),
      customTitleFontFamily: normalizeCustom(parsed.customTitleFontFamily),
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  const onLocalChange = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onLocalChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onLocalChange);
  };
}

let cached: ArticleAppearance | null = null;

function getSnapshot(): ArticleAppearance {
  if (cached === null) cached = readFromStorage();
  return cached;
}

function getServerSnapshot(): ArticleAppearance {
  return DEFAULT_APPEARANCE;
}

function writeToStorage(next: ArticleAppearance) {
  cached = next;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useArticleAppearance() {
  const appearance = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Refresh once on mount in case the cache was populated with defaults
  // before localStorage was readable (e.g. first render on the server path).
  useEffect(() => {
    const fresh = readFromStorage();
    const prev = cached;
    if (
      !prev ||
      fresh.fontFamily !== prev.fontFamily ||
      fresh.titleFontFamily !== prev.titleFontFamily ||
      fresh.fontSize !== prev.fontSize ||
      fresh.customFontFamily !== prev.customFontFamily ||
      fresh.customTitleFontFamily !== prev.customTitleFontFamily
    ) {
      cached = fresh;
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
  }, []);

  const setAppearance = useCallback(
    (patch: Partial<ArticleAppearance>) => {
      const current = getSnapshot();
      writeToStorage({ ...current, ...patch });
    },
    [],
  );

  const reset = useCallback(() => {
    writeToStorage(DEFAULT_APPEARANCE);
  }, []);

  return { appearance, setAppearance, reset };
}

export function fontSizeValue(key: FontSizeKey): string {
  return (
    FONT_SIZE_OPTIONS.find((o) => o.key === key)?.value ??
    FONT_SIZE_OPTIONS[1]!.value
  );
}
