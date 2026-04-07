type PartMountContext = {
  part: {
    id: string;
    title: string;
  };
};

type PartMountFn = (target: HTMLElement, context: PartMountContext) => void;

const samplePartMount: PartMountFn = (target, context) => {
  target.innerHTML = `<section><h3>${context.part.title}</h3><p>Sample contract consumer plugin part mounted.</p></section>`;
};

export const parts: Record<string, PartMountFn> = {
  "sample.part": samplePartMount,
  SampleView: samplePartMount,
};

export function mountPart(target: HTMLElement, context: PartMountContext): void {
  const mount = parts[context.part.id];
  if (mount) {
    mount(target, context);
  }
}

