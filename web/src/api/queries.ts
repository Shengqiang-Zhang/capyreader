import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { minifluxApi } from "@/api/miniflux";
import type { EntriesQuery } from "@/api/types";

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

export function useEntries(query?: EntriesQuery, enabled = true) {
  const credentials = useCredentials();
  return useQuery({
    queryKey: queryKeys.entries(query),
    queryFn: () => minifluxApi.entries(credentials, query),
    enabled,
  });
}

export function useEntry(id: number, enabled = true) {
  const credentials = useCredentials();
  return useQuery({
    queryKey: queryKeys.entry(id),
    queryFn: () => minifluxApi.entry(credentials, id),
    enabled,
  });
}
