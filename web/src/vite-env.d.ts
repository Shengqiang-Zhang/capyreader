/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_MINIFLUX_URL?: string;
  readonly VITE_IMAGE_FALLBACK_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
