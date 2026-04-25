// @ts-check
// Loaded inline into the article iframe via ?raw import. Browser-portable
// port of app/src/main/assets/media.js. Android-bridge features (long-press
// image dialogs, link confirmation, audio enclosures) are intentionally
// omitted — the web client uses native anchor targeting instead.

(function () {
  /**
   * The host page injects `window.__capyArticleConfig` before this script
   * runs. `imageFallbackProxy` is a URL prefix; the original src is appended
   * to it (URL-encoded) when an image fails to load. Empty string ⇒ disabled.
   * @type {{ imageFallbackProxy?: string }}
   */
  const config =
    /** @type {any} */ (/** @type {unknown} */ (window)).__capyArticleConfig ||
    {};
  const fallbackProxy = String(config.imageFallbackProxy || "");

  const YOUTUBE_DOMAINS = [
    /.*?\/\/www\.youtube-nocookie\.com\/embed\/(.*?)(\?|$)/,
    /.*?\/\/www\.youtube\.com\/embed\/(.*?)(\?|$)/,
    /.*?\/\/www\.youtube\.com\/v\/(.*?)(#|\?|$)/,
    /.*?\/\/www\.youtube\.com\/watch\?(?:.*?&)?v=([^&#]*)(?:&|#|$)/,
    /.*?\/\/youtube-nocookie\.com\/embed\/(.*?)(\?|$)/,
    /.*?\/\/youtube\.com\/embed\/(.*?)(\?|$)/,
    /.*?\/\/youtu\.be\/(.*?)(\?|$)/,
  ];

  /**
   * @param {string} src
   * @returns {string | null}
   */
  function findYouTubeMatch(src) {
    for (const regex of YOUTUBE_DOMAINS) {
      const match = src.match(regex);
      if (match) return match[1];
    }
    return null;
  }

  /** @param {string} id */
  function youtubeThumbnail(id) {
    return "https://img.youtube.com/vi/" + id + "/hqdefault.jpg";
  }

  function configureVideoTags() {
    document.querySelectorAll("video").forEach((v) => {
      v.setAttribute("preload", "metadata");
      v.setAttribute("playsinline", "true");
      v.setAttribute("controls", "true");
      v.setAttribute("controlslist", "nodownload noremoteplayback");
    });
  }

  /** @param {HTMLImageElement} img */
  function markLoaded(img) {
    img.classList.add("loaded");
  }

  // Hotlink-protected CDNs (img.ithome.com, i.qbitai.com on Tencent COS, etc.)
  // either 403 the request or trigger Chrome's ORB on the cross-origin image
  // load. Retry through a referer-stripping image proxy if one is configured.
  // Skip when the src already targets the proxy (avoid loops) or when it's a
  // Miniflux media-proxy URL (Miniflux already performs server-side fetch).

  /** @param {string} src */
  function shouldTryFallback(src) {
    if (!fallbackProxy) return false;
    if (!src) return false;
    if (src.startsWith(fallbackProxy)) return false;
    // Skip Miniflux media-proxy URLs only when /proxy/ is at the path root,
    // not anywhere in the path — a CDN URL like
    // `https://cdn.example/web/proxy/foo.jpg` should still get the fallback.
    if (/^https?:\/\/[^/]+\/proxy\//i.test(src)) return false;
    return /^https?:/i.test(src);
  }

  /** @param {string} src */
  function buildFallbackSrc(src) {
    return fallbackProxy + encodeURIComponent(src);
  }

  let warnedAboutImageBlocks = false;
  /** @param {string} src */
  function warnHotlinkBlock(src) {
    if (warnedAboutImageBlocks) return;
    warnedAboutImageBlocks = true;
    const tip = fallbackProxy
      ? "Configured fallback proxy did not accept this URL."
      : "Set MEDIA_PROXY_MODE=all on your Miniflux server, or configure VITE_IMAGE_FALLBACK_PROXY at build time.";
    console.warn(
      "[capy] Image failed to load (likely hotlink protection or ORB):",
      src,
      "\n",
      tip,
    );
  }

  /** @param {HTMLImageElement} img */
  function handleImageError(img) {
    const currentSrc = img.getAttribute("src") || "";
    if (img.dataset.capyFallbackTried === "1") {
      // Log the pre-fallback URL so the user can identify the actual feed image,
      // not the proxy-encoded retry URL.
      warnHotlinkBlock(img.dataset.capyOriginalSrc || currentSrc);
      markLoaded(img);
      return;
    }
    if (!shouldTryFallback(currentSrc)) {
      warnHotlinkBlock(currentSrc);
      markLoaded(img);
      return;
    }
    img.dataset.capyFallbackTried = "1";
    img.dataset.capyOriginalSrc = currentSrc;
    img.setAttribute("src", buildFallbackSrc(currentSrc));
    if (img.hasAttribute("srcset")) img.removeAttribute("srcset");
  }

  /** @param {HTMLImageElement} img */
  function attachImageLoadListener(img) {
    if (img.classList.contains("loaded")) return;
    if (img.dataset.capyListenerAttached === "1") return;
    img.dataset.capyListenerAttached = "1";
    img.addEventListener("load", () => markLoaded(img));
    img.addEventListener("error", () => handleImageError(img));
    if (img.complete) {
      if (img.naturalWidth > 0) markLoaded(img);
      else handleImageError(img);
    }
  }

  function attachAllImageLoadListeners() {
    document
      .querySelectorAll("img")
      .forEach((img) => attachImageLoadListener(/** @type {HTMLImageElement} */ (img)));
  }

  function reconcileImageLoadState() {
    const deadline = Date.now() + 30000;
    const interval = window.setInterval(() => {
      let outstanding = 0;
      document
        .querySelectorAll("img:not(.loaded)")
        .forEach((el) => {
          const img = /** @type {HTMLImageElement} */ (el);
          if (img.complete) markLoaded(img);
          else outstanding += 1;
        });
      if (outstanding === 0 || Date.now() > deadline) {
        window.clearInterval(interval);
        document
          .querySelectorAll("img:not(.loaded)")
          .forEach((el) => markLoaded(/** @type {HTMLImageElement} */ (el)));
      }
    }, 500);
  }

  function observeLateImages() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName === "IMG") {
            attachImageLoadListener(/** @type {HTMLImageElement} */ (node));
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            /** @type {Element} */ (node)
              .querySelectorAll("img")
              .forEach((img) =>
                attachImageLoadListener(/** @type {HTMLImageElement} */ (img)),
              );
          }
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * @param {HTMLIFrameElement} embed
   * @param {string} youtubeId
   */
  function swapYouTubePlaceholder(embed, youtubeId) {
    const placeholderImage = document.createElement("img");
    placeholderImage.classList.add("iframe-embed__image");
    placeholderImage.setAttribute("src", youtubeThumbnail(youtubeId));
    placeholderImage.setAttribute("alt", "YouTube video thumbnail");

    const playButton = document.createElement("div");
    playButton.classList.add("iframe-embed__play-button");

    const placeholder = document.createElement("a");
    placeholder.classList.add("iframe-embed");
    placeholder.setAttribute(
      "href",
      "https://www.youtube.com/watch?v=" + youtubeId,
    );
    placeholder.setAttribute("target", "_blank");
    placeholder.setAttribute("rel", "noopener noreferrer");
    placeholder.appendChild(placeholderImage);
    placeholder.appendChild(playButton);

    embed.replaceWith(placeholder);
  }

  function cleanEmbeds() {
    document.querySelectorAll("img").forEach((img) => {
      if (!img.getAttribute("src")) img.remove();
    });

    document.querySelectorAll("iframe").forEach((el) => {
      const embed = /** @type {HTMLIFrameElement} */ (el);
      const src = embed.getAttribute("src");
      if (!src) return;
      const youtubeId = findYouTubeMatch(src);
      if (youtubeId !== null) swapYouTubePlaceholder(embed, youtubeId);
    });
  }

  function wrapTables() {
    document.querySelectorAll("table").forEach((table) => {
      const parent = table.parentElement;
      if (parent && parent.classList.contains("table__wrapper")) return;
      const wrapper = document.createElement("div");
      wrapper.className = "table__wrapper";
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }

  function stripInlineStyles() {
    const content = document.getElementById("article-body-content");
    if (!content) return;
    content.querySelectorAll("*").forEach((el) => {
      el.removeAttribute("style");
      el.removeAttribute("bgcolor");
      el.removeAttribute("color");
      el.removeAttribute("background");
    });
    content.querySelectorAll("a[onclick]").forEach((a) => {
      a.removeAttribute("onclick");
    });
    content.querySelectorAll("script").forEach((s) => s.remove());
  }

  /** @param {MessageEvent} event */
  function handleBlueskyEmbedResize(event) {
    if (event.origin !== "https://embed.bsky.app") return;
    const data = event.data;
    if (!data || typeof data.height !== "number") return;
    document.querySelectorAll("iframe").forEach((iframe) => {
      if (iframe.contentWindow === event.source) {
        iframe.style.height = data.height + "px";
      }
    });
  }

  function fixAnchorRels() {
    document.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("#")) {
        a.setAttribute("rel", "noopener noreferrer");
      }
    });
  }

  // Fragment links need manual handling: `<base href>` makes `#foo` resolve
  // against the Miniflux origin and `target="_blank"` opens a new tab, but
  // users expect in-document scroll. Intercept the click and scroll ourselves.
  function handleFragmentClicks() {
    document.addEventListener("click", (event) => {
      const target = /** @type {HTMLElement | null} */ (event.target);
      if (!target) return;
      const anchor = target.closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("#")) return;
      event.preventDefault();
      if (href === "#") return;
      const id = href.slice(1);
      const dest =
        document.getElementById(id) ||
        document.querySelector(`[name="${CSS.escape(id)}"]`);
      if (!dest) return;
      event.preventDefault();
      dest.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function init() {
    stripInlineStyles();
    cleanEmbeds();
    wrapTables();
    fixAnchorRels();
    handleFragmentClicks();
    configureVideoTags();
    attachAllImageLoadListeners();
    observeLateImages();
    reconcileImageLoadState();
    window.addEventListener("message", handleBlueskyEmbedResize);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
