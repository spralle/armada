/**
 * Shared color palette and utilities for badge/tag auto-coloring.
 * Uses inline styles with oklch for guaranteed dark-theme visibility.
 */

export interface BadgeColorStyle {
  readonly backgroundColor: string;
  readonly color: string;
  readonly borderColor: string;
}

const COLOR_PALETTE: readonly BadgeColorStyle[] = [
  {
    backgroundColor: "oklch(0.55 0.18 250 / 0.15)",
    color: "oklch(0.78 0.15 250)",
    borderColor: "oklch(0.55 0.18 250 / 0.3)",
  }, // blue
  {
    backgroundColor: "oklch(0.55 0.17 160 / 0.15)",
    color: "oklch(0.78 0.14 160)",
    borderColor: "oklch(0.55 0.17 160 / 0.3)",
  }, // emerald
  {
    backgroundColor: "oklch(0.60 0.15 85 / 0.15)",
    color: "oklch(0.82 0.12 85)",
    borderColor: "oklch(0.60 0.15 85 / 0.3)",
  }, // amber
  {
    backgroundColor: "oklch(0.55 0.18 300 / 0.15)",
    color: "oklch(0.78 0.15 300)",
    borderColor: "oklch(0.55 0.18 300 / 0.3)",
  }, // violet
  {
    backgroundColor: "oklch(0.55 0.20 25 / 0.15)",
    color: "oklch(0.78 0.16 25)",
    borderColor: "oklch(0.55 0.20 25 / 0.3)",
  }, // rose
  {
    backgroundColor: "oklch(0.55 0.12 200 / 0.15)",
    color: "oklch(0.78 0.10 200)",
    borderColor: "oklch(0.55 0.12 200 / 0.3)",
  }, // cyan
  {
    backgroundColor: "oklch(0.60 0.16 55 / 0.15)",
    color: "oklch(0.82 0.13 55)",
    borderColor: "oklch(0.60 0.16 55 / 0.3)",
  }, // orange
  {
    backgroundColor: "oklch(0.55 0.18 330 / 0.15)",
    color: "oklch(0.78 0.15 330)",
    borderColor: "oklch(0.55 0.18 330 / 0.3)",
  }, // fuchsia
];

/** Named color shortcuts for explicit colorMap values */
const NAMED_COLORS: Record<string, BadgeColorStyle> = {
  blue: COLOR_PALETTE[0],
  green: COLOR_PALETTE[1],
  emerald: COLOR_PALETTE[1],
  amber: COLOR_PALETTE[2],
  yellow: COLOR_PALETTE[2],
  violet: COLOR_PALETTE[3],
  purple: COLOR_PALETTE[3],
  rose: COLOR_PALETTE[4],
  red: COLOR_PALETTE[4],
  cyan: COLOR_PALETTE[5],
  teal: COLOR_PALETTE[5],
  orange: COLOR_PALETTE[6],
  fuchsia: COLOR_PALETTE[7],
  pink: COLOR_PALETTE[7],
};

/** Stable hash for auto-assigning colors deterministically */
export function stableHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Resolve color style for a badge value.
 * Priority: explicit colorMap → named color shortcut → auto-hash from palette
 */
export function resolveColorStyle(value: string, colorMap?: Record<string, string>): BadgeColorStyle {
  if (colorMap) {
    const mapped = colorMap[value];
    if (mapped) {
      return NAMED_COLORS[mapped] ?? COLOR_PALETTE[stableHash(mapped) % COLOR_PALETTE.length];
    }
  }
  return COLOR_PALETTE[stableHash(value) % COLOR_PALETTE.length];
}
