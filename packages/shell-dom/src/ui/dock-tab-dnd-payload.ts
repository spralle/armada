import { DRAG_INLINE_PREFIX, DRAG_REF_PREFIX, TAB_DOCK_DRAG_MIME } from "../app/constants.js";
import type { ShellRuntime } from "../app/types.js";
import { safeParse } from "../app/utils.js";
import type { DockDropZone } from "../context-state.js";

export type DockDragPayload = {
  tabId: string;
  sourceWindowId: string;
  transferSessionId?: string;
};

export function readTabDragPayload(
  dataTransfer: DataTransfer,
  runtime: ShellRuntime,
  options?: { consumeRef?: boolean },
): DockDragPayload | null {
  const raw = dataTransfer.getData(TAB_DOCK_DRAG_MIME);
  if (raw) {
    const parsed = parseDragPayloadRaw(raw);
    if (parsed) {
      return parsed;
    }
  }

  const fallbackTabId = dataTransfer.getData("text/plain").trim();
  if (!fallbackTabId) {
    return null;
  }

  if (fallbackTabId.startsWith(DRAG_REF_PREFIX)) {
    const transferSessionId = fallbackTabId.slice(DRAG_REF_PREFIX.length);
    if (options?.consumeRef) {
      const consumed = asDragPayload(runtime.dragSessionBroker.consume({ id: transferSessionId }, runtime.windowId));
      return consumed ? { ...consumed, transferSessionId } : null;
    }

    const mimeParsed = parseDragPayloadRaw(dataTransfer.getData(TAB_DOCK_DRAG_MIME));
    return mimeParsed ? { ...mimeParsed, transferSessionId } : null;
  }

  if (fallbackTabId.startsWith(DRAG_INLINE_PREFIX)) {
    return null;
  }

  const fallbackJson = safeParse(fallbackTabId);
  const parsedFallback = asDragPayload(fallbackJson);
  return parsedFallback ?? { tabId: fallbackTabId, sourceWindowId: runtime.windowId };
}

export function isDockDropZone(value: string | undefined): value is DockDropZone {
  return value === "center" || value === "left" || value === "right" || value === "top" || value === "bottom";
}

function parseDragPayloadRaw(raw: string): DockDragPayload | null {
  try {
    return asDragPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

function asDragPayload(value: unknown): DockDragPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<DockDragPayload>;
  if (typeof candidate.tabId !== "string" || typeof candidate.sourceWindowId !== "string") {
    return null;
  }

  return { tabId: candidate.tabId, sourceWindowId: candidate.sourceWindowId };
}
