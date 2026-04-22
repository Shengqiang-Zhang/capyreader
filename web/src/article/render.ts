import articleCss from "@/styles/article.scss?inline";
import iframeScript from "@/article/media-iframe.js?raw";
import { escapeHtml } from "@/lib/html";
import type { Entry } from "@/api/types";
import { ARTICLE_TEMPLATE } from "@/article/template";

export interface RenderOptions {
  entry: Entry;
  theme: "light" | "dark";
  fontFamily?: FontFamilyKey;
  titleFontFamily?: FontFamilyKey;
  fontSize?: string;
}

export type FontFamilyKey =
  | "system_ui"
  | "atkinson_hyperlegible"
  | "inter"
  | "jost"
  | "literata"
  | "poppins"
  | "vollkorn";

interface Palette {
  color_primary: string;
  color_surface: string;
  color_surface_container: string;
  color_surface_container_highest: string;
  color_surface_variant: string;
  color_on_surface: string;
  color_on_surface_variant: string;
  color_primary_container: string;
  color_on_primary_container: string;
  color_secondary: string;
  color_surface_tint: string;
}

const LIGHT_PALETTE: Palette = {
  color_primary: "#2563eb",
  color_surface: "#ffffff",
  color_surface_container: "#f1f5f9",
  color_surface_container_highest: "#e2e8f0",
  color_surface_variant: "#e5e7eb",
  color_on_surface: "#0f172a",
  color_on_surface_variant: "#64748b",
  color_primary_container: "#dbeafe",
  color_on_primary_container: "#1e3a8a",
  color_secondary: "#64748b",
  color_surface_tint: "#2563eb",
};

const DARK_PALETTE: Palette = {
  color_primary: "#60a5fa",
  color_surface: "#0b1220",
  color_surface_container: "#111827",
  color_surface_container_highest: "#1f2937",
  color_surface_variant: "#1e293b",
  color_on_surface: "#e2e8f0",
  color_on_surface_variant: "#94a3b8",
  color_primary_container: "#1e3a8a",
  color_on_primary_container: "#bfdbfe",
  color_secondary: "#94a3b8",
  color_surface_tint: "#60a5fa",
};

export function renderArticleSrcDoc(opts: RenderOptions): string {
  const palette = opts.theme === "dark" ? DARK_PALETTE : LIGHT_PALETTE;

  const bylineText = opts.entry.author ? opts.entry.author : "";

  const substitutions: Record<string, string> = {
    ...palette,
    theme: opts.theme,
    color_scheme: opts.theme === "dark" ? "dark" : "light",
    font_family: opts.fontFamily ?? "literata",
    title_font_family: opts.titleFontFamily ?? "jost",
    font_size: opts.fontSize ?? "1.0625rem",
    title_font_size: "1.875rem",
    title_text_align: "left",
    line_height: "1.65em",
    article_top_margin: "0",
    pre_white_space: "pre",
    table_overflow_x: "auto",
    title: escapeHtml(opts.entry.title),
    byline: bylineText ? escapeHtml(bylineText) : "",
    feed_name: escapeHtml(opts.entry.feed.title),
    external_link: opts.entry.url,
    body: opts.entry.content,
    inline_css: articleCss,
    inline_js: iframeScript,
  };

  return substitute(ARTICLE_TEMPLATE, substitutions);
}

export function substitute(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      return values[key]!;
    }
    return match;
  });
}
