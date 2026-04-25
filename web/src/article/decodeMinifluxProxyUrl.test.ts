import { describe, it, expect } from "vitest";
import { decodeMinifluxProxyUrl } from "./decodeMinifluxProxyUrl";

const BASE = "https://miniflux.example.com";

describe("decodeMinifluxProxyUrl", () => {
  it("returns null for empty src", () => {
    expect(decodeMinifluxProxyUrl("", BASE)).toBeNull();
  });

  it("returns null for empty base", () => {
    const url = `${BASE}/proxy/hash=/aHR0cHM6Ly9leGFtcGxlLmNvbS9pbWcucG5n`;
    expect(decodeMinifluxProxyUrl(url, "")).toBeNull();
  });

  it("returns null for non-proxy URL", () => {
    expect(
      decodeMinifluxProxyUrl("https://cdn.example.com/img.png", BASE),
    ).toBeNull();
  });

  it("returns null for proxy URL on a different origin", () => {
    const url =
      "https://other.example.com/proxy/hash=/aHR0cHM6Ly9leGFtcGxlLmNvbS9pbWcucG5n";
    expect(decodeMinifluxProxyUrl(url, BASE)).toBeNull();
  });

  it("decodes a real Miniflux proxy URL to its upstream URL", () => {
    // base64 of "https://i.qbitai.com/wp-content/uploads/2026/04/93f4c8fcfcd65a40172cdb6699ab2d0f.webp"
    const encoded =
      "aHR0cHM6Ly9pLnFiaXRhaS5jb20vd3AtY29udGVudC91cGxvYWRzLzIwMjYvMDQvOTNmNGM4ZmNmY2Q2NWE0MDE3MmNkYjY2OTlhYjJkMGYud2VicA==";
    const url = `${BASE}/proxy/5_LC_tH_4u6TVBE_ymwqMiXN1-QfTdOIJMDH9H_dmOE=/${encoded}`;
    expect(decodeMinifluxProxyUrl(url, BASE)).toBe(
      "https://i.qbitai.com/wp-content/uploads/2026/04/93f4c8fcfcd65a40172cdb6699ab2d0f.webp",
    );
  });

  it("tolerates a trailing slash on the base URL", () => {
    const encoded = "aHR0cHM6Ly9leGFtcGxlLmNvbS9pbWcucG5n"; // https://example.com/img.png
    const url = `${BASE}/proxy/h=/${encoded}`;
    expect(decodeMinifluxProxyUrl(url, `${BASE}/`)).toBe(
      "https://example.com/img.png",
    );
  });

  it("decodes base64url with `-` and `_` characters", () => {
    // base64url for "https://example.com/?+/=" — uses both - and _ after substitution
    // bytes: "https://example.com/?+/=" — standard b64: aHR0cHM6Ly9leGFtcGxlLmNvbS8/Ky89
    // base64url:                                       aHR0cHM6Ly9leGFtcGxlLmNvbS8_Ky89
    const url = `${BASE}/proxy/h=/aHR0cHM6Ly9leGFtcGxlLmNvbS8_Ky89`;
    expect(decodeMinifluxProxyUrl(url, BASE)).toBe(
      "https://example.com/?+/=",
    );
  });

  it("returns null when the base64 segment is malformed", () => {
    const url = `${BASE}/proxy/h=/!!!not-base64!!!`;
    expect(decodeMinifluxProxyUrl(url, BASE)).toBeNull();
  });

  it("returns null when the decoded value is not http(s)", () => {
    // base64 of "javascript:alert(1)"
    const encoded = "amF2YXNjcmlwdDphbGVydCgxKQ==";
    const url = `${BASE}/proxy/h=/${encoded}`;
    expect(decodeMinifluxProxyUrl(url, BASE)).toBeNull();
  });

  it("decodes a proxy URL whose upstream URL contains non-ASCII (UTF-8) characters", () => {
    // "https://example.com/图片/test.jpg" encoded as UTF-8 bytes → standard base64
    // then converted to base64url (the single "/" in the b64 output becomes "_").
    const encoded = "aHR0cHM6Ly9leGFtcGxlLmNvbS_lm77niYcvdGVzdC5qcGc=";
    const url = `${BASE}/proxy/h=/${encoded}`;
    expect(decodeMinifluxProxyUrl(url, BASE)).toBe(
      "https://example.com/图片/test.jpg",
    );
  });

  it("returns null when the URL has no second segment", () => {
    expect(decodeMinifluxProxyUrl(`${BASE}/proxy/`, BASE)).toBeNull();
    expect(decodeMinifluxProxyUrl(`${BASE}/proxy/onlyhash=`, BASE)).toBeNull();
  });

  it("works when minifluxBase has a subpath", () => {
    const subpathBase = "https://host.example.com/miniflux";
    const encoded = "aHR0cHM6Ly9leGFtcGxlLmNvbS9pbWcucG5n";
    const url = `${subpathBase}/proxy/h=/${encoded}`;
    expect(decodeMinifluxProxyUrl(url, subpathBase)).toBe(
      "https://example.com/img.png",
    );
  });
});
