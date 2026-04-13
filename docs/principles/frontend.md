# Frontend Code Principles

Extends the universal and language-specific principles with frontend/UI rules.

## Principles

- **No hardcoded colors**: Use CSS custom properties or design tokens. Never put hex/rgb values directly in component code.
- **Theme-aware components**: Use semantic token names (e.g., `--color-surface`, `--color-text-primary`), not physical color names (e.g., `--blue-500`).
- **Component cohesion**: One component per file. Co-locate styles, tests, and types with the component they belong to.
- **Accessibility by default**: Interactive elements must be keyboard-navigable. Use semantic HTML elements. Add appropriate ARIA attributes for custom widgets.
- **Performance awareness**: Avoid unnecessary re-renders. Memoize expensive computations. Lazy-load heavy components and routes.
- **Responsive design**: Components should work across viewport sizes unless explicitly scoped to a specific breakpoint.
- **State locality**: Keep state as close to where it's used as possible. Lift state only when sharing is genuinely needed.

## Frontend PR Checklist (extends universal + language)

- [ ] No hardcoded color values — uses CSS custom properties or tokens.
- [ ] Theme tokens are semantic, not physical.
- [ ] Components are keyboard-navigable with appropriate ARIA.
- [ ] No unnecessary re-renders or missing memoization for expensive operations.
- [ ] One component per file with co-located concerns.
