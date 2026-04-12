/**
 * Mapping from Ghost CSS variable names to shadcn CSS variable names.
 *
 * This is the complete, authoritative mapping. Every Ghost source variable
 * corresponds to an entry in GHOST_THEME_CSS_VARS from the derivation engine.
 * The shadcn target variables are the names expected by shadcn/ui components.
 *
 * Order: semantically grouped (core, semantic, chart, sidebar, geometry).
 */
export const GHOST_TO_SHADCN_MAP: ReadonlyArray<
  readonly [ghostVar: string, shadcnVar: string]
> = [
  // Core surface tokens
  ["--ghost-background", "--background"],
  ["--ghost-foreground", "--foreground"],
  ["--ghost-surface", "--card"],
  ["--ghost-surface-foreground", "--card-foreground"],
  ["--ghost-overlay", "--popover"],
  ["--ghost-overlay-foreground", "--popover-foreground"],

  // Brand / semantic tokens
  ["--ghost-primary", "--primary"],
  ["--ghost-primary-foreground", "--primary-foreground"],
  ["--ghost-secondary", "--secondary"],
  ["--ghost-secondary-foreground", "--secondary-foreground"],
  ["--ghost-muted", "--muted"],
  ["--ghost-muted-foreground", "--muted-foreground"],
  ["--ghost-accent", "--accent"],
  ["--ghost-accent-foreground", "--accent-foreground"],
  ["--ghost-error", "--destructive"],

  // Input / border tokens
  ["--ghost-border", "--border"],
  ["--ghost-input", "--input"],
  ["--ghost-ring", "--ring"],

  // Chart tokens
  ["--ghost-chart-1", "--chart-1"],
  ["--ghost-chart-2", "--chart-2"],
  ["--ghost-chart-3", "--chart-3"],
  ["--ghost-chart-4", "--chart-4"],
  ["--ghost-chart-5", "--chart-5"],

  // Sidebar tokens
  ["--ghost-sidebar", "--sidebar"],
  ["--ghost-sidebar-foreground", "--sidebar-foreground"],
  ["--ghost-sidebar-primary", "--sidebar-primary"],
  ["--ghost-sidebar-primary-foreground", "--sidebar-primary-foreground"],
  ["--ghost-sidebar-accent", "--sidebar-accent"],
  ["--ghost-sidebar-accent-foreground", "--sidebar-accent-foreground"],
  ["--ghost-sidebar-border", "--sidebar-border"],
  ["--ghost-sidebar-ring", "--sidebar-ring"],

  // Geometry tokens
  ["--ghost-radius", "--radius"],
] as const;
