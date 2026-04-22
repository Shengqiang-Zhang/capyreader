import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
}

Object.defineProperty(window, "localStorage", {
  configurable: true,
  writable: false,
  value: createMemoryStorage(),
});

Object.defineProperty(window, "sessionStorage", {
  configurable: true,
  writable: false,
  value: createMemoryStorage(),
});

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
