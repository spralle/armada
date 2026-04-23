// WindowService — implements the WindowService interface from ghost-api.ts.
// Bridges the shell's window model and QuickPick infrastructure for plugins.

import type {
  InputBoxOptions,
  QuickPick,
  QuickPickItem,
  QuickPickOptions,
  WindowDescriptor,
  WindowService,
} from "@ghost-shell/contracts";
import { createEventEmitter } from "@ghost-shell/contracts";
import { createQuickPickController } from "../ui/quick-pick/quick-pick-controller.js";

/**
 * Dependencies required by WindowService to bridge shell internals.
 * Injected via factory to keep the service testable and decoupled.
 */
export interface WindowServiceDependencies {
  /** Returns the unique window ID for this shell instance. */
  getWindowId(): string;
  /** Returns whether this window is a popout (lightweight tab renderer). */
  getIsPopout(): boolean;
  /** Returns the host window ID if this is a popout, null otherwise. */
  getHostWindowId(): string | null;
  /** Returns the map of popout window handles keyed by window ID. */
  getPopoutHandles(): Map<string, Window>;
  /** Returns the currently selected part ID, or null. */
  getSelectedPartId(): string | null;
  /** Render a QuickPick controller in the shell overlay. */
  renderQuickPick(
    controller: QuickPick<QuickPickItem> & {
      getState(): unknown;
      dispatch(action: unknown): void;
    },
  ): void;
  /** Dismiss the current QuickPick overlay. */
  dismissQuickPick(): void;
}

/**
 * WindowService with an exposed emitter for shell-side wiring.
 * The shell calls fireWindowsChanged() when popout windows open/close.
 */
export interface WindowServiceWithEmitter {
  readonly service: WindowService;
  /** Fire to notify listeners that the window set changed. */
  fireWindowsChanged(): void;
  /** Dispose the emitter (cleanup). */
  dispose(): void;
}

/**
 * Create a WindowService that wraps the shell's window model with
 * QuickPick integration and window enumeration.
 *
 * Returns the service plus shell-side wiring hooks.
 */
export function createWindowService(
  deps: WindowServiceDependencies,
): WindowServiceWithEmitter {
  const windowsEmitter = createEventEmitter<void>();

  const service: WindowService = {
    get windowId(): string {
      return deps.getWindowId();
    },

    get isPopout(): boolean {
      return deps.getIsPopout();
    },

    getWindows(): WindowDescriptor[] {
      const descriptors: WindowDescriptor[] = [];

      // Current window
      descriptors.push({
        windowId: deps.getWindowId(),
        isPopout: deps.getIsPopout(),
        hostWindowId: deps.getHostWindowId(),
        activePartId: deps.getSelectedPartId(),
      });

      // Popout windows
      const popouts = deps.getPopoutHandles();
      for (const [popoutWindowId] of popouts) {
        descriptors.push({
          windowId: popoutWindowId,
          isPopout: true,
          hostWindowId: deps.getWindowId(),
          activePartId: null,
        });
      }

      return descriptors;
    },

    onDidChangeWindows: windowsEmitter.event,

    showQuickPick<T extends QuickPickItem>(
      items: T[],
      options?: QuickPickOptions,
    ): Promise<T | undefined> {
      return new Promise<T | undefined>((resolve) => {
        const controller = createQuickPickController<T>();

        controller.items = items;
        if (options?.placeholder) {
          controller.placeholder = options.placeholder;
        }

        let resolved = false;

        const acceptSub = controller.onDidAccept(() => {
          if (resolved) return;
          resolved = true;
          const selected = controller.activeItems[0] as T | undefined;
          acceptSub.dispose();
          hideSub.dispose();
          deps.dismissQuickPick();
          controller.dispose();
          resolve(selected);
        });

        const hideSub = controller.onDidHide(() => {
          if (resolved) return;
          resolved = true;
          acceptSub.dispose();
          hideSub.dispose();
          controller.dispose();
          resolve(undefined);
        });

        deps.renderQuickPick(controller);
        controller.show();
      });
    },

    createQuickPick<T extends QuickPickItem>(): QuickPick<T> {
      return createQuickPickController<T>();
    },

    // Stub: showInputBox is not yet implemented.
    // Will be wired to an InputBox overlay component in a future bead.
    showInputBox(_options?: InputBoxOptions): Promise<string | undefined> {
      return Promise.resolve(undefined);
    },

    // Stub: showNotification is not yet implemented.
    // Will be wired to a notification toast component in a future bead.
    showNotification(
      message: string,
      severity: "info" | "warning" | "error",
    ): void {
      console.log(`[${severity}] ${message}`);
    },
  };

  return {
    service,
    fireWindowsChanged() {
      windowsEmitter.fire(undefined as never);
    },
    dispose() {
      windowsEmitter.dispose();
    },
  };
}
