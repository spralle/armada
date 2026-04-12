type PartMountContext = {
  part: {
    id: string;
    title: string;
  };
};

type PartMountFn = (target: HTMLElement, context: PartMountContext) => void;

const vesselViewPartMount: PartMountFn = (target, context) => {
  target.innerHTML = `<section><h3>${context.part.title}</h3><p>Domain vessel view plugin part mounted.</p></section>`;
};

export const parts: Record<string, PartMountFn> = {
  "domain.vessel-view.part": vesselViewPartMount,
  VesselViewPart: vesselViewPartMount,
};

export function mountPart(target: HTMLElement, context: PartMountContext): void {
  const mount = parts[context.part.id];
  if (mount) {
    mount(target, context);
  }
}

