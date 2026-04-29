import type { AnimationTreeNode } from "./config-types.js";

export const ANIMATION_TREE: Readonly<Record<string, AnimationTreeNode>> = {
  // ── Windows (dock panels opening/closing) ──
  windows: {
    parent: null,
    styles: ["slide", "popin"],
    cssTarget: ".part-root",
    keyframesMap: { slide: "ghost-window-slide", popin: "ghost-window-popin" },
  },
  windowsIn: {
    parent: "windows",
    styles: ["slide", "popin"],
    cssTarget: '.part-root[data-motion="entering"]',
    keyframesMap: { slide: "ghost-window-slide-in", popin: "ghost-window-popin-in" },
  },
  windowsOut: {
    parent: "windows",
    styles: ["slide", "popin"],
    cssTarget: '.part-root[data-motion="exiting"]',
    keyframesMap: { slide: "ghost-window-slide-out", popin: "ghost-window-popin-out" },
  },

  // ── Layers (modals, overlays, notifications, floating) ──
  layers: {
    parent: null,
    styles: ["slide", "popin", "fade"],
    cssTarget: ".layer-surface",
    keyframesMap: { slide: "ghost-layer-slide", popin: "ghost-layer-popin", fade: "ghost-layer-fade" },
  },
  layersIn: {
    parent: "layers",
    styles: ["slide", "popin", "fade"],
    cssTarget: '.layer-surface[data-motion="entering"]',
    keyframesMap: { slide: "ghost-layer-slide-in", popin: "ghost-layer-popin-in", fade: "ghost-layer-fade-in" },
  },
  layersOut: {
    parent: "layers",
    styles: ["slide", "popin", "fade"],
    cssTarget: '.layer-surface[data-motion="exiting"]',
    keyframesMap: { slide: "ghost-layer-slide-out", popin: "ghost-layer-popin-out", fade: "ghost-layer-fade-out" },
  },

  // ── Fade (focus/dim transitions) ──
  fade: { parent: null, styles: [], cssTarget: ".dock-node-stack", transitionProps: ["opacity"], keyframesMap: {} },
  fadeIn: {
    parent: "fade",
    styles: [],
    cssTarget: ".dock-node-stack.is-active-stack",
    transitionProps: ["opacity"],
    keyframesMap: {},
  },
  fadeOut: {
    parent: "fade",
    styles: [],
    cssTarget: ".dock-node-stack:not(.is-active-stack)",
    transitionProps: ["opacity"],
    keyframesMap: {},
  },
  fadeDim: {
    parent: "fade",
    styles: [],
    cssTarget: ".dock-node-stack:not(.is-active-stack)",
    transitionProps: ["opacity"],
    keyframesMap: {},
  },
  fadeLayersIn: {
    parent: "fadeDim",
    styles: [],
    cssTarget: '.layer-surface[data-motion="focus-in"]',
    transitionProps: ["opacity"],
    keyframesMap: {},
  },
  fadeLayersOut: {
    parent: "fadeDim",
    styles: [],
    cssTarget: '.layer-surface[data-motion="focus-out"]',
    transitionProps: ["opacity"],
    keyframesMap: {},
  },

  // ── Border (active panel indicator) ──
  border: {
    parent: null,
    styles: [],
    cssTarget: ".dock-node-stack.is-active-stack::after",
    transitionProps: ["opacity"],
    keyframesMap: {},
  },
  borderangle: {
    parent: "border",
    styles: ["once", "loop"],
    cssTarget: ".dock-node-stack.is-active-stack::after",
    keyframesMap: { once: "ghost-border-rotate-once", loop: "ghost-border-rotate-loop" },
  },

  // ── Workspaces ──
  workspaces: {
    parent: null,
    styles: ["slide", "slidevert", "fade", "slidefade", "slidefadevert"],
    cssTarget: "#dock-tree-root",
    keyframesMap: {
      slide: "ghost-ws-slide",
      slidevert: "ghost-ws-slidevert",
      fade: "ghost-ws-fade",
      slidefade: "ghost-ws-slidefade",
      slidefadevert: "ghost-ws-slidefadevert",
    },
  },
  workspacesIn: {
    parent: "workspaces",
    styles: ["slide", "slidevert", "fade", "slidefade", "slidefadevert"],
    cssTarget: '#dock-tree-root[data-motion="ws-entering"]',
    keyframesMap: {
      slide: "ghost-ws-slide-in",
      slidevert: "ghost-ws-slidevert-in",
      fade: "ghost-ws-fade-in",
      slidefade: "ghost-ws-slidefade-in",
      slidefadevert: "ghost-ws-slidefadevert-in",
    },
  },
  workspacesOut: {
    parent: "workspaces",
    styles: ["slide", "slidevert", "fade", "slidefade", "slidefadevert"],
    cssTarget: '#dock-tree-root[data-motion="ws-exiting"]',
    keyframesMap: {
      slide: "ghost-ws-slide-out",
      slidevert: "ghost-ws-slidevert-out",
      fade: "ghost-ws-fade-out",
      slidefade: "ghost-ws-slidefade-out",
      slidefadevert: "ghost-ws-slidefadevert-out",
    },
  },

  // ── Edge panels ──
  edgePanel: {
    parent: null,
    styles: ["slide", "fade"],
    cssTarget: ".edge-slot",
    keyframesMap: { slide: "ghost-edge-slide", fade: "ghost-edge-fade" },
  },
};
