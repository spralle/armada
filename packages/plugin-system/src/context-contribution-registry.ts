import type {
  ContextContribution,
  ContextContributionRegistry,
  Disposable,
  ProviderContribution,
} from "@ghost-shell/contracts";

interface ContextEntry {
  readonly contribution: ContextContribution<unknown>;
  readonly pluginId: string;
}

interface ProviderEntry {
  readonly contribution: ProviderContribution;
  readonly pluginId: string;
}

function notifyAll(listeners: ReadonlySet<() => void>): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Create a framework-agnostic reactive context contribution registry.
 * Plugins contribute state slices; other plugins/shell subscribe to changes.
 */
export function createContextContributionRegistry(): ContextContributionRegistry {
  const entries = new Map<string, ContextEntry>();
  const providers: ProviderEntry[] = [];
  const contextListeners = new Map<string, Set<() => void>>();
  const providerListeners = new Set<() => void>();

  function getOrCreateListenerSet(id: string): Set<() => void> {
    let set = contextListeners.get(id);
    if (!set) {
      set = new Set();
      contextListeners.set(id, set);
    }
    return set;
  }

  function contribute<T>(contribution: ContextContribution<T>): Disposable {
    const id = contribution.id;
    entries.set(id, {
      contribution: contribution as ContextContribution<unknown>,
      pluginId: "",
    });
    const listeners = contextListeners.get(id);
    if (listeners) notifyAll(listeners);

    return {
      dispose() {
        if (entries.get(id)?.contribution === contribution) {
          entries.delete(id);
          const ls = contextListeners.get(id);
          if (ls) notifyAll(ls);
        }
      },
    };
  }

  function get<T>(id: string): T | undefined {
    const entry = entries.get(id);
    if (!entry) return undefined;
    return entry.contribution.get() as T;
  }

  function subscribe(id: string, listener: () => void): Disposable {
    const set = getOrCreateListenerSet(id);
    set.add(listener);

    // Also delegate to the contribution's own subscribe if it exists
    const entry = entries.get(id);
    let innerCleanup: Disposable | (() => void) | undefined;
    if (entry) {
      innerCleanup = entry.contribution.subscribe(listener);
    }

    return {
      dispose() {
        set.delete(listener);
        if (innerCleanup) {
          if (typeof innerCleanup === "function") {
            innerCleanup();
          } else {
            innerCleanup.dispose();
          }
        }
      },
    };
  }

  function contributeProvider(contribution: ProviderContribution): Disposable {
    const entry: ProviderEntry = { contribution, pluginId: "" };
    providers.push(entry);
    providers.sort((a, b) => a.contribution.order - b.contribution.order);
    notifyAll(providerListeners);

    return {
      dispose() {
        const idx = providers.indexOf(entry);
        if (idx !== -1) {
          providers.splice(idx, 1);
          notifyAll(providerListeners);
        }
      },
    };
  }

  function getProviders(): readonly ProviderContribution[] {
    return providers.map((e) => e.contribution);
  }

  function subscribeProviders(listener: () => void): Disposable {
    providerListeners.add(listener);
    return {
      dispose() {
        providerListeners.delete(listener);
      },
    };
  }

  function removeByPlugin(pluginId: string): void {
    const affectedIds: string[] = [];

    for (const [id, entry] of entries) {
      if (entry.pluginId === pluginId) {
        affectedIds.push(id);
        entries.delete(id);
      }
    }

    for (const id of affectedIds) {
      const listeners = contextListeners.get(id);
      if (listeners) notifyAll(listeners);
    }

    let removedProviders = false;
    for (let i = providers.length - 1; i >= 0; i--) {
      if (providers[i].pluginId === pluginId) {
        providers.splice(i, 1);
        removedProviders = true;
      }
    }

    if (removedProviders) {
      notifyAll(providerListeners);
    }
  }

  return {
    contribute,
    get,
    subscribe,
    contributeProvider,
    getProviders,
    subscribeProviders,
    removeByPlugin,
  };
}
