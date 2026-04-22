import { useEffect, useRef } from "react";

export type KeySequence = string;

export interface ShortcutBinding {
  sequence: KeySequence;
  description: string;
  group: string;
  handler: () => void;
}

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return TYPING_TAGS.has(target.tagName);
}

function keyToken(event: KeyboardEvent): string {
  const k = event.key;
  if (k === "?") return "?";
  if (k === "/") return "/";
  if (k === "Escape") return "escape";
  return k.length === 1 ? k.toLowerCase() : k.toLowerCase();
}

export function useKeyboardShortcuts(bindings: ShortcutBinding[]): void {
  const pendingRef = useRef<{ prefix: string; timer: number } | null>(null);

  useEffect(() => {
    const index = new Map<string, ShortcutBinding>();
    const prefixes = new Set<string>();
    for (const binding of bindings) {
      index.set(binding.sequence, binding);
      const parts = binding.sequence.split(" ");
      if (parts.length > 1) prefixes.add(parts[0]!);
    }

    function clearPrefix() {
      const pending = pendingRef.current;
      if (pending) {
        window.clearTimeout(pending.timer);
        pendingRef.current = null;
      }
    }

    function handler(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const token = keyToken(event);
      const pending = pendingRef.current;
      const candidate = pending ? `${pending.prefix} ${token}` : token;

      if (index.has(candidate)) {
        event.preventDefault();
        clearPrefix();
        index.get(candidate)!.handler();
        return;
      }

      if (!pending && prefixes.has(token)) {
        event.preventDefault();
        const timer = window.setTimeout(() => {
          pendingRef.current = null;
        }, 1000);
        pendingRef.current = { prefix: token, timer };
        return;
      }

      clearPrefix();
    }

    window.addEventListener("keydown", handler);
    return () => {
      clearPrefix();
      window.removeEventListener("keydown", handler);
    };
  }, [bindings]);
}
