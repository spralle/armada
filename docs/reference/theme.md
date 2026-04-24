# @ghost-shell/theme

## Purpose

Theme derivation, CSS variable injection, persistence, and background image management for the Ghost Shell design token system. Derives a full 73-token palette from a partial input and manages theme state in the DOM and localStorage.

## Installation

```bash
bun add @ghost-shell/theme
```

## Key Exports

### Palette Derivation

```ts
function deriveFullPalette(
  input: PartialThemePalette,
  terminal?: TerminalPalette | undefined,
): FullThemePalette;
```

Pure function that expands a partial palette (background, foreground, primary, etc.) into a complete set of semantic tokens including surface variants, foreground variants, border variants, and status tokens.

### CSS Variable Injection

```ts
const GHOST_THEME_CSS_VARS: Record<string, string>;
const THEME_TOKEN_GROUPS: Record<string, string[]>;

function injectThemeVariables(palette: FullThemePalette): void;
function removeThemeVariables(): void;
```

`injectThemeVariables` sets `--ghost-*` CSS custom properties on `document.documentElement`. `GHOST_THEME_CSS_VARS` maps token names to CSS variable names.

### Default Palette

```ts
const DEFAULT_DARK_PALETTE: FullThemePalette;
```

Pre-derived dark palette used as the shell's default theme.

### Color Utilities

```ts
function adjustLightness(color: string, delta: number): string;
function blendWithBackground(fg: string, bg: string, alpha: number): string;
function contrastSafe(fg: string, bg: string, minRatio?: number): string;
```

### Theme Persistence

```ts
interface ThemePreferenceData { mode: string; paletteId?: string }
interface BackgroundPreference { url?: string; opacity?: number }

function readUserThemePreference(): ThemePreferenceData | null;
function writeUserThemePreference(data: ThemePreferenceData): void;
function clearUserThemePreference(): void;

function readBackgroundPreference(): BackgroundPreference | null;
function writeBackgroundPreference(data: BackgroundPreference): void;
function clearBackgroundPreference(): void;
```

### Background Image Management

```ts
function resolveBackgroundUrl(entry: ThemeBackgroundEntry): string;
function preloadBackgroundUrls(entries: ThemeBackgroundEntry[]): void;

function manageBackgroundImage(
  backgrounds: ThemeBackgroundEntry[] | undefined,
): void;
```

`manageBackgroundImage` creates, updates, or removes a fullscreen background `<div>` behind all shell content.

## Examples

```ts
import {
  deriveFullPalette,
  injectThemeVariables,
  writeUserThemePreference,
  manageBackgroundImage,
} from "@ghost-shell/theme";

// Derive and apply a custom theme
const palette = deriveFullPalette({
  mode: "dark",
  background: "#1a1b26",
  foreground: "#c0caf5",
  primary: "#7aa2f7",
  surface: "#1f2335",
});

injectThemeVariables(palette);
writeUserThemePreference({ mode: "dark", paletteId: "tokyo-night" });

// Apply a background image
manageBackgroundImage([{ url: "/bg.jpg", opacity: 0.15 }]);
```
