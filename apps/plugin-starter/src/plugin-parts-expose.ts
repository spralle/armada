type PartMountContext = {
  part: {
    id: string;
    title: string;
  };
};

type PartMountFn = (target: HTMLElement, context: PartMountContext) => void;

const starterPartMount: PartMountFn = (target, context) => {
  target.innerHTML = `<section><h3>${context.part.title}</h3><p>Plugin starter part mounted.</p></section>`;
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

export default {
  parts,
  mountPart,
};
