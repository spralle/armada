# Tailwind CSS for Plugin Authors

Use Tailwind CSS utility classes in your plugin's React components with full access to Ghost design tokens.

## How It Works

Every Ghost theme color is available as a standard Tailwind utility class. The pipeline:

1. **Ghost Theme Engine** sets `--ghost-*` CSS custom properties on `:root`
2. **shadcn-theme-bridge-plugin** maps `--ghost-*` → intermediate vars (`--background`, `--primary`, etc.)
3. **`@ghost/ui/theme.css`** maps intermediates → Tailwind `--color-*` tokens
4. **Result**: `bg-primary` resolves to the current Ghost theme's primary color at runtime

Each plugin compiles its own Tailwind CSS — no build-time coordination with other plugins needed.

## Quick Setup

### Step 1: Add devDependencies

```json
{
  "devDependencies": {
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0"
  }
}
```

### Step 2: Create CSS entry point

Create `src/styles/tailwind.css`:

```css
@import "tailwindcss/utilities";
@import "@ghost/ui/theme.css";
```

> **Important**: Use `tailwindcss/utilities`, not `tailwindcss`. The shell already provides preflight and base styles.

### Step 3: Wire Vite config and import

```typescript
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    // ... other plugins
  ],
});
```

Import the CSS in your plugin entry:

```typescript
import "./styles/tailwind.css";
```

That's it. You can now use `bg-primary`, `text-muted-foreground`, `border-border`, etc.

## Token Reference

All tokens below are usable with `bg-*`, `text-*`, and `border-*` Tailwind prefixes.

### Core

| Ghost Token | Tailwind Name | Usage |
|---|---|---|
| `--ghost-background` | `background` | `bg-background` `text-background` |
| `--ghost-foreground` | `foreground` | `bg-foreground` `text-foreground` |
| `--ghost-surface` | `card` | `bg-card` `text-card` |
| `--ghost-surface-foreground` | `card-foreground` | `text-card-foreground` |
| `--ghost-overlay` | `popover` | `bg-popover` |
| `--ghost-overlay-foreground` | `popover-foreground` | `text-popover-foreground` |

### Brand / Semantic

| Ghost Token | Tailwind Name | Usage |
|---|---|---|
| `--ghost-primary` | `primary` | `bg-primary` `text-primary` `border-primary` |
| `--ghost-primary-foreground` | `primary-foreground` | `text-primary-foreground` |
| `--ghost-secondary` | `secondary` | `bg-secondary` `text-secondary` |
| `--ghost-secondary-foreground` | `secondary-foreground` | `text-secondary-foreground` |
| `--ghost-muted` | `muted` | `bg-muted` `text-muted` |
| `--ghost-muted-foreground` | `muted-foreground` | `text-muted-foreground` |
| `--ghost-accent` | `accent` | `bg-accent` `text-accent` |
| `--ghost-accent-foreground` | `accent-foreground` | `text-accent-foreground` |
| `--ghost-error` | `destructive` | `bg-destructive` `text-destructive` |

### Input / Border

| Ghost Token | Tailwind Name | Usage |
|---|---|---|
| `--ghost-border` | `border` | `border-border` |
| `--ghost-input` | `input` | `border-input` `bg-input` |
| `--ghost-ring` | `ring` | `ring-ring` |

### Status Colors

| Ghost Token | Tailwind Name | Usage |
|---|---|---|
| `--ghost-warning` | `warning` | `bg-warning` `text-warning` |
| `--ghost-warning-foreground` | `warning-foreground` | `text-warning-foreground` |
| `--ghost-warning-background` | `warning-background` | `bg-warning-background` |
| `--ghost-success` | `success` | `bg-success` `text-success` |
| `--ghost-success-foreground` | `success-foreground` | `text-success-foreground` |
| `--ghost-success-background` | `success-background` | `bg-success-background` |
| `--ghost-info` | `info` | `bg-info` `text-info` |
| `--ghost-info-foreground` | `info-foreground` | `text-info-foreground` |
| `--ghost-info-background` | `info-background` | `bg-info-background` |
| `--ghost-error-foreground` | `destructive-foreground` | `text-destructive-foreground` |
| `--ghost-error-background` | `destructive-background` | `bg-destructive-background` |
| `--ghost-error-foreground-muted` | `destructive-foreground-muted` | `text-destructive-foreground-muted` |

### Surface Variants

| Ghost Token | Tailwind Name | Usage |
|---|---|---|
| `--ghost-surface-elevated` | `surface-elevated` | `bg-surface-elevated` |
| `--ghost-surface-hover` | `surface-hover` | `bg-surface-hover` |
| `--ghost-surface-inset` | `surface-inset` | `bg-surface-inset` |
| `--ghost-surface-inset-deep` | `surface-inset-deep` | `bg-surface-inset-deep` |
| `--ghost-surface-overlay` | `surface-overlay` | `bg-surface-overlay` |

### Foreground Variants

| Ghost Token | Tailwind Name | Usage |
|---|---|---|
| `--ghost-foreground-bright` | `foreground-bright` | `text-foreground-bright` |
| `--ghost-dim-foreground` | `dim-foreground` | `text-dim-foreground` |
| `--ghost-faint-foreground` | `faint-foreground` | `text-faint-foreground` |
| `--ghost-code-foreground` | `code-foreground` | `text-code-foreground` |

### Border Variants

| Ghost Token | Tailwind Name | Usage |
|---|---|---|
| `--ghost-border-muted` | `border-muted` | `border-border-muted` |
| `--ghost-border-alt` | `border-alt` | `border-border-alt` |
| `--ghost-border-accent` | `border-accent` | `border-border-accent` |

### Primary Effects

| Ghost Token | Tailwind Name | Usage |
|---|---|---|
| `--ghost-primary-glow-subtle` | `primary-glow-subtle` | `bg-primary-glow-subtle` |
| `--ghost-primary-glow` | `primary-glow` | `bg-primary-glow` |
| `--ghost-primary-border-semi` | `primary-border-semi` | `border-primary-border-semi` |
| `--ghost-primary-overlay` | `primary-overlay` | `bg-primary-overlay` |

### Interactive States

| Ghost Token | Tailwind Name | Usage |
|---|---|---|
| `--ghost-hover-background` | `hover-background` | `bg-hover-background` |
| `--ghost-active-background` | `active-background` | `bg-active-background` |
| `--ghost-selection-background` | `selection-background` | `bg-selection-background` |
| `--ghost-selection-foreground` | `selection-foreground` | `text-selection-foreground` |

### Chart Tokens

| Ghost Token | Tailwind Name | Usage |
|---|---|---|
| `--ghost-chart-1` | `chart-1` | `bg-chart-1` `text-chart-1` |
| `--ghost-chart-2` | `chart-2` | `bg-chart-2` `text-chart-2` |
| `--ghost-chart-3` | `chart-3` | `bg-chart-3` `text-chart-3` |
| `--ghost-chart-4` | `chart-4` | `bg-chart-4` `text-chart-4` |
| `--ghost-chart-5` | `chart-5` | `bg-chart-5` `text-chart-5` |

### Sidebar (Edge Left)

| Ghost Token | Tailwind Name | Usage |
|---|---|---|
| `--ghost-edge-left` | `sidebar` | `bg-sidebar` |
| `--ghost-edge-left-foreground` | `sidebar-foreground` | `text-sidebar-foreground` |
| `--ghost-edge-left-accent` | `sidebar-accent` | `bg-sidebar-accent` |
| `--ghost-edge-left-accent-foreground` | `sidebar-accent-foreground` | `text-sidebar-accent-foreground` |
| `--ghost-edge-left-border` | `sidebar-border` | `border-sidebar-border` |

### Edge Panels — Top

| Ghost Token | Tailwind Name | Usage |
|---|---|---|
| `--ghost-edge-top` | `edge-top` | `bg-edge-top` |
| `--ghost-edge-top-foreground` | `edge-top-foreground` | `text-edge-top-foreground` |
| `--ghost-edge-top-border` | `edge-top-border` | `border-edge-top-border` |
| `--ghost-edge-top-accent` | `edge-top-accent` | `bg-edge-top-accent` |
| `--ghost-edge-top-accent-foreground` | `edge-top-accent-foreground` | `text-edge-top-accent-foreground` |

### Edge Panels — Bottom

| Ghost Token | Tailwind Name | Usage |
|---|---|---|
| `--ghost-edge-bottom` | `edge-bottom` | `bg-edge-bottom` |
| `--ghost-edge-bottom-foreground` | `edge-bottom-foreground` | `text-edge-bottom-foreground` |
| `--ghost-edge-bottom-border` | `edge-bottom-border` | `border-edge-bottom-border` |
| `--ghost-edge-bottom-accent` | `edge-bottom-accent` | `bg-edge-bottom-accent` |
| `--ghost-edge-bottom-accent-foreground` | `edge-bottom-accent-foreground` | `text-edge-bottom-accent-foreground` |

### Edge Panels — Right

| Ghost Token | Tailwind Name | Usage |
|---|---|---|
| `--ghost-edge-right` | `edge-right` | `bg-edge-right` |
| `--ghost-edge-right-foreground` | `edge-right-foreground` | `text-edge-right-foreground` |
| `--ghost-edge-right-border` | `edge-right-border` | `border-edge-right-border` |
| `--ghost-edge-right-accent` | `edge-right-accent` | `bg-edge-right-accent` |
| `--ghost-edge-right-accent-foreground` | `edge-right-accent-foreground` | `text-edge-right-accent-foreground` |

### Window / Neutral

| Ghost Token | Tailwind Name | Usage |
|---|---|---|
| `--ghost-border-active` | `border-active` | `border-border-active` |
| `--ghost-border-inactive` | `border-inactive` | `border-border-inactive` |
| `--ghost-neutral-background` | `neutral-background` | `bg-neutral-background` |

### Geometry

| Ghost Token | Tailwind Name | Usage |
|---|---|---|
| `--ghost-radius` | `radius` | Used by `rounded-*` utilities |

### CSS-Only Tokens

These tokens are not color values and are available only as CSS custom properties:

| Ghost Token | CSS Usage |
|---|---|
| `--ghost-cursor` | `cursor: var(--cursor)` |
| `--ghost-opacity-active` | `opacity: var(--opacity-active)` |
| `--ghost-opacity-inactive` | `opacity: var(--opacity-inactive)` |
| `--ghost-border-size` | `border-width: var(--border-size)` |
| `--ghost-background-opacity` | `opacity: var(--background-opacity)` |
| `--ghost-mode` | `var(--mode)` — `"dark"` or `"light"` |

## Container Queries

The shell's `.part-root` sets `container-type: inline-size`, so plugins can use Tailwind's `@container` variants for responsive layouts:

```tsx
<div className="flex flex-col @md:flex-row @lg:grid @lg:grid-cols-2">
  <Panel />
  <Panel />
</div>
```

This responds to the plugin's container width, not the viewport — ideal for panels that can appear at different sizes.

## FAQ

**Why `tailwindcss/utilities` instead of `tailwindcss`?**
The shell's `ghost-ui-plugin` already provides preflight and base styles. Importing the full `tailwindcss` entry would duplicate resets and cause conflicts.

**Will my Tailwind classes conflict with other plugins?**
No. Tailwind utilities are deterministic — `bg-primary` always means the same thing. Each plugin compiles its own CSS independently.

**Can I use arbitrary values?**
Yes. Tailwind v4 arbitrary values work normally:

```tsx
<span className="text-[11px] w-[calc(100%-2rem)] p-[3px]">...</span>
```

**What about non-color tokens like cursor or opacity?**
Use `var(--ghost-*)` directly in inline styles or custom CSS:

```tsx
<button style={{ cursor: "var(--cursor)" }}>Click</button>
```

Or in a CSS file:

```css
.my-element {
  opacity: var(--opacity-active);
  border-width: var(--border-size);
}
```
