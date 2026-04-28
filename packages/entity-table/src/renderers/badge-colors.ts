/**
 * Shared color palette and utilities for badge/tag auto-coloring.
 * Uses Tailwind alpha utilities that blend with all themes.
 */

export const COLOR_PALETTE: readonly string[] = [
  'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/25',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
  'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25',
  'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/25',
  'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25',
  'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/25',
  'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/25',
  'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/25',
];

/** Named color shortcuts for explicit colorMap values */
export const NAMED_COLORS: Record<string, string> = {
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
 * Resolve color class for a badge value.
 * Priority: explicit colorMap → named color shortcut → auto-hash from palette
 */
export function resolveColorClass(
  value: string,
  colorMap?: Record<string, string>,
): string {
  if (colorMap) {
    const mapped = colorMap[value];
    if (mapped) {
      return NAMED_COLORS[mapped] ?? mapped;
    }
  }
  return COLOR_PALETTE[stableHash(value) % COLOR_PALETTE.length];
}
