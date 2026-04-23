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

  /** Cached snapshot of provider contributions, invalidated on mutation. */
  let providersSnapshot: readonly ProviderContribution[] = [];
  let providersSnapshotDirty = true;

  function invalidateProvidersSnapshot(): void {
    providersSnapshotDirty = true;
  }

  function getOrCreateListenerSet(id: string): Set<() => void> {
    let set = contextListeners.get(id);
    if (!set) {
      set = new Set();
      contextListeners.set(id, set);
    }
    return set;
  }

  function contribute<T>(
    contribution: ContextContribution<T>,
    pluginId = "",
  ): Disposable {
    const id = contribution.id;
    entries.set(id, {
      contribution: contribution as ContextContribution<unknown>,
      pluginId,
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

    return {
      dispose() {
        set.delete(listener);
      },
    };
  }

  function contributeProvider(
    contribution: ProviderContribution,
    pluginId = "",
  ): Disposable {
    const entry: ProviderEntry = { contribution, pluginId };
    providers.push(entry);
    providers.sort((a, b) => a.contribution.order - b.contribution.order);
    invalidateProvidersSnapshot();
    notifyAll(providerListeners);

    return {
      dispose() {
        const idx = providers.indexOf(entry);
        if (idx !== -1) {
          providers.splice(idx, 1);
          invalidateProvidersSnapshot();
          notifyAll(providerListeners);
        }
      },
    };
  }

  function getProviders(): readonly ProviderContribution[] {
    if (providersSnapshotDirty) {
      providersSnapshot = providers.map((e) => e.contribution);
      providersSnapshotDirty = false;
    }
    return providersSnapshot;
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
      invalidateProvidersSnapshot();
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
