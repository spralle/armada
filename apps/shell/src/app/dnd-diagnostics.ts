export type DndDiagnosticOutcome = "start" | "commit" | "abort" | "reject";
export type DndDiagnosticPath = "same-window" | "cross-window-bridge";

export interface DndDiagnosticCorrelation {
  transferId?: string;
  operationId?: string;
}

export interface DndDiagnosticEvent {
  outcome: DndDiagnosticOutcome;
  path: DndDiagnosticPath;
  reason: string;
  sourceWindowId: string;
  targetWindowId: string;
  tabId: string;
  correlation?: DndDiagnosticCorrelation;
}

export interface DndDiagnosticEnvelope extends DndDiagnosticEvent {
  at: string;
}

export interface DndDiagnosticRuntime {
  lastDndDiagnostic: DndDiagnosticEnvelope | null;
}

export function createDndDiagnosticEnvelope(event: DndDiagnosticEvent): DndDiagnosticEnvelope {
  return {
    ...event,
    at: new Date().toISOString(),
  };
}

export function emitDndDiagnostic(runtime: DndDiagnosticRuntime, event: DndDiagnosticEvent): DndDiagnosticEnvelope {
  const envelope = createDndDiagnosticEnvelope(event);
  runtime.lastDndDiagnostic = envelope;
  console.log("[shell:dnd:diag]", envelope);
  return envelope;
}

export function emitDndStart(runtime: DndDiagnosticRuntime, event: Omit<DndDiagnosticEvent, "outcome">): DndDiagnosticEnvelope {
  return emitDndDiagnostic(runtime, {
    ...event,
    outcome: "start",
  });
}

export function emitDndCommit(runtime: DndDiagnosticRuntime, event: Omit<DndDiagnosticEvent, "outcome">): DndDiagnosticEnvelope {
  return emitDndDiagnostic(runtime, {
    ...event,
    outcome: "commit",
  });
}

export function emitDndAbort(runtime: DndDiagnosticRuntime, event: Omit<DndDiagnosticEvent, "outcome">): DndDiagnosticEnvelope {
  return emitDndDiagnostic(runtime, {
    ...event,
    outcome: "abort",
  });
}

export function emitDndReject(runtime: DndDiagnosticRuntime, event: Omit<DndDiagnosticEvent, "outcome">): DndDiagnosticEnvelope {
  return emitDndDiagnostic(runtime, {
    ...event,
    outcome: "reject",
  });
}
