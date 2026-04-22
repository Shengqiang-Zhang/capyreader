import { describe, it, expect } from "vitest";
import { sanitizeCustomFontFamily, substitute } from "./render";

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
