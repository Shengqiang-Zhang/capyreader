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

// Parse a srcset attribute value into URL+descriptor pairs following the HTML spec
// (https://html.spec.whatwg.org/multipage/images.html#parsing-a-srcset-attribute).
// Candidate URLs may contain commas (Cloudinary transform params, etc.), so we
// cannot simply split on "," — the spec collects each URL as a run of
// non-whitespace chars and only treats a trailing comma as the candidate separator.
function parseSrcsetCandidates(
  srcset: string,
): Array<{ url: string; descriptor: string }> {
  const candidates: Array<{ url: string; descriptor: string }> = [];
  let i = 0;
  const len = srcset.length;

  while (i < len) {
    // Skip whitespace and commas between candidates.
    while (i < len && (srcset[i] === "," || /\s/.test(srcset[i]))) i++;
    if (i >= len) break;

    // Collect the URL token (all non-whitespace chars).
    const start = i;
    while (i < len && !/\s/.test(srcset[i])) i++;
    let url = srcset.slice(start, i);

    // Per spec: trailing commas on the URL token are candidate separators — strip them.
    const hadTrailingComma = url.endsWith(",");
    if (hadTrailingComma) url = url.replace(/,+$/, "");

    const descriptorParts: string[] = [];
    if (!hadTrailingComma) {
      // Collect descriptor tokens (e.g. "2x", "100w") until the next comma or end.
      while (i < len) {
        while (i < len && /\s/.test(srcset[i])) i++;
        if (i >= len || srcset[i] === ",") {
          if (i < len) i++; // consume the separator comma
          break;
        }
        const t = i;
        while (i < len && !/[\s,]/.test(srcset[i])) i++;
        descriptorParts.push(srcset.slice(t, i));
      }
    }

    candidates.push({ url, descriptor: descriptorParts.join(" ") });
  }

  return candidates;
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

  // Rewrite srcset candidates. Uses a spec-compliant parser so URL-internal
  // commas (e.g. Cloudinary transform params like `w_400,h_300`) are not
  // mistaken for candidate separators.
  return attrs.replace(
    /(\bsrcset=)(['"])([^'"]*)(['"])/g,
    (
      _match,
      prefix: string,
      openQuote: string,
      value: string,
      closeQuote: string,
    ) => {
      const rewritten = parseSrcsetCandidates(value)
        .map(({ url, descriptor }) => {
          const resolved = url.startsWith(PROXY_PATH) ? `${base}${url}` : url;
          return descriptor ? `${resolved} ${descriptor}` : resolved;
        })
        .join(", ");
      return `${prefix}${openQuote}${rewritten}${closeQuote}`;
    },
  );
}
