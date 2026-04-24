import type { ContextContribution, ProviderContribution } from "./context-contribution.js";
import type { Disposable } from "./disposable.js";

/** Plugin-facing API for context contributions. */
export interface ContextApi {
  /** Register a reactive context contribution. */
  contribute<T>(contribution: ContextContribution<T>): Disposable;
  /** Get the current value for a context key. */
  get<T>(id: string): T | undefined;
  /** Subscribe to changes for a context key. */
  subscribe(id: string, listener: () => void): Disposable;
}

/** Read-only access to contributed providers for rendering composition. */
export interface ContextProviderSource {
  /** Get all registered providers, sorted by order. */
  getProviders(): readonly ProviderContribution[];
  /** Subscribe to provider list changes. */
  subscribeProviders(listener: () => void): Disposable;
}

/** Shell-internal registry extending ContextApi with provider lifecycle. */
export interface ContextContributionRegistry extends ContextApi, ContextProviderSource {
  /** Register a provider contribution (sorted by order). */
  contributeProvider(contribution: ProviderContribution): Disposable;
  /** Remove all contributions and providers for a plugin. */
  removeByPlugin(pluginId: string): void;
}
