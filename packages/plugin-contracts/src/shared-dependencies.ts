/**
 * Canonical list of packages that must be shared as singletons across
 * the Module Federation boundary. Both the shell host and every plugin
 * remote should reference this list when configuring MF shared deps.
 */
export const MF_SHARED_SINGLETONS = [
  "@ghost-shell/contracts",
  "@ghost-shell/ui",
] as const;

export type MfSharedSingleton = (typeof MF_SHARED_SINGLETONS)[number];
