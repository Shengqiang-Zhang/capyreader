import { describe, it, expect } from "vitest";
import { substitute } from "./render";

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
