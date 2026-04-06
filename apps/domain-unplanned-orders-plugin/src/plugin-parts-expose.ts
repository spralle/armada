type PartMountContext = {
  part: {
    id: string;
    title: string;
  };
};

type PartMountFn = (target: HTMLElement, context: PartMountContext) => void;

const unplannedOrdersPartMount: PartMountFn = (target, context) => {
  target.innerHTML = `<section><h3>${context.part.title}</h3><p>Domain unplanned orders plugin part mounted.</p></section>`;
};

export const parts: Record<string, PartMountFn> = {
  "domain.unplanned-orders.part": unplannedOrdersPartMount,
  UnplannedOrdersPart: unplannedOrdersPartMount,
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
