import { describe, it, expect } from "vitest";
import { resolveMinifluxProxyUrls } from "./resolveProxyUrls";

describe("resolveMinifluxProxyUrls", () => {
  const base = "https://miniflux.example.com";

  it("leaves empty content untouched", () => {
    expect(resolveMinifluxProxyUrls("", base)).toBe("");
  });

  it("leaves content untouched when base url is empty", () => {
    const html = `<img src="/proxy/abc/def">`;
    expect(resolveMinifluxProxyUrls(html, "")).toBe(html);
  });

  it("rewrites relative /proxy/ src to absolute Miniflux url", () => {
    const html = `<img src="/proxy/abc123/base64encoded">`;
    expect(resolveMinifluxProxyUrls(html, base)).toBe(
      `<img src="https://miniflux.example.com/proxy/abc123/base64encoded">`,
    );
  });

  it("handles single-quoted attributes", () => {
    const html = `<img src='/proxy/h/u'>`;
    expect(resolveMinifluxProxyUrls(html, base)).toBe(
      `<img src='https://miniflux.example.com/proxy/h/u'>`,
    );
  });

  it("rewrites data-src, poster, and href", () => {
    const html =
      `<img data-src="/proxy/a/b"><video poster="/proxy/c/d"></video><a href="/proxy/e/f">x</a>`;
    const out = resolveMinifluxProxyUrls(html, base);
    expect(out).toContain(`data-src="${base}/proxy/a/b"`);
    expect(out).toContain(`poster="${base}/proxy/c/d"`);
    expect(out).toContain(`href="${base}/proxy/e/f"`);
  });

  it("rewrites srcset entries that start with /proxy/", () => {
    const html = `<img srcset="/proxy/a/b 1x, /proxy/c/d 2x">`;
    expect(resolveMinifluxProxyUrls(html, base)).toBe(
      `<img srcset="${base}/proxy/a/b 1x, ${base}/proxy/c/d 2x">`,
    );
  });

  it("does not touch absolute or non-proxy urls", () => {
    const html = `<img src="https://cdn.example.com/img.jpg"><img src="/other/path.jpg">`;
    expect(resolveMinifluxProxyUrls(html, base)).toBe(html);
  });

  it("strips trailing slashes on base url", () => {
    const html = `<img src="/proxy/a/b">`;
    expect(resolveMinifluxProxyUrls(html, `${base}///`)).toBe(
      `<img src="${base}/proxy/a/b">`,
    );
  });

  it("does not split srcset on commas inside a URL", () => {
    const html = `<img srcset="https://cdn.example.com/img/w_400,h_300,c_fill/img.jpg 2x">`;
    expect(resolveMinifluxProxyUrls(html, base)).toBe(html);
  });

  it("rewrites proxy srcset entry without corrupting URL-internal commas in other entries", () => {
    const html = `<img srcset="/proxy/a/b 1x, https://cdn.example.com/img/w_400,h_300/img.jpg 2x">`;
    expect(resolveMinifluxProxyUrls(html, base)).toBe(
      `<img srcset="${base}/proxy/a/b 1x, https://cdn.example.com/img/w_400,h_300/img.jpg 2x">`,
    );
  });

  // Miniflux servers with MEDIA_PROXY_MODE=all but BASE_URL unset emit absolute
  // proxy URLs anchored at `http://localhost/`. These reach the user's browser
  // and 404 (or ERR_CONNECTION_REFUSED) unless we swap the host.
  it("rewrites absolute http://localhost/proxy/ src to the configured base", () => {
    const html = `<img src="http://localhost/proxy/abc123/base64encoded">`;
    expect(resolveMinifluxProxyUrls(html, base)).toBe(
      `<img src="${base}/proxy/abc123/base64encoded">`,
    );
  });

  it("rewrites absolute http://127.0.0.1/proxy/ src", () => {
    const html = `<img src="http://127.0.0.1/proxy/abc/def">`;
    expect(resolveMinifluxProxyUrls(html, base)).toBe(
      `<img src="${base}/proxy/abc/def">`,
    );
  });

  it("rewrites absolute localhost proxy URLs with explicit port", () => {
    const html = `<img src="http://localhost:8080/proxy/h/u">`;
    expect(resolveMinifluxProxyUrls(html, base)).toBe(
      `<img src="${base}/proxy/h/u">`,
    );
  });

  it("rewrites localhost proxy URLs in srcset entries", () => {
    const html = `<img srcset="http://localhost/proxy/a/b 1x, http://localhost/proxy/c/d 2x">`;
    expect(resolveMinifluxProxyUrls(html, base)).toBe(
      `<img srcset="${base}/proxy/a/b 1x, ${base}/proxy/c/d 2x">`,
    );
  });

  it("does not rewrite absolute proxy URLs on unrelated hosts", () => {
    const html = `<img src="https://other.example.com/proxy/abc/def">`;
    expect(resolveMinifluxProxyUrls(html, base)).toBe(html);
  });
});
