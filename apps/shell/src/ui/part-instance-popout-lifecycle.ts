import { sanitizeForWindowName } from "../app/utils.js";
import type { ShellRuntime } from "../app/types.js";
import type { PartLifecycleDeps } from "./part-instance-tab-lifecycle.js";

export function openPopout(
  partId: string,
  runtime: ShellRuntime,
  deps: Pick<PartLifecycleDeps, "renderParts" | "renderSyncStatus">,
): void {
  if (runtime.isPopout) {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("popout", "1");
  url.searchParams.set("partId", partId);
  url.searchParams.set("hostWindowId", runtime.windowId);

  const popout = window.open(url.toString(), `armada-popout-${sanitizeForWindowName(partId)}`);
  if (!popout) {
    runtime.notice = `Popup blocked. Could not pop out '${partId}'.`;
    deps.renderSyncStatus();
    return;
  }

  runtime.popoutHandles.set(partId, popout);
  runtime.poppedOutTabIds.add(partId);
  runtime.notice = `Part '${partId}' opened in a new window.`;
  deps.renderParts();
  deps.renderSyncStatus();
}

export function restorePart(
  partId: string,
  runtime: ShellRuntime,
  deps: Pick<PartLifecycleDeps, "renderParts" | "renderSyncStatus">,
): void {
  runtime.poppedOutTabIds.delete(partId);

  const handle = runtime.popoutHandles.get(partId);
  if (handle && !handle.closed) {
    handle.close();
  }

  runtime.popoutHandles.delete(partId);
  runtime.notice = `Part '${partId}' restored to host window.`;
  deps.renderParts();
  deps.renderSyncStatus();
}
