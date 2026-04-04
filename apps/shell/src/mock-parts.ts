import type { ShellSlot } from "./layout.js";

export interface LocalMockPart {
  id: string;
  title: string;
  slot: ShellSlot;
  render(): string;
}

export const localMockParts: LocalMockPart[] = [
  {
    id: "workbench.master.overview",
    title: "Overview",
    slot: "master",
    render: () => "<section><h2>Master</h2><p>Local mock primary content.</p></section>",
  },
  {
    id: "workbench.secondary.logs",
    title: "Logs",
    slot: "secondary",
    render: () =>
      "<section><h2>Secondary</h2><p>Local mock detail/log stream.</p></section>",
  },
  {
    id: "workbench.side.navigator",
    title: "Navigator",
    slot: "side",
    render: () => "<section><h2>Side</h2><p>Local mock tree/navigation.</p></section>",
  },
];
