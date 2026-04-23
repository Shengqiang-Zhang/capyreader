// Miniflux rewrites image URLs to relative `/proxy/{hash}/{encoded}` paths when
// its server-side PROXY_OPTION (or PROXY_MEDIA_TYPES) is configured. Those paths
// resolve against Miniflux in its own web UI, but in a third-party client they
// resolve against our origin and 404. Rewrite them to absolute Miniflux URLs so
// the browser loads them from the Miniflux instance instead — that also lets
// Miniflux bypass cross-origin hotlink blocks for CDNs like Tencent COS that
// reject non-server requests (seen on i.qbitai.com images).

const PROXY_PATH = "/proxy/";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function resolveMinifluxProxyUrls(
  html: string,
  minifluxBaseUrl: string,
): string {
  if (!html) return html;
  const base = stripTrailingSlash(minifluxBaseUrl);
  if (!base) return html;

  // Rewrite `src="/proxy/..."` and `src='/proxy/...'` occurrences. Also covers
  // `data-src`, `poster`, and `href` which Miniflux rewrites for anchors too.
  const attrs = html.replace(
    /(\b(?:src|data-src|poster|href)=)(['"])(\/proxy\/)/g,
    `$1$2${base}$3`,
  );

  // Rewrite srcset entries (comma-separated URL + descriptor pairs).
  return attrs.replace(
    /(\bsrcset=)(['"])([^'"]*)(['"])/g,
    (_match, prefix: string, openQuote: string, value: string, closeQuote: string) => {
      const rewritten = value
        .split(",")
        .map((entry) => {
          const trimmed = entry.trim();
          if (trimmed.startsWith(PROXY_PATH)) return `${base}${trimmed}`;
          return trimmed;
        })
        .join(", ");
      return `${prefix}${openQuote}${rewritten}${closeQuote}`;
    },
  );
}
