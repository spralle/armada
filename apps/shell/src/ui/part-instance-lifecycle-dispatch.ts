import type { ShellRuntime } from "../app/types.js";
import {
  activateTabInstance,
  closeTabThroughRuntime,
  reopenMostRecentlyClosedTabThroughRuntime,
  type PartLifecycleDeps,
} from "./part-instance-tab-lifecycle.js";
import {
  openPopout,
  requestPopoutFromHostShim,
  restorePart,
} from "./part-instance-popout-lifecycle.js";

type LocalLifecycleActionId =
  | "part-instance.open"
  | "part-instance.activate"
  | "part-instance.popout"
  | "part-instance.restore"
  | "part-instance.close"
  | "part-instance.reopen";

interface LocalLifecycleActionRequest {
  actionId: LocalLifecycleActionId;
  tabInstanceId?: string;
  partTitle?: string;
}

export function dispatchLocalLifecycleAction(
  runtime: ShellRuntime,
  request: LocalLifecycleActionRequest,
  deps: PartLifecycleDeps,
): boolean {
  switch (request.actionId) {
    case "part-instance.open":
    case "part-instance.activate": {
      const tabInstanceId = request.tabInstanceId;
      if (!tabInstanceId) {
        return false;
      }
      return activateTabInstance(tabInstanceId, request.partTitle, runtime, deps);
    }
    case "part-instance.popout": {
      const tabInstanceId = request.tabInstanceId;
      if (!tabInstanceId) {
        return false;
      }

      if (runtime.isPopout) {
        requestPopoutFromHostShim(tabInstanceId, runtime, {
          renderSyncStatus: deps.renderSyncStatus,
        });
        return true;
      }

      openPopout(tabInstanceId, runtime, deps);
      return true;
    }
    case "part-instance.restore": {
      const tabInstanceId = request.tabInstanceId;
      if (!tabInstanceId) {
        return false;
      }

      if (runtime.isPopout) {
        if (runtime.hostWindowId) {
          deps.publishWithDegrade({
            type: "popout-restore-request",
            tabId: tabInstanceId,
            partId: tabInstanceId,
            hostWindowId: runtime.hostWindowId,
            sourceWindowId: runtime.windowId,
          });
        }
        window.close();
        return true;
      }

      restorePart(tabInstanceId, runtime, {
        renderParts: deps.renderParts,
        renderSyncStatus: deps.renderSyncStatus,
      });
      return true;
    }
    case "part-instance.close": {
      const tabInstanceId = request.tabInstanceId;
      if (!tabInstanceId) {
        return false;
      }
      return closeTabThroughRuntime(runtime, tabInstanceId, deps);
    }
    case "part-instance.reopen":
      return reopenMostRecentlyClosedTabThroughRuntime(runtime, deps);
    default:
      return false;
  }
}
