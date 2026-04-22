/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_MINIFLUX_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
