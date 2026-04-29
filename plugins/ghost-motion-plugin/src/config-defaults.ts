import type { GhostMotionConfig, NamedBezierCurve } from "./config-types.js";

export const DEFAULT_CURVES: readonly NamedBezierCurve[] = [
  { name: "default", points: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 } },
  { name: "snappy", points: { x1: 0.16, y1: 1, x2: 0.3, y2: 1 } },
  { name: "bounce", points: { x1: 0.05, y1: 0.9, x2: 0.1, y2: 1.05 } },
  { name: "smooth", points: { x1: 0.4, y1: 0, x2: 0.2, y2: 1 } },
  { name: "linear", points: { x1: 0, y1: 0, x2: 1, y2: 1 } },
];

export const DEFAULT_MOTION_CONFIG: GhostMotionConfig = {
  enabled: true,
  curves: DEFAULT_CURVES,
  animations: {
    windows: { enabled: true, speed: 4, curve: "snappy", style: "popin", styleParam: 80 },
    windowsOut: { speed: 3 },
    layers: { enabled: true, speed: 3, curve: "snappy", style: "fade" },
    layersIn: { style: "popin", styleParam: 90 },
    fade: { enabled: true, speed: 3, curve: "smooth" },
    fadeDim: { speed: 5 },
    border: { enabled: true, speed: 10, curve: "default" },
    borderangle: { enabled: false },
    workspaces: { enabled: true, speed: 4, curve: "snappy", style: "slidefade", styleParam: 20 },
    workspacesOut: { speed: 3 },
    edgePanel: { enabled: true, speed: 3, curve: "snappy", style: "slide" },
  },
};
