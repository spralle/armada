import type { QuickPickItem } from "@ghost-shell/contracts";
import { useCallback, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { QuickPickController } from "./quick-pick-controller.js";
import { QuickPickOverlay } from "./quick-pick-overlay.js";
import type { QuickPickState } from "./quick-pick-state.js";

export interface QuickPickBridge {
  render<T extends QuickPickItem>(controller: QuickPickController<T>): void;
  dismiss(): void;
  dispose(): void;
}

/**
 * Imperative bridge that manages a standalone React root for QuickPickOverlay.
 * Bridges imperative shell code to the React-based overlay component.
 */
export function createQuickPickBridge(modalContainer?: HTMLElement): QuickPickBridge {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let activeController: QuickPickController<QuickPickItem> | null = null;

  function ensureRoot(): { container: HTMLDivElement; root: Root } {
    if (container && root) {
      return { container, root };
    }
    const mountTarget = modalContainer ?? document.body;

    container = document.createElement("div");
    container.dataset.quickPickBridge = "true";
    mountTarget.appendChild(container);
    root = createRoot(container);
    return { container, root };
  }

  function clearRendering(): void {
    if (root) {
      root.unmount();
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
    activeController = null;
  }

  return {
    render<T extends QuickPickItem>(controller: QuickPickController<T>): void {
      clearRendering();
      const { root: reactRoot } = ensureRoot();
      activeController = controller as unknown as QuickPickController<QuickPickItem>;
      reactRoot.render(<QuickPickBridgeHost controller={controller} onDismiss={() => clearRendering()} />);
    },

    dismiss(): void {
      if (activeController) {
        activeController.hide();
      }
      clearRendering();
    },

    dispose(): void {
      clearRendering();
    },
  };
}

function QuickPickBridgeHost<T extends QuickPickItem>(props: {
  controller: QuickPickController<T>;
  onDismiss: () => void;
}) {
  const { controller, onDismiss } = props;
  const [state, setState] = useState<QuickPickState<T>>(() => controller.getState());

  const syncState = useCallback((): void => {
    setState(controller.getState());
  }, [controller]);

  useEffect(() => {
    const valueSub = controller.onDidChangeValue(() => syncState());
    const activeSub = controller.onDidChangeActive(() => syncState());
    return () => {
      valueSub.dispose();
      activeSub.dispose();
    };
  }, [controller, syncState]);

  const onFilterChange = useCallback(
    (filter: string) => {
      controller.dispatch({ type: "updateFilter", filter });
      syncState();
    },
    [controller, syncState],
  );

  const onSelectNext = useCallback(() => {
    controller.dispatch({ type: "selectNext" });
    syncState();
  }, [controller, syncState]);

  const onSelectPrevious = useCallback(() => {
    controller.dispatch({ type: "selectPrevious" });
    syncState();
  }, [controller, syncState]);

  const onAccept = useCallback(
    (_item: T) => {
      controller.fireAccept();
    },
    [controller],
  );

  const onClose = useCallback(() => {
    controller.hide();
    onDismiss();
  }, [controller, onDismiss]);

  return (
    <QuickPickOverlay<T>
      state={state}
      placeholder={controller.placeholder}
      onFilterChange={onFilterChange}
      onSelectNext={onSelectNext}
      onSelectPrevious={onSelectPrevious}
      onAccept={onAccept}
      onClose={onClose}
    />
  );
}
