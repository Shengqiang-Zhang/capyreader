import { describe, it, expect } from "vitest";
import {
  renderArticleSrcDoc,
  sanitizeCustomFontFamily,
  substitute,
} from "./render";
import type { Entry } from "@/api/types";

function buildEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 1,
    user_id: 1,
    feed_id: 1,
    status: "unread",
    hash: "h",
    title: "Title",
    url: "https://example.com/post",
    comments_url: "",
    published_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    content: "<p>body</p>",
    author: "",
    starred: false,
    reading_time: 0,
    feed: {
      id: 1,
      user_id: 1,
      feed_url: "https://example.com/feed",
      site_url: "https://example.com",
      title: "Feed",
      checked_at: "2026-01-01T00:00:00Z",
      category: { id: 1, user_id: 1, title: "cat" },
    },
    ...overrides,
  };
}

describe("substitute", () => {
  it("replaces known placeholders and leaves unknown ones intact", () => {
    const out = substitute("Hello {{name}}, {{greeting}}!", {
      name: "Capy",
    });
    expect(out).toBe("Hello Capy, {{greeting}}!");
  });

  it("supports repeated keys", () => {
    expect(substitute("{{x}}-{{x}}", { x: "A" })).toBe("A-A");
  });

  it("does not recurse into substituted values", () => {
    expect(substitute("{{a}}", { a: "{{b}}", b: "final" })).toBe("{{b}}");
  });
});

describe("sanitizeCustomFontFamily", () => {
  it("returns null for empty or whitespace input", () => {
    expect(sanitizeCustomFontFamily(null)).toBeNull();
    expect(sanitizeCustomFontFamily(undefined)).toBeNull();
    expect(sanitizeCustomFontFamily("")).toBeNull();
    expect(sanitizeCustomFontFamily("   ")).toBeNull();
  });

  it("strips disallowed characters and preserves simple names", () => {
    expect(sanitizeCustomFontFamily("Arial")).toBe("Arial");
    expect(sanitizeCustomFontFamily("Helvetica-Neue")).toBe("Helvetica-Neue");
  });

  it("quotes multi-word family names", () => {
    expect(sanitizeCustomFontFamily("Helvetica Neue")).toBe('"Helvetica Neue"');
  });

  it("drops characters that could escape a CSS or HTML context", () => {
    for (const input of [
      "Arial; color: red;",
      "Arial } body { display: none;",
      "</style><script>alert(1)</script>",
      'Arial", injected: "x',
    ]) {
      const out = sanitizeCustomFontFamily(input) ?? "";
      expect(out).not.toMatch(/[;{}<>]/);
    }
  });

  it("keeps comma-separated stacks and normalizes quotes", () => {
    expect(
      sanitizeCustomFontFamily(`"Helvetica Neue", 'Arial', sans-serif`),
    ).toBe('"Helvetica Neue", Arial, sans-serif');
  });
});

describe("renderArticleSrcDoc base href", () => {
  it("emits a Miniflux <base href> so relative /proxy/ URLs resolve", () => {
    const out = renderArticleSrcDoc({
      entry: buildEntry(),
      theme: "light",
      minifluxBaseUrl: "https://miniflux.example.com",
    });
    expect(out).toContain(
      `<base href="https://miniflux.example.com/" target="_blank" />`,
    );
  });

  it("normalizes trailing slashes on the Miniflux base URL", () => {
    const out = renderArticleSrcDoc({
      entry: buildEntry(),
      theme: "light",
      minifluxBaseUrl: "https://miniflux.example.com///",
    });
    expect(out).toContain(`<base href="https://miniflux.example.com/"`);
  });

  it("emits an empty href when no Miniflux URL is supplied", () => {
    const out = renderArticleSrcDoc({
      entry: buildEntry(),
      theme: "light",
    });
    expect(out).toContain(`<base href="" target="_blank" />`);
  });

  it("rejects non-http(s) base URLs (e.g. javascript:)", () => {
    const out = renderArticleSrcDoc({
      entry: buildEntry(),
      theme: "light",
      minifluxBaseUrl: "javascript:alert(1)",
    });
    expect(out).toContain(`<base href="" target="_blank" />`);
  });

  it("escapes HTML metacharacters in the base URL", () => {
    const out = renderArticleSrcDoc({
      entry: buildEntry(),
      theme: "light",
      minifluxBaseUrl: 'https://example.com/"><script>',
    });
    expect(out).not.toContain(`"><script>`);
  });
});
