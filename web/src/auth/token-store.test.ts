// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  clearCredentials,
  loadCredentials,
  normalizeBaseUrl,
  saveCredentials,
} from "./token-store";

describe("token-store", () => {
  it("round-trips credentials through localStorage", () => {
    saveCredentials({ baseUrl: "https://m.example.com", token: "abc" });
    expect(loadCredentials()).toEqual({
      baseUrl: "https://m.example.com",
      token: "abc",
    });
  });

  it("strips trailing slashes from the base URL", () => {
    expect(normalizeBaseUrl("  https://m.example.com///  ")).toBe(
      "https://m.example.com",
    );
  });

  it("returns null when nothing is stored", () => {
    expect(loadCredentials()).toBeNull();
  });

  it("returns null when the stored value is malformed", () => {
    window.localStorage.setItem("capyreader.miniflux.credentials.v1", "{bad json");
    expect(loadCredentials()).toBeNull();
  });

  it("clearCredentials wipes stored value", () => {
    saveCredentials({ baseUrl: "https://m.example.com", token: "abc" });
    clearCredentials();
    expect(loadCredentials()).toBeNull();
  });
});
