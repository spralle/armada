import { DRAG_INLINE_PREFIX, DRAG_REF_PREFIX } from "../app/constants.js";
import { safeJson, safeParse } from "../app/utils.js";
import type { DragSessionBroker } from "../dnd-session-broker.js";

export interface DragSessionPayload {
  partId: string;
  partInstanceId: string;
  partDefinitionId: string;
  partTitle: string;
  sourceWindowId: string;
  createdAt: string;
}

export function createDragSessionPayload(input: {
  partId: string;
  partTitle: string;
  sourceWindowId: string;
  partInstanceId?: string;
  partDefinitionId?: string;
  createdAt?: string;
}): DragSessionPayload {
  return {
    partId: input.partId,
    partInstanceId: input.partInstanceId ?? input.partId,
    partDefinitionId: input.partDefinitionId ?? input.partId,
    partTitle: input.partTitle,
    sourceWindowId: input.sourceWindowId,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function encodeDragSessionPayload(
  payload: DragSessionPayload,
  broker: Pick<DragSessionBroker, "available" | "create">,
): string {
  if (broker.available) {
    const ref = broker.create(payload);
    return `${DRAG_REF_PREFIX}${ref.id}`;
  }

  return `${DRAG_INLINE_PREFIX}${JSON.stringify(payload)}`;
}

export function resolveDroppedDragSessionResult(
  raw: string,
  broker: Pick<DragSessionBroker, "consume">,
): string {
  if (raw.startsWith(DRAG_REF_PREFIX)) {
    const id = raw.slice(DRAG_REF_PREFIX.length);
    const payload = broker.consume({ id });
    if (!payload) {
      return "Drop failed: session missing/expired (bridge unavailable or stale ref).";
    }

    return `Dropped via session ref: ${safeJson(payload)}`;
  }

  if (raw.startsWith(DRAG_INLINE_PREFIX)) {
    const payload = safeParse(raw.slice(DRAG_INLINE_PREFIX.length));
    return payload
      ? `Dropped via inline fallback: ${safeJson(payload)}`
      : "Drop failed: invalid inline payload.";
  }

  return "Drop ignored: unsupported payload format.";
}
