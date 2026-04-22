/**
 * All @keyframes definitions for the motion plugin.
 * Only GPU-composited properties (transform, opacity) are used.
 * Each entry maps a keyframe name to its CSS @keyframes block.
 */
export const KEYFRAMES_REGISTRY: Readonly<Record<string, string>> = {
  // ── Window: popin ──
  "ghost-window-popin-in": `@keyframes ghost-window-popin-in {
  from { opacity: 0; transform: scale(calc(var(--ghost-anim-param, 80) / 100)); }
  to   { opacity: 1; transform: scale(1); }
}`,
  "ghost-window-popin-out": `@keyframes ghost-window-popin-out {
  from { opacity: 1; transform: scale(1); }
  to   { opacity: 0; transform: scale(calc(var(--ghost-anim-param, 80) / 100)); }
}`,

  // ── Layer: popin ──
  "ghost-layer-popin-in": `@keyframes ghost-layer-popin-in {
  from { opacity: 0; transform: scale(calc(var(--ghost-anim-param, 80) / 100)); }
  to   { opacity: 1; transform: scale(1); }
}`,
  "ghost-layer-popin-out": `@keyframes ghost-layer-popin-out {
  from { opacity: 1; transform: scale(1); }
  to   { opacity: 0; transform: scale(calc(var(--ghost-anim-param, 80) / 100)); }
}`,

  // ── Window: slide ──
  "ghost-window-slide-in": `@keyframes ghost-window-slide-in {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}`,
  "ghost-window-slide-out": `@keyframes ghost-window-slide-out {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(16px); }
}`,

  // ── Layer: slide ──
  "ghost-layer-slide-in": `@keyframes ghost-layer-slide-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}`,
  "ghost-layer-slide-out": `@keyframes ghost-layer-slide-out {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(12px); }
}`,

  // ── Layer: fade ──
  "ghost-layer-fade-in": `@keyframes ghost-layer-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}`,
  "ghost-layer-fade-out": `@keyframes ghost-layer-fade-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}`,

  // ── Workspace: slide ──
  "ghost-ws-slide-in": `@keyframes ghost-ws-slide-in {
  from { opacity: 0; transform: translateX(calc(var(--ghost-motion-direction, 1) * 30px)); }
  to   { opacity: 1; transform: translateX(0); }
}`,
  "ghost-ws-slide-out": `@keyframes ghost-ws-slide-out {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(calc(var(--ghost-motion-direction, 1) * -30px)); }
}`,

  // ── Workspace: slidevert ──
  "ghost-ws-slidevert-in": `@keyframes ghost-ws-slidevert-in {
  from { opacity: 0; transform: translateY(calc(var(--ghost-motion-direction, 1) * 30px)); }
  to   { opacity: 1; transform: translateY(0); }
}`,
  "ghost-ws-slidevert-out": `@keyframes ghost-ws-slidevert-out {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(calc(var(--ghost-motion-direction, 1) * -30px)); }
}`,

  // ── Workspace: fade ──
  "ghost-ws-fade-in": `@keyframes ghost-ws-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}`,
  "ghost-ws-fade-out": `@keyframes ghost-ws-fade-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}`,

  // ── Workspace: slidefade ──
  "ghost-ws-slidefade-in": `@keyframes ghost-ws-slidefade-in {
  from { opacity: 0; transform: translateX(calc(var(--ghost-anim-param, 20) * var(--ghost-motion-direction, 1) * 1px)); }
  to   { opacity: 1; transform: translateX(0); }
}`,
  "ghost-ws-slidefade-out": `@keyframes ghost-ws-slidefade-out {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(calc(var(--ghost-anim-param, 20) * var(--ghost-motion-direction, 1) * -1px)); }
}`,

  // ── Workspace: slidefadevert ──
  "ghost-ws-slidefadevert-in": `@keyframes ghost-ws-slidefadevert-in {
  from { opacity: 0; transform: translateY(calc(var(--ghost-anim-param, 20) * var(--ghost-motion-direction, 1) * 1px)); }
  to   { opacity: 1; transform: translateY(0); }
}`,
  "ghost-ws-slidefadevert-out": `@keyframes ghost-ws-slidefadevert-out {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(calc(var(--ghost-anim-param, 20) * var(--ghost-motion-direction, 1) * -1px)); }
}`,

  // ── Edge panel: slide ──
  "ghost-edge-slide": `@keyframes ghost-edge-slide {
  from { opacity: 0; transform: translate(var(--ghost-edge-dx, 0), var(--ghost-edge-dy, 0)); }
  to   { opacity: 1; transform: translate(0, 0); }
}`,

  // ── Edge panel: fade ──
  "ghost-edge-fade": `@keyframes ghost-edge-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}`,

  // ── Border angle rotation ──
  "ghost-border-rotate-once": `@keyframes ghost-border-rotate-once {
  from { --ghost-border-angle: 0deg; }
  to   { --ghost-border-angle: 360deg; }
}`,
  "ghost-border-rotate-loop": `@keyframes ghost-border-rotate-loop {
  from { --ghost-border-angle: 0deg; }
  to   { --ghost-border-angle: 360deg; }
}`,
};
