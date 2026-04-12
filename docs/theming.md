# Theming

Ghost's theme system lets plugins define and switch color palettes at runtime through CSS custom properties. Themes are first-class plugin contributions — not a separate configuration layer.

## Architecture Overview

```
Plugin Contract                 Shell Theme Registry          DOM
┌─────────────────────┐        ┌────────────────────┐       ┌──────────┐
│ contributes.themes  │──────> │ deriveFullPalette() │─────> │ :root    │
│   partial palette   │        │ 3 → 42 tokens      │       │ --ghost-*│
│   terminal colors   │        │                    │       │ CSS vars │
└─────────────────────┘        └────────────────────┘       └──────────┘
```

Key concepts:

- **Themes as plugins**: A theme is a `contributes.themes` entry in a plugin contract. Themes are discovered, composed, and applied the same way as other plugin contributions.
- **CSS custom properties**: All visual tokens are exposed as `--ghost-*` CSS variables on `:root`. Any component in any micro-frontend can consume them without importing JavaScript.
- **Derivation engine**: A pure function in `@ghost/plugin-contracts` expands a minimum 3-value palette to the full 42-token set. Plugin authors supply what they know; the engine fills the rest.
- **Bridge plugin pattern**: Ghost's canonical tokens (`--ghost-*`) are decoupled from any UI library. A separate bridge plugin maps them to library-specific variables (e.g., shadcn's `--primary`, `--card`).

## Token Reference

Ghost's theme system defines **19 core tokens** and **23 derived tokens** (42 total). Core tokens can be provided directly in the palette; derived tokens are computed by the derivation engine but can be influenced through the core inputs.

### Core Tokens (19)

| Token | CSS Variable | Required | Description |
|---|---|---|---|
| `mode` | `--ghost-mode` | Auto (`"dark"`) | `"dark"` or `"light"` — controls derivation direction |
| `background` | `--ghost-background` | **Yes** | App background color |
| `foreground` | `--ghost-foreground` | **Yes** | Default text color |
| `primary` | `--ghost-primary` | One of primary/accent | Primary brand/action color |
| `accent` | `--ghost-accent` | One of primary/accent | Accent highlight color |
| `secondary` | `--ghost-secondary` | No | Secondary color (derived: desaturated primary) |
| `surface` | `--ghost-surface` | No | Elevated surface background (derived: background +6% L) |
| `overlay` | `--ghost-overlay` | No | Overlay/modal background (derived: background +10% L) |
| `muted` | `--ghost-muted` | No | Muted/disabled background (derived: background +3% L) |
| `error` | `--ghost-error` | No | Error semantic color (fallback: `#ef4444` or terminal color1) |
| `warning` | `--ghost-warning` | No | Warning semantic color (fallback: `#f59e0b` or terminal color3) |
| `success` | `--ghost-success` | No | Success semantic color (fallback: `#22c55e` or terminal color2) |
| `info` | `--ghost-info` | No | Info semantic color (fallback: `#3b82f6` or terminal color6) |
| `border` | `--ghost-border` | No | Border color (derived: background +15% L) |
| `ring` | `--ghost-ring` | No | Focus ring color (derived: primary) |
| `cursor` | `--ghost-cursor` | No | Cursor color (derived: foreground) |
| `selectionBackground` | `--ghost-selection-background` | No | Selection highlight background (derived: primary) |
| `radius` | `--ghost-radius` | No | Border radius value (default: `0.625rem`) |
| `opacity` | `--ghost-background-opacity` | No | Background opacity 0–1 (default: `1.0`). Controls panel transparency to let background images show through |

### Derived Tokens (23)

These are computed by the derivation engine. Plugin authors never need to set them directly.

| Token | CSS Variable | Derivation Source |
|---|---|---|
| `surfaceForeground` | `--ghost-surface-foreground` | Same as `foreground` |
| `overlayForeground` | `--ghost-overlay-foreground` | Same as `foreground` |
| `primaryForeground` | `--ghost-primary-foreground` | WCAG contrast against `primary` (`#fff` or `#000`) |
| `secondaryForeground` | `--ghost-secondary-foreground` | WCAG contrast against `secondary` |
| `accentForeground` | `--ghost-accent-foreground` | WCAG contrast against `accent` |
| `mutedForeground` | `--ghost-muted-foreground` | Blend `foreground` into `background` at 60% opacity |
| `input` | `--ghost-input` | Same as `border` |
| `selectionForeground` | `--ghost-selection-foreground` | Same as `foreground` |
| `hoverBackground` | `--ghost-hover-background` | Surface +3% lightness |
| `activeBackground` | `--ghost-active-background` | Surface +6% lightness |
| `chart1` | `--ghost-chart-1` | `primary` |
| `chart2` | `--ghost-chart-2` | `secondary` |
| `chart3` | `--ghost-chart-3` | `accent` |
| `chart4` | `--ghost-chart-4` | `success` |
| `chart5` | `--ghost-chart-5` | `warning` |
| `sidebar` | `--ghost-sidebar` | Surface -3% lightness |
| `sidebarForeground` | `--ghost-sidebar-foreground` | Same as `foreground` |
| `sidebarPrimary` | `--ghost-sidebar-primary` | Same as `primary` |
| `sidebarPrimaryForeground` | `--ghost-sidebar-primary-foreground` | Same as `primaryForeground` |
| `sidebarAccent` | `--ghost-sidebar-accent` | Same as `accent` |
| `sidebarAccentForeground` | `--ghost-sidebar-accent-foreground` | Same as `accentForeground` |
| `sidebarBorder` | `--ghost-sidebar-border` | Same as `border` |
| `sidebarRing` | `--ghost-sidebar-ring` | Same as `ring` |

> **Note on lightness direction**: In dark mode, "+" means brighter and "-" means darker. In light mode, the sign is inverted so "surface" is always slightly elevated relative to the background.

## Creating a Theme Plugin

### 1. Scaffold the plugin

Create a new plugin app (see the [plugin scaffold docs](../templates/plugin-app/README.md.template) for the full workflow), or add themes to an existing plugin.

### 2. Define the plugin contract with `contributes.themes`

```ts
import type { PluginContract } from "@ghost/plugin-contracts";

export const pluginContract: PluginContract = {
  manifest: {
    id: "com.example.my-theme",
    name: "My Theme",
    version: "1.0.0",
  },
  activationEvents: ["onStartup"],
  contributes: {
    themes: [
      {
        id: "com.example.my-theme.dark",
        name: "My Dark Theme",
        mode: "dark",
        palette: {
          background: "#1e1e2e",
          foreground: "#cdd6f4",
          accent: "#89b4fa",
        },
      },
    ],
  },
};
```

### 3. Set `activationEvents: ["onStartup"]`

Theme plugins must activate on startup so their palettes are available before the UI renders. Without this, the theme contribution would not be discovered until a later activation event.

### 4. Define the palette

At minimum, provide three values:

| Field | Purpose |
|---|---|
| `background` | Base background color (hex) |
| `foreground` | Default text color (hex) |
| `accent` and/or `primary` | At least one accent/brand color (hex) |

Everything else is derived automatically. Provide more tokens to override derivation when you need precise control.

### 5. Register the plugin in the backend

Add the plugin entry to the tenant plugin manifest so the shell discovers it. The theme registry calls `discoverThemes()` during shell bootstrap, which iterates all active plugins' `contributes.themes` arrays.

### 6. Test

Switch themes at runtime via the shell command palette or the theme registry API:

```ts
const registry = createThemeRegistry({ pluginRegistry });
registry.discoverThemes();
registry.setTheme("com.example.my-theme.dark");
```

Verify that all UI surfaces update immediately without page reload.

## Palette Format

### Minimum (3 values)

```ts
palette: {
  background: "#1a1b26",
  foreground: "#a9b1d6",
  accent: "#7aa2f7",
}
```

The derivation engine computes all 42 tokens from these three values.

### Full 18 core tokens

```ts
palette: {
  background: "#14161a",
  foreground: "#e9edf3",
  surface: "#121922",
  overlay: "#101723",
  primary: "#7cb4ff",
  secondary: "#495f87",
  accent: "#7cb4ff",
  muted: "#2b3040",
  error: "#8b3030",
  warning: "#f2a65a",
  success: "#22c55e",
  info: "#3b82f6",
  border: "#334564",
  ring: "#7cb4ff",
  cursor: "#e9edf3",
  selectionBackground: "#7cb4ff",
  radius: "0.625rem",
}
```

### With terminal colors (Omarchy compatibility)

```ts
palette: {
  background: "#1a1b26",
  foreground: "#a9b1d6",
  accent: "#7aa2f7",
},
terminal: {
  color0: "#32344a",   // black
  color1: "#f7768e",   // red     → error (if not set in palette)
  color2: "#9ece6a",   // green   → success (if not set in palette)
  color3: "#e0af68",   // yellow  → warning (if not set in palette)
  color4: "#7aa2f7",   // blue
  color5: "#ad8ee6",   // magenta
  color6: "#449dab",   // cyan    → info (if not set in palette)
  color7: "#787c99",   // white
  color8: "#444b6a",   // bright black
  color9: "#ff7a93",   // bright red
  color10: "#b9f27c",  // bright green
  color11: "#ff9e64",  // bright yellow
  color12: "#7da6ff",  // bright blue
  color13: "#bb9af7",  // bright magenta
  color14: "#0db9d7",  // bright cyan
  color15: "#acb0d0",  // bright white
}
```

### Derivation behavior

When a core token is missing, the derivation engine resolves it in this order:

1. **Explicit value** in `palette` (always wins)
2. **Terminal color mapping** (for `error`, `warning`, `success`, `info` only)
3. **Computed fallback** using color math on other tokens

The engine uses HSL adjustments (lightness shifts), WCAG contrast calculations, and color blending to produce visually coherent derived tokens.

## Omarchy Theme Porting Guide

[Omarchy](https://github.com/nicholasgasior/omarchy) themes are defined in `colors.toml` with a small set of named colors. Here is how to map them to a Ghost theme contribution.

### Mapping table

| Omarchy field | Ghost palette field | Notes |
|---|---|---|
| `accent` | `accent` (or `primary`) | Primary brand color |
| `background` | `background` | Direct mapping |
| `foreground` | `foreground` | Direct mapping |
| `cursor` | `cursor` | Cursor color |
| `selection_foreground` | Not a core palette field | Set via `selectionForeground` in derived |
| `selection_background` | `selectionBackground` | Selection highlight |
| `color0`–`color15` | `terminal.color0`–`terminal.color15` | ANSI terminal colors |

### Terminal-to-semantic mapping

The derivation engine automatically maps Omarchy terminal colors to semantic tokens when those tokens are not explicitly set:

| Terminal color | Semantic token |
|---|---|
| `color1` (red) | `error` |
| `color2` (green) | `success` |
| `color3` (yellow) | `warning` |
| `color6` (cyan) | `info` |

### Example: Porting Tokyo Night

**Omarchy `colors.toml`**:

```toml
[colors]
accent = "#7aa2f7"
background = "#1a1b26"
foreground = "#a9b1d6"
cursor = "#c0caf5"
selection_background = "#7aa2f7"

[colors.terminal]
color0 = "#32344a"
color1 = "#f7768e"
color2 = "#9ece6a"
color3 = "#e0af68"
color4 = "#7aa2f7"
color5 = "#ad8ee6"
color6 = "#449dab"
color7 = "#787c99"
color8 = "#444b6a"
color9 = "#ff7a93"
color10 = "#b9f27c"
color11 = "#ff9e64"
color12 = "#7da6ff"
color13 = "#bb9af7"
color14 = "#0db9d7"
color15 = "#acb0d0"
```

**Ghost theme contribution**:

```ts
{
  id: "ghost.theme.tokyo-night",
  name: "Tokyo Night",
  mode: "dark",
  palette: {
    background: "#1a1b26",
    foreground: "#a9b1d6",
    accent: "#7aa2f7",
    cursor: "#c0caf5",
    selectionBackground: "#7aa2f7",
  },
  terminal: {
    color0: "#32344a",
    color1: "#f7768e",   // → error
    color2: "#9ece6a",   // → success
    color3: "#e0af68",   // → warning
    color4: "#7aa2f7",
    color5: "#ad8ee6",
    color6: "#449dab",   // → info
    color7: "#787c99",
    color8: "#444b6a",
    color9: "#ff7a93",
    color10: "#b9f27c",
    color11: "#ff9e64",
    color12: "#7da6ff",
    color13: "#bb9af7",
    color14: "#0db9d7",
    color15: "#acb0d0",
  },
}
```

That's all it takes — 5 palette fields plus the 16 terminal colors. The derivation engine produces the full 42-token palette from this input.

## UI Library Bridge Pattern

Ghost's theme tokens are intentionally independent of any UI component library. Integration with a specific library (shadcn/ui, Radix, Material, etc.) happens through a **bridge plugin**.

### How it works

1. Ghost defines canonical tokens: `--ghost-primary`, `--ghost-background`, `--ghost-border`, etc.
2. A bridge plugin reads `--ghost-*` values and writes the library's expected variables.
3. The library's components consume their own variables as usual.

### shadcn/ui bridge example

A shadcn bridge plugin maps Ghost tokens to shadcn's CSS variable convention:

```css
:root {
  --primary: var(--ghost-primary);
  --primary-foreground: var(--ghost-primary-foreground);
  --background: var(--ghost-background);
  --foreground: var(--ghost-foreground);
  --card: var(--ghost-surface);
  --card-foreground: var(--ghost-surface-foreground);
  --popover: var(--ghost-overlay);
  --popover-foreground: var(--ghost-overlay-foreground);
  --secondary: var(--ghost-secondary);
  --secondary-foreground: var(--ghost-secondary-foreground);
  --muted: var(--ghost-muted);
  --muted-foreground: var(--ghost-muted-foreground);
  --accent: var(--ghost-accent);
  --accent-foreground: var(--ghost-accent-foreground);
  --destructive: var(--ghost-error);
  --border: var(--ghost-border);
  --input: var(--ghost-input);
  --ring: var(--ghost-ring);
  --radius: var(--ghost-radius);
  --chart-1: var(--ghost-chart-1);
  --chart-2: var(--ghost-chart-2);
  --chart-3: var(--ghost-chart-3);
  --chart-4: var(--ghost-chart-4);
  --chart-5: var(--ghost-chart-5);
  --sidebar-background: var(--ghost-sidebar);
  --sidebar-foreground: var(--ghost-sidebar-foreground);
  --sidebar-primary: var(--ghost-sidebar-primary);
  --sidebar-primary-foreground: var(--ghost-sidebar-primary-foreground);
  --sidebar-accent: var(--ghost-sidebar-accent);
  --sidebar-accent-foreground: var(--ghost-sidebar-accent-foreground);
  --sidebar-border: var(--ghost-sidebar-border);
  --sidebar-ring: var(--ghost-sidebar-ring);
}
```

### Decoupling

- **Disable the bridge** to decouple Ghost from the UI library entirely.
- **Swap the bridge** to move to a different library without changing any theme plugin.
- **Multiple bridges** can coexist if the shell uses components from more than one library.

The bridge plugin itself is a standard Ghost plugin that sets `activationEvents: ["onStartup"]` and contributes nothing except the CSS mapping.

## Background Images

Themes can include background images that render behind all shell content, producing a wallpaper-like effect similar to [Omarchy](https://github.com/basecamp/omarchy).

### How it works

Omarchy uses compositor-level window transparency (0.97 active, 0.9 inactive) to let desktop wallpaper images show through semi-transparent application windows. Ghost translates this pattern to the web:

1. A **`<div id="ghost-theme-background">`** is injected as a fixed, full-viewport element behind all content when the active theme includes a `backgrounds` array.
2. The **`opacity` token** (`--ghost-background-opacity`) controls how transparent panels and surfaces are, letting the background show through.

### Declaring a background

```ts
{
  id: "ghost.theme.forest",
  name: "Forest",
  mode: "dark",
  palette: {
    background: "#1a1b26",
    foreground: "#a9b1d6",
    accent: "#7aa2f7",
    opacity: 0.9,
  },
  backgrounds: [
    { url: "https://cdn.example.com/forest.jpg", mode: "cover" },
  ],
}
```

### Background modes

| Mode | CSS behavior | Use case |
|---|---|---|
| `"cover"` (default) | `background-size: cover` | Full-bleed photo wallpapers |
| `"contain"` | `background-size: contain` | Images that should not be cropped |
| `"tile"` | `background-size: auto; background-repeat: repeat` | Patterns and textures |

### Using the opacity token

Apply `--ghost-background-opacity` to panel or surface elements so the background image shows through:

```css
.panel {
  background-color: var(--ghost-surface);
  opacity: var(--ghost-background-opacity);
}
```

When a theme sets `opacity: 0.9`, panels become slightly transparent. When no opacity is specified, it defaults to `1.0` (fully opaque, no show-through).

## Branding vs Themes

Ghost separates **branding** and **themes** as distinct plugin contribution types.

| | Theme (`contributes.themes`) | Branding (`contributes.branding`) |
|---|---|---|
| **Purpose** | Visual aesthetics — colors, fonts, backgrounds | Organizational identity — logo, favicon, app name |
| **Controlled by** | User preference (per-user switching) | Tenant administrator |
| **Switchable** | Yes, users can change their theme at any time | No, set by tenant deployment configuration |
| **Examples** | Dark palette, light palette, Tokyo Night | Company logo, favicon, app title |

Both are declared in plugin contracts:

```ts
contributes: {
  themes: [{ id: "...", name: "...", mode: "dark", palette: { ... } }],
  branding: {
    appName: "My Company App",
    logo: { dark: "/assets/logo-dark.svg", light: "/assets/logo-light.svg" },
    favicon: "/assets/favicon.ico",
  },
}
```

A single plugin can contribute both themes and branding, or they can come from separate plugins. Theme resolution follows the chain: **user preference** (localStorage) > **tenant default** > **first available**.

## Plugin Styling Guide

Plugins that render UI should consume Ghost theme tokens via CSS custom properties.

### Use `var(--ghost-*)` for all colors

```css
.my-widget {
  background-color: var(--ghost-surface);
  color: var(--ghost-foreground);
  border: 1px solid var(--ghost-border);
}

.my-widget-header {
  background-color: var(--ghost-primary);
  color: var(--ghost-primary-foreground);
}

.my-widget-error {
  color: var(--ghost-error);
}
```

### Never hardcode hex values

```css
/* Bad — breaks when the user switches themes */
.my-widget {
  background-color: #1e1e2e;
  color: #cdd6f4;
}

/* Good — automatically adapts to the active theme */
.my-widget {
  background-color: var(--ghost-background);
  color: var(--ghost-foreground);
}
```

### CSS works across federated boundaries

Because `--ghost-*` variables are set on `:root`, they are inherited by all elements in the DOM — including those rendered by micro-frontend (MF2) plugin iframes and web components. No JavaScript import is needed; CSS custom property inheritance handles it.

### Semantic tokens, not physical names

Use tokens that describe _function_, not _appearance_:

```css
/* Bad — what does "blue" mean when the theme changes? */
color: var(--ghost-primary);  /* not "blue" */

/* Good — intent is clear */
.action-button {
  background: var(--ghost-primary);
  color: var(--ghost-primary-foreground);
}

.status-ok {
  color: var(--ghost-success);
}
```

### Inline styles (React example)

```tsx
function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        color: ok ? "var(--ghost-success)" : "var(--ghost-error)",
        backgroundColor: "var(--ghost-surface)",
        borderRadius: "var(--ghost-radius)",
      }}
    >
      {ok ? "Healthy" : "Error"}
    </span>
  );
}
```
