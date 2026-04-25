import { useEffect, useMemo, useRef, useState } from "react";
import { renderArticleSrcDoc, type FontFamilyKey } from "@/article/render";
import { useAuth } from "@/auth/AuthContext";
import type { Entry } from "@/api/types";
import { cn } from "@/lib/cn";

const IMAGE_FALLBACK_PROXY = (
  import.meta.env.VITE_IMAGE_FALLBACK_PROXY ?? ""
).trim();

interface ArticleFrameProps {
  entry: Entry;
  fontFamily?: FontFamilyKey;
  titleFontFamily?: FontFamilyKey;
  customFontFamily?: string | null;
  customTitleFontFamily?: string | null;
  fontSize?: string;
  className?: string;
}

function prefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

export default function ArticleFrame({
  entry,
  fontFamily,
  titleFontFamily,
  customFontFamily,
  customTitleFontFamily,
  fontSize,
  className,
}: ArticleFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { credentials } = useAuth();
  const minifluxBaseUrl = credentials?.baseUrl;
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    prefersDark() ? "dark" : "light",
  );

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(root.classList.contains("dark") ? "dark" : "light");
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const srcDoc = useMemo(
    () =>
      renderArticleSrcDoc({
        entry,
        theme,
        fontFamily,
        titleFontFamily,
        customFontFamily,
        customTitleFontFamily,
        fontSize,
        minifluxBaseUrl,
        imageFallbackProxy: IMAGE_FALLBACK_PROXY,
      }),
    [
      entry,
      theme,
      fontFamily,
      titleFontFamily,
      customFontFamily,
      customTitleFontFamily,
      fontSize,
      minifluxBaseUrl,
    ],
  );

  return (
    <iframe
      ref={iframeRef}
      title={entry.title}
      srcDoc={srcDoc}
      // `allow-same-origin` is needed for fonts from the parent origin to
      // load inside the iframe. Scripts are permitted so the ported media.js
      // can post-process embeds; top-level navigation and forms remain blocked.
      sandbox="allow-scripts allow-same-origin allow-popups"
      className={cn("h-full w-full border-0 bg-background", className)}
    />
  );
}
