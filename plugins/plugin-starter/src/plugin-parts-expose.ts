type PartMountContext = {
  part: {
    id: string;
    title: string;
  };
};

type PartMountFn = (target: HTMLElement, context: PartMountContext) => void;

const starterPartMount: PartMountFn = (target, context) => {
  // Theme-aware styling: use var(--ghost-*) CSS custom properties instead of
  // hardcoded color values. These tokens adapt automatically when the user
  // switches themes. See docs/theming.md for the full token reference.
  target.innerHTML = `
    <section style="
      background-color: var(--ghost-surface);
      color: var(--ghost-foreground);
      border: 1px solid var(--ghost-border);
      border-radius: var(--ghost-radius);
      padding: 1rem;
    ">
      <h3 style="color: var(--ghost-primary);">${context.part.title}</h3>
      <p>Plugin starter part mounted.</p>
    </section>`;
};

export const parts: Record<string, PartMountFn> = {
  "starter.part": starterPartMount,
  StarterView: starterPartMount,
};

export function mountPart(target: HTMLElement, context: PartMountContext): void {
  const mount = parts[context.part.id];
  if (mount) {
    mount(target, context);
  }
}

