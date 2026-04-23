import type { Disposable } from "./disposable.js";

/** Service for registering lifecycle hooks. Exposed as a capability service. */
export interface HookService {
  /** Register a hook. Returns a Disposable to unregister. */
  add<T>(hookId: string, hook: T): Disposable;
}

/** Context passed to element transition hooks. */
export interface TransitionContext {
  /** The type of element transitioning. */
  readonly type: "surface" | "part" | "workspace";
  /** The identifier of the element (surface ID, part ID, workspace ID). */
  readonly id: string;
}

/** Hook for observing element lifecycle transitions. Multiple plugins can register. */
export interface ElementTransitionHook {
  /** Called when an element is entering. Set attributes, start animations. */
  onEnter?(el: HTMLElement, context: TransitionContext): void;
  /** Called when an element is exiting. Resolve when safe to remove. */
  onExit?(el: HTMLElement, context: TransitionContext): Promise<void>;
}

export const HOOK_REGISTRY_SERVICE_ID = "ghost.hooks.registry";
export const ELEMENT_TRANSITION_HOOK_ID = "ghost.hooks.element-transition";
