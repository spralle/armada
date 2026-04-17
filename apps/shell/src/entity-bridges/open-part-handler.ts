const OPEN_PART_PREFIX = "open-part:";

/**
 * Check whether a handler string uses the open-part convention.
 * Open-part handlers have the form `open-part:<partDefinitionId>`.
 */
export function isOpenPartHandler(handler: string): boolean {
  return handler.startsWith(OPEN_PART_PREFIX);
}

/**
 * Extract the part definition ID from an open-part handler string.
 * Returns `null` if the handler is not an open-part handler or if the
 * definition ID portion is empty.
 */
export function extractPartDefinitionId(handler: string): string | null {
  if (!handler.startsWith(OPEN_PART_PREFIX)) {
    return null;
  }
  const id = handler.slice(OPEN_PART_PREFIX.length);
  return id.length > 0 ? id : null;
}
