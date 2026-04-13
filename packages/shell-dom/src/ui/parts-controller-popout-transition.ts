export function resolveClosedPopoutTransition(input: {
  popoutHandles: ReadonlyMap<string, { closed: boolean }>;
  poppedOutTabIds: ReadonlySet<string>;
}): { closedHandleIds: string[]; restoredTabIds: string[] } {
  const closedHandleIds: string[] = [];
  const restoredTabIds: string[] = [];

  for (const [tabId, handle] of input.popoutHandles.entries()) {
    if (!handle.closed) {
      continue;
    }

    closedHandleIds.push(tabId);

    if (!input.poppedOutTabIds.has(tabId)) {
      continue;
    }

    restoredTabIds.push(tabId);
  }

  return {
    closedHandleIds,
    restoredTabIds,
  };
}
