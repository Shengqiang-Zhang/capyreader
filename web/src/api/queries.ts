import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { minifluxApi } from "@/api/miniflux";
import { resolveMinifluxProxyUrls } from "@/api/resolveProxyUrls";
import type { EntriesQuery, EntriesResponse, Entry } from "@/api/types";

function useCredentials() {
  const { credentials } = useAuth();
  if (!credentials) {
    throw new Error("Authenticated queries require signed-in credentials");
  }
  return credentials;
}

export const queryKeys = {
  me: () => ["me"] as const,
  categories: () => ["categories"] as const,
  feeds: () => ["feeds"] as const,
  counters: () => ["counters"] as const,
  entries: (query: EntriesQuery | undefined) => ["entries", query ?? {}] as const,
  entry: (id: number) => ["entry", id] as const,
};

export function useMe() {
  const credentials = useCredentials();
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => minifluxApi.me(credentials),
  });
}

export function useCategories() {
  const credentials = useCredentials();
  return useQuery({
    queryKey: queryKeys.categories(),
    queryFn: () => minifluxApi.categories(credentials, true),
  });
}

export function useFeeds() {
  const credentials = useCredentials();
  return useQuery({
    queryKey: queryKeys.feeds(),
    queryFn: () => minifluxApi.feeds(credentials),
  });
}

export function useFeedCounters() {
  const credentials = useCredentials();
  return useQuery({
    queryKey: queryKeys.counters(),
    queryFn: () => minifluxApi.feedCounters(credentials),
  });
}

function rewriteEntryContent(entry: Entry, baseUrl: string): Entry {
  if (!entry.content) return entry;
  const resolved = resolveMinifluxProxyUrls(entry.content, baseUrl);
  if (resolved === entry.content) return entry;
  return { ...entry, content: resolved };
}

export function useEntries(query?: EntriesQuery, enabled = true) {
  const credentials = useCredentials();
  return useQuery({
    queryKey: queryKeys.entries(query),
    queryFn: async (): Promise<EntriesResponse> => {
      const result = await minifluxApi.entries(credentials, query);
      return {
        ...result,
        entries: result.entries.map((e) =>
          rewriteEntryContent(e, credentials.baseUrl),
        ),
      };
    },
    enabled,
  });
}

export function useEntry(id: number, enabled = true) {
  const credentials = useCredentials();
  return useQuery({
    queryKey: queryKeys.entry(id),
    queryFn: async () => {
      const entry = await minifluxApi.entry(credentials, id);
      return rewriteEntryContent(entry, credentials.baseUrl);
    },
    enabled,
  });
}
