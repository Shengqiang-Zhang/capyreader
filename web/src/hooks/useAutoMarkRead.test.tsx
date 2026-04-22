import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { Entry } from "@/api/types";
import { useAutoMarkRead } from "./useAutoMarkRead";

const mutate = vi.fn();

vi.mock("@/api/mutations", () => ({
  useUpdateEntryStatus: () => ({ mutate }),
}));

function entry(overrides: Partial<Entry> & Pick<Entry, "id">): Entry {
  return {
    user_id: 1,
    feed_id: 1,
    status: "unread",
    hash: "",
    title: "",
    url: "",
    comments_url: "",
    published_at: "",
    created_at: "",
    content: "",
    author: "",
    starred: false,
    reading_time: 0,
    feed: {
      id: 1,
      user_id: 1,
      feed_url: "",
      site_url: "",
      title: "",
      checked_at: "",
      category: { id: 1, user_id: 1, title: "" },
    },
    ...overrides,
  };
}

describe("useAutoMarkRead", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mutate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks an initially-unread entry as read after the delay", () => {
    renderHook(() => useAutoMarkRead(entry({ id: 7, status: "unread" })));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(mutate).toHaveBeenCalledWith({ entryId: 7, status: "read" });
  });

  it("does not fire for an already-read entry", () => {
    renderHook(() => useAutoMarkRead(entry({ id: 7, status: "read" })));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("does not re-arm when the user manually toggles to unread", () => {
    // Regression: previously, the effect depended on entry.status, so flipping
    // an already-read article to "unread" would schedule another auto-mark and
    // immediately revert the user's action.
    const { rerender } = renderHook(
      ({ e }: { e: Entry }) => useAutoMarkRead(e),
      { initialProps: { e: entry({ id: 7, status: "read" }) } },
    );

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(mutate).not.toHaveBeenCalled();

    // Simulate the optimistic flip from the Unread button click: same entry
    // id, status transitions to "unread".
    rerender({ e: entry({ id: 7, status: "unread" }) });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("cancels the pending timer when the user navigates away", () => {
    const { rerender } = renderHook(
      ({ e }: { e: Entry }) => useAutoMarkRead(e),
      { initialProps: { e: entry({ id: 7, status: "unread" }) } },
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ e: entry({ id: 8, status: "read" }) });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("re-arms when switching to a different unread entry", () => {
    const { rerender } = renderHook(
      ({ e }: { e: Entry }) => useAutoMarkRead(e),
      { initialProps: { e: entry({ id: 7, status: "read" }) } },
    );

    rerender({ e: entry({ id: 8, status: "unread" }) });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(mutate).toHaveBeenCalledWith({ entryId: 8, status: "read" });
  });
});
