/**
 * Mapping from Ghost CSS variable names to shadcn CSS variable names.
 *
 * This is the complete, authoritative mapping. Every Ghost source variable
 * corresponds to an entry in GHOST_THEME_CSS_VARS from the derivation engine.
 * The shadcn target variables are the names expected by shadcn/ui components.
 *
 * Order: semantically grouped (core, semantic, status, surface, foreground,
 * border, primary effects, interactive, chart, edge panels, window, geometry).
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

  // Status colors
  ["--ghost-warning", "--warning"],
  ["--ghost-warning-foreground", "--warning-foreground"],
  ["--ghost-warning-background", "--warning-background"],
  ["--ghost-success", "--success"],
  ["--ghost-success-foreground", "--success-foreground"],
  ["--ghost-success-background", "--success-background"],
  ["--ghost-info", "--info"],
  ["--ghost-info-foreground", "--info-foreground"],
  ["--ghost-info-background", "--info-background"],
  ["--ghost-error-foreground", "--destructive-foreground"],
  ["--ghost-error-background", "--destructive-background"],
  ["--ghost-error-foreground-muted", "--destructive-foreground-muted"],

  // Surface variants
  ["--ghost-surface-elevated", "--surface-elevated"],
  ["--ghost-surface-hover", "--surface-hover"],
  ["--ghost-surface-inset", "--surface-inset"],
  ["--ghost-surface-inset-deep", "--surface-inset-deep"],
  ["--ghost-surface-overlay", "--surface-overlay"],

  // Foreground variants
  ["--ghost-foreground-bright", "--foreground-bright"],
  ["--ghost-dim-foreground", "--dim-foreground"],
  ["--ghost-faint-foreground", "--faint-foreground"],
  ["--ghost-code-foreground", "--code-foreground"],

  // Border variants
  ["--ghost-border-muted", "--border-muted"],
  ["--ghost-border-alt", "--border-alt"],
  ["--ghost-border-accent", "--border-accent"],

  // Primary effects
  ["--ghost-primary-glow-subtle", "--primary-glow-subtle"],
  ["--ghost-primary-glow", "--primary-glow"],
  ["--ghost-primary-border-semi", "--primary-border-semi"],
  ["--ghost-primary-overlay", "--primary-overlay"],

  // Interactive states
  ["--ghost-hover-background", "--hover-background"],
  ["--ghost-active-background", "--active-background"],
  ["--ghost-cursor", "--cursor"],
  ["--ghost-selection-background", "--selection-background"],
  ["--ghost-selection-foreground", "--selection-foreground"],

  // Chart tokens
  ["--ghost-chart-1", "--chart-1"],
  ["--ghost-chart-2", "--chart-2"],
  ["--ghost-chart-3", "--chart-3"],
  ["--ghost-chart-4", "--chart-4"],
  ["--ghost-chart-5", "--chart-5"],

  // Sidebar tokens (mapped from edge-left)
  ["--ghost-edge-left", "--sidebar"],
  ["--ghost-edge-left-foreground", "--sidebar-foreground"],
  ["--ghost-edge-left-accent", "--sidebar-accent"],
  ["--ghost-edge-left-accent-foreground", "--sidebar-accent-foreground"],
  ["--ghost-edge-left-border", "--sidebar-border"],

  // Edge panels — top
  ["--ghost-edge-top", "--edge-top"],
  ["--ghost-edge-top-foreground", "--edge-top-foreground"],
  ["--ghost-edge-top-border", "--edge-top-border"],
  ["--ghost-edge-top-accent", "--edge-top-accent"],
  ["--ghost-edge-top-accent-foreground", "--edge-top-accent-foreground"],

  // Edge panels — bottom
  ["--ghost-edge-bottom", "--edge-bottom"],
  ["--ghost-edge-bottom-foreground", "--edge-bottom-foreground"],
  ["--ghost-edge-bottom-border", "--edge-bottom-border"],
  ["--ghost-edge-bottom-accent", "--edge-bottom-accent"],
  ["--ghost-edge-bottom-accent-foreground", "--edge-bottom-accent-foreground"],

  // Edge panels — right
  ["--ghost-edge-right", "--edge-right"],
  ["--ghost-edge-right-foreground", "--edge-right-foreground"],
  ["--ghost-edge-right-border", "--edge-right-border"],
  ["--ghost-edge-right-accent", "--edge-right-accent"],
  ["--ghost-edge-right-accent-foreground", "--edge-right-accent-foreground"],

  // Window / neutral tokens
  ["--ghost-opacity-active", "--opacity-active"],
  ["--ghost-opacity-inactive", "--opacity-inactive"],
  ["--ghost-border-active", "--border-active"],
  ["--ghost-border-inactive", "--border-inactive"],
  ["--ghost-border-size", "--border-size"],
  ["--ghost-neutral-background", "--neutral-background"],
  ["--ghost-background-opacity", "--background-opacity"],

  // Mode
  ["--ghost-mode", "--mode"],

  // Geometry tokens
  ["--ghost-radius", "--radius"],
] as const;
