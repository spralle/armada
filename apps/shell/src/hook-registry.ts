import type { Disposable, HookService } from "@ghost/plugin-contracts";

export const HOOK_REGISTRY_SERVICE_ID = "ghost.hooks.registry";

/** Hook ID for element enter/exit lifecycle transitions. */
export const ELEMENT_TRANSITION_HOOK_ID = "ghost.hooks.element-transition";

/**
 * In-memory hook registry. Implements the plugin-facing HookService
 * and exposes getHooks() for shell-side consumers.
 */
export class HookRegistry implements HookService {
  private readonly hooks = new Map<string, Set<unknown>>();

  add<T>(hookId: string, hook: T): Disposable {
    let bucket = this.hooks.get(hookId);
    if (!bucket) {
      bucket = new Set();
      this.hooks.set(hookId, bucket);
    }
    bucket.add(hook);
    return {
      dispose: () => {
        bucket!.delete(hook);
        if (bucket!.size === 0) this.hooks.delete(hookId);
      },
    };
  }

  /** Get all hooks registered for a given ID. Shell-side only. */
  getHooks<T>(hookId: string): ReadonlyArray<T> {
    const bucket = this.hooks.get(hookId);
    return bucket ? (Array.from(bucket) as T[]) : [];
  }
}
