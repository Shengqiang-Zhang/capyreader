import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { minifluxApi } from "@/api/miniflux";
import { resolveMinifluxProxyUrls } from "@/api/resolveProxyUrls";
import type { EntriesResponse, Entry, EntryStatus } from "@/api/types";

function useCredentials() {
  const { credentials } = useAuth();
  if (!credentials) throw new Error("Mutation requires signed-in credentials");
  return credentials;
}

interface UpdateStatusVars {
  entryId: number;
  status: EntryStatus;
}

interface UpdateStatusSnapshot {
  entriesLists: Array<[readonly unknown[], EntriesResponse | undefined]>;
  entry: Entry | undefined;
}

export function useUpdateEntryStatus() {
  const credentials = useCredentials();
  const queryClient = useQueryClient();

  return useMutation<UpdateStatusVars, Error, UpdateStatusVars, UpdateStatusSnapshot>({
    mutationFn: async ({ entryId, status }) => {
      await minifluxApi.updateEntries(credentials, [entryId], status);
      return { entryId, status };
    },
    onMutate: async ({ entryId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["entries"] });
      await queryClient.cancelQueries({ queryKey: ["entry", entryId] });

      const entriesLists = queryClient.getQueriesData<EntriesResponse>({
        queryKey: ["entries"],
      });
      const entry = queryClient.getQueryData<Entry>(["entry", entryId]);

      queryClient.setQueriesData<EntriesResponse>(
        { queryKey: ["entries"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            entries: old.entries.map((e) =>
              e.id === entryId ? { ...e, status } : e,
            ),
          };
        },
      );
      queryClient.setQueryData<Entry>(["entry", entryId], (old) =>
        old ? { ...old, status } : old,
      );

      return { entriesLists, entry };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      for (const [key, data] of ctx.entriesLists) {
        queryClient.setQueryData(key, data);
      }
      if (ctx.entry) {
        queryClient.setQueryData(["entry", ctx.entry.id], ctx.entry);
      }
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      queryClient.invalidateQueries({ queryKey: ["entry", vars.entryId] });
      queryClient.invalidateQueries({ queryKey: ["counters"] });
    },
  });
}

interface ToggleBookmarkVars {
  entryId: number;
  currentStarred: boolean;
}

interface ToggleBookmarkSnapshot {
  entriesLists: Array<[readonly unknown[], EntriesResponse | undefined]>;
  entry: Entry | undefined;
}

interface FetchFullContentVars {
  entryId: number;
}

export function useFetchFullContent() {
  const credentials = useCredentials();

  return useMutation<{ content: string }, Error, FetchFullContentVars>({
    mutationFn: async ({ entryId }) => {
      const result = await minifluxApi.fetchContent(credentials, entryId);
      return {
        ...result,
        content: resolveMinifluxProxyUrls(result.content, credentials.baseUrl),
      };
    },
  });
}

export function useToggleBookmark() {
  const credentials = useCredentials();
  const queryClient = useQueryClient();

  return useMutation<void, Error, ToggleBookmarkVars, ToggleBookmarkSnapshot>({
    mutationFn: async ({ entryId }) => {
      await minifluxApi.toggleBookmark(credentials, entryId);
    },
    onMutate: async ({ entryId, currentStarred }) => {
      const nextStarred = !currentStarred;

      await queryClient.cancelQueries({ queryKey: ["entries"] });
      await queryClient.cancelQueries({ queryKey: ["entry", entryId] });

      const entriesLists = queryClient.getQueriesData<EntriesResponse>({
        queryKey: ["entries"],
      });
      const entry = queryClient.getQueryData<Entry>(["entry", entryId]);

      queryClient.setQueriesData<EntriesResponse>(
        { queryKey: ["entries"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            entries: old.entries.map((e) =>
              e.id === entryId ? { ...e, starred: nextStarred } : e,
            ),
          };
        },
      );
      queryClient.setQueryData<Entry>(["entry", entryId], (old) =>
        old ? { ...old, starred: nextStarred } : old,
      );

      return { entriesLists, entry };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      for (const [key, data] of ctx.entriesLists) {
        queryClient.setQueryData(key, data);
      }
      if (ctx.entry) {
        queryClient.setQueryData(["entry", ctx.entry.id], ctx.entry);
      }
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      queryClient.invalidateQueries({ queryKey: ["entry", vars.entryId] });
      queryClient.invalidateQueries({ queryKey: ["counters"] });
    },
  });
}
