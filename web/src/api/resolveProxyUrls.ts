// Miniflux rewrites image URLs to `/proxy/{hash}/{encoded}` paths when its
// server-side MEDIA_PROXY_MODE (or PROXY_MEDIA_TYPES) is configured. Those paths
// resolve against Miniflux in its own web UI, but in a third-party client they
// resolve against our origin and 404. Rewrite them to absolute Miniflux URLs so
// the browser loads them from the Miniflux instance instead — that also lets
// Miniflux bypass cross-origin hotlink blocks for CDNs like Tencent COS that
// reject non-server requests (seen on i.qbitai.com images).
//
// Two rewrite cases:
//   (a) Relative `/proxy/...` — emitted when Miniflux's BASE_URL is unset.
//   (b) Absolute `http(s)://localhost[:port]/proxy/...` — emitted when BASE_URL
//       defaults to `http://localhost` (a common Heroku/Docker misconfiguration:
//       MEDIA_PROXY_MODE=all is set but BASE_URL is left at the default). The
//       HMAC signature in the URL only covers the encoded image path, so we can
//       safely swap the host for the user's actual Miniflux origin.

const PROXY_PATH = "/proxy/";

// Matches `http(s)://localhost[:port]/proxy/` and `http(s)://127.0.0.1[:port]/proxy/`
// at the start of an attribute value. Non-capturing — replacement uses a literal.
const LOCALHOST_PROXY_PREFIX_RE =
  /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/proxy\//i;

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function rewriteSrcsetCandidate(url: string, base: string): string {
  if (url.startsWith(PROXY_PATH)) return `${base}${url}`;
  const match = url.match(LOCALHOST_PROXY_PREFIX_RE);
  if (match) return `${base}${PROXY_PATH}${url.slice(match[0].length)}`;
  return url;
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

  // Rewrite `src`, `data-src`, `poster`, `href` attribute values that point to
  // a Miniflux proxy path — either relative `/proxy/...` or absolute
  // `http(s)://localhost[:port]/proxy/...` (see header comment for context).
  const attrs = html.replace(
    /(\b(?:src|data-src|poster|href)=)(['"])(\/|https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/)proxy\//gi,
    `$1$2${base}/proxy/`,
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
          const resolved = rewriteSrcsetCandidate(url, base);
          return descriptor ? `${resolved} ${descriptor}` : resolved;
        })
        .join(", ");
      return `${prefix}${openQuote}${rewritten}${closeQuote}`;
    },
  );
}
