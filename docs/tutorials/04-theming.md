# Tutorial 04: Theming

## What you'll learn

- How Ghost's design token system works
- How to use `--ghost-*` CSS custom properties in components
- How to create a theme plugin
- How to build theme-aware components that adapt automatically

## The Ghost token system

Ghost Shell uses CSS custom properties (variables) prefixed with `--ghost-*` for all visual styling. These tokens are set on `:root` by the active theme and inherited by every element in the DOM — including plugin micro-frontends.

The system has three tiers:

1. **Core tokens (24)** — provided by theme authors (only 3 are required)
2. **Derived tokens (23)** — computed automatically by the derivation engine
3. **Total: 47 tokens** — a complete palette from as few as 3 input values

### Required tokens

| Token | CSS Variable | Description |
|---|---|---|
| `background` | `--ghost-background` | App background color |
| `foreground` | `--ghost-foreground` | Default text color |
| `accent` or `primary` | `--ghost-accent` / `--ghost-primary` | At least one brand color |

Everything else is derived automatically.

## Using tokens in components

### CSS custom properties (recommended)

```tsx
export function StatusCard({ title, ok }: { title: string; ok: boolean }) {
  return (
    <div
      style={{
        backgroundColor: "var(--ghost-surface)",
        color: "var(--ghost-foreground)",
        border: "1px solid var(--ghost-border)",
        borderRadius: "var(--ghost-radius)",
        padding: "1rem",
      }}
    >
      <h4 style={{ color: "var(--ghost-primary)" }}>{title}</h4>
      <span
        style={{
          color: ok ? "var(--ghost-success)" : "var(--ghost-error)",
        }}
      >
        {ok ? "Healthy" : "Error"}
      </span>
    </div>
  );
}
```

### CSS stylesheets

```css
/* styles.css */
.status-card {
  background-color: var(--ghost-surface);
  color: var(--ghost-foreground);
  border: 1px solid var(--ghost-border);
  border-radius: var(--ghost-radius);
  padding: 1rem;
}

.status-card__title {
  color: var(--ghost-primary);
}

.status-card__badge--ok {
  color: var(--ghost-success);
}

.status-card__badge--error {
  color: var(--ghost-error);
}
```

### Common token reference

| Token | CSS Variable | Use for |
|---|---|---|
| `--ghost-background` | App background | Page/app background |
| `--ghost-foreground` | Default text | Body text |
| `--ghost-surface` | Elevated surface | Cards, panels |
| `--ghost-overlay` | Overlay background | Modals, dropdowns |
| `--ghost-primary` | Primary brand | Buttons, links |
| `--ghost-primary-foreground` | Text on primary | Button labels |
| `--ghost-accent` | Accent highlight | Active states |
| `--ghost-secondary` | Secondary color | Less prominent actions |
| `--ghost-muted` | Muted background | Disabled areas |
| `--ghost-muted-foreground` | Muted text | Placeholder text |
| `--ghost-border` | Border color | Dividers, outlines |
| `--ghost-error` | Error semantic | Error messages |
| `--ghost-warning` | Warning semantic | Warning badges |
| `--ghost-success` | Success semantic | Success indicators |
| `--ghost-info` | Info semantic | Info callouts |
| `--ghost-radius` | Border radius | Consistent rounding |
| `--ghost-ring` | Focus ring | Focus indicators |

## Create a theme plugin

### 1. Scaffold the plugin

```bash
bun run scaffold:plugin -- --name my-theme
```

### 2. Define the theme in the manifest

Replace `src/manifest.ts`:

```ts
import { definePlugin } from "@ghost-shell/contracts";

export const pluginManifest = definePlugin({
  manifest: {
    id: "ghost.my-theme",
    name: "My Theme",
    version: "1.0.0",
  },
  activationEvents: ["onStartup"],
  contributes: {
    themes: [
      {
        id: "ghost.my-theme.dark",
        name: "My Dark Theme",
        mode: "dark",
        palette: {
          background: "#1e1e2e",
          foreground: "#cdd6f4",
          accent: "#89b4fa",
        },
      },
      {
        id: "ghost.my-theme.light",
        name: "My Light Theme",
        mode: "light",
        palette: {
          background: "#eff1f5",
          foreground: "#4c4f69",
          accent: "#1e66f5",
        },
      },
    ],
  },
});
```

Key points:

- **`activationEvents: ["onStartup"]`** — theme plugins must activate on startup so palettes are available before the UI renders
- **`mode`** — `"dark"` or `"light"` controls the derivation direction (lightness shifts are inverted in light mode)
- **`palette`** — minimum 3 values; add more to override derivation

### 3. Provide more palette values (optional)

For precise control, override specific derived tokens:

```ts
palette: {
  background: "#1e1e2e",
  foreground: "#cdd6f4",
  accent: "#89b4fa",
  primary: "#cba6f7",
  surface: "#313244",
  border: "#45475a",
  error: "#f38ba8",
  warning: "#fab387",
  success: "#a6e3a1",
  info: "#74c7ec",
  radius: "0.5rem",
},
```

### 4. Add terminal colors (optional)

For Omarchy-compatible themes, include ANSI terminal colors:

```ts
terminal: {
  color0: "#45475a",
  color1: "#f38ba8",   // maps to error
  color2: "#a6e3a1",   // maps to success
  color3: "#f9e2af",   // maps to warning
  color4: "#89b4fa",
  color5: "#f5c2e7",
  color6: "#94e2d5",   // maps to info
  color7: "#bac2de",
  color8: "#585b70",
  color9: "#f38ba8",
  color10: "#a6e3a1",
  color11: "#f9e2af",
  color12: "#89b4fa",
  color13: "#f5c2e7",
  color14: "#94e2d5",
  color15: "#a6adc8",
},
```

### 5. Add background images (optional)

```ts
themes: [
  {
    id: "ghost.my-theme.dark",
    name: "My Dark Theme",
    mode: "dark",
    palette: {
      background: "#1e1e2e",
      foreground: "#cdd6f4",
      accent: "#89b4fa",
      opacity: 0.92,
    },
    backgrounds: [
      { url: "/assets/wallpaper.jpg", mode: "cover" },
    ],
  },
],
```

The `opacity` token controls panel transparency so the background image shows through.

## Rules for theme-aware plugins

1. **Never hardcode hex/rgb values** — always use `var(--ghost-*)` tokens
2. **Use semantic names** — `--ghost-error` not "red", `--ghost-primary` not "blue"
3. **No `!important`** — tokens cascade naturally through CSS inheritance
4. **Test both modes** — verify your component looks correct in both dark and light themes

## Next steps

Your components now adapt to any theme. In [Tutorial 05: Services and Context](./05-services-and-context.md), you'll learn how to register services and share reactive state between plugins.
