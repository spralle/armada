import type { ShellRendererAdapter } from "./contracts.js";
import type { ShellRuntime } from "./types.js";

const rendererByRuntime = new WeakMap<ShellRuntime, ShellRendererAdapter>();

export function registerRendererAdapter(runtime: ShellRuntime, renderer: ShellRendererAdapter): void {
  rendererByRuntime.set(runtime, renderer);
}

export function getRendererAdapter(runtime: ShellRuntime): ShellRendererAdapter {
  const renderer = rendererByRuntime.get(runtime);
  if (!renderer) {
    throw new Error("Renderer adapter not initialized for runtime.");
  }
  return renderer;
}
