import type { AnimationEntry, AnimationName, BezierPoints, GhostMotionConfig, NamedBezierCurve } from "./config-types.js";
import { resolveEntry } from "./config-resolver.js";
import { activateMotion, deactivateMotion, getCurrentConfig, updateConfig } from "./activate.js";

function inject(config?: GhostMotionConfig): void {
  const cfg = config ?? getCurrentConfig();
  updateConfig(cfg);
}

function remove(): void {
  deactivateMotion();
}

function updateEntry(name: AnimationName, patch: Partial<AnimationEntry>): void {
  const config = getCurrentConfig();
  const existing = config.animations[name] ?? {};
  const updated: GhostMotionConfig = {
    ...config,
    animations: {
      ...config.animations,
      [name]: { ...existing, ...patch },
    },
  };
  updateConfig(updated);
}

function updateCurve(name: string, points: BezierPoints): void {
  const config = getCurrentConfig();
  const curves = config.curves.map(c =>
    c.name === name ? { ...c, points } : c,
  );
  updateConfig({ ...config, curves });
}

function addCurve(curve: NamedBezierCurve): void {
  const config = getCurrentConfig();
  const exists = config.curves.some(c => c.name === curve.name);
  const curves = exists
    ? config.curves.map(c => c.name === curve.name ? curve : c)
    : [...config.curves, curve];
  updateConfig({ ...config, curves });
}

function removeCurve(name: string): void {
  const config = getCurrentConfig();
  const curves = config.curves.filter(c => c.name !== name);
  updateConfig({ ...config, curves });
}

function getConfig(): Readonly<GhostMotionConfig> {
  return getCurrentConfig();
}

function resolveAnimationEntry(name: AnimationName): Readonly<Required<AnimationEntry>> {
  return resolveEntry(name, getCurrentConfig());
}

export { activateMotion, deactivateMotion };

export const pluginServices = {
  "ghost.motion.service": {
    inject,
    remove,
    updateEntry,
    updateCurve,
    addCurve,
    removeCurve,
    getConfig,
    resolveEntry: resolveAnimationEntry,
  },
};
