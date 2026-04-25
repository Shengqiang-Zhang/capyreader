// Decode the upstream URL embedded in a Miniflux media-proxy URL.
//
// Miniflux encodes proxy URLs as `/proxy/{HMAC}/{base64url-original}` where
// the second segment is the original upstream URL in URL-safe base64
// (`-` and `_` instead of `+` and `/`). When Miniflux's own server-side fetch
// fails (e.g. Heroku egress is blocked by an upstream CDN's hotlink protection)
// the proxy returns a 403 text/plain body that Chrome rejects with
// `ERR_BLOCKED_BY_ORB`. The web companion can then retry through a public
// image-proxy fallback, but it has to fetch the *upstream* URL — re-routing
// through the same Miniflux proxy would just fail again.
//
// IMPORTANT: a copy of this function is inlined in `media-iframe.js` (which
// runs inside `about:srcdoc` and cannot import modules). Keep them in sync.

export function decodeMinifluxProxyUrl(
  src: string,
  minifluxBase: string,
): string | null {
  if (!src || !minifluxBase) return null;
  const base = minifluxBase.replace(/\/+$/, "");
  const prefix = `${base}/proxy/`;
  if (!src.startsWith(prefix)) return null;
  const tail = src.slice(prefix.length);
  const slash = tail.indexOf("/");
  if (slash < 0) return null;
  const encoded = tail.slice(slash + 1);
  if (!encoded) return null;
  // atob() only accepts standard base64 — map URL-safe chars first.
  const standardB64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  let decoded: string;
  try {
    decoded = atob(standardB64);
  } catch {
    return null;
  }
  if (!/^https?:\/\//i.test(decoded)) return null;
  return decoded;
}
