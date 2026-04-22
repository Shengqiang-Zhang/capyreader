export interface MinifluxCredentials {
  baseUrl: string;
  token: string;
}

const STORAGE_KEY = "capyreader.miniflux.credentials.v1";

export function loadCredentials(): MinifluxCredentials | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<MinifluxCredentials>;
    if (typeof parsed.baseUrl === "string" && typeof parsed.token === "string") {
      return { baseUrl: normalizeBaseUrl(parsed.baseUrl), token: parsed.token };
    }
  } catch {
    // fall through
  }
  return null;
}

export function saveCredentials(credentials: MinifluxCredentials): void {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      baseUrl: normalizeBaseUrl(credentials.baseUrl),
      token: credentials.token,
    }),
  );
}

export function clearCredentials(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}
