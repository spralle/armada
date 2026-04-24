/**
 * Thin adapter around the browser History API.
 * Isolates the shell router from direct DOM/history dependencies,
 * making it testable and SSR-safe.
 */
export interface HistoryAdapter {
  pushState(url: string, title?: string): void;
  replaceState(url: string, title?: string): void;
  getCurrentUrl(): URL;
  onPopState(handler: (url: URL) => void): () => void;
}

/**
 * Create a history adapter backed by the browser History API.
 * Returns a no-op adapter if window/history is not available (SSR safety).
 */
export function createBrowserHistoryAdapter(): HistoryAdapter {
  if (typeof window === "undefined" || typeof history === "undefined") {
    return createNoOpHistoryAdapter();
  }

  let popStateHandler: ((url: URL) => void) | null = null;

  const onPopStateEvent = (): void => {
    popStateHandler?.(new URL(window.location.href));
  };

  return {
    pushState(url: string, title?: string): void {
      history.pushState(null, title ?? "", url);
    },
    replaceState(url: string, title?: string): void {
      history.replaceState(null, title ?? "", url);
    },
    getCurrentUrl(): URL {
      return new URL(window.location.href);
    },
    onPopState(handler: (url: URL) => void): () => void {
      popStateHandler = handler;
      window.addEventListener("popstate", onPopStateEvent);
      return () => {
        popStateHandler = null;
        window.removeEventListener("popstate", onPopStateEvent);
      };
    },
  };
}

function createNoOpHistoryAdapter(): HistoryAdapter {
  return {
    pushState(): void {},
    replaceState(): void {},
    getCurrentUrl(): URL {
      return new URL("http://localhost/");
    },
    onPopState(): () => void {
      return () => {};
    },
  };
}
