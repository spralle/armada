import type { ShellRuntime } from "../app/types.js";

type MountDeps = {
  renderParts: () => void;
  updateWindowReadOnlyState: () => void;
  setupResize: () => () => void;
  publishRestoreRequestOnUnload: () => void;
};

export function mountMainWindow(root: HTMLElement, deps: MountDeps): () => void {
  root.innerHTML = `
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    body { margin: 0; background: #14161a; color: #e9edf3; }
    .shell { display: grid; grid-template-columns: 1fr; min-height: 100vh; min-height: 100dvh; height: 100vh; height: 100dvh; overflow: hidden; }
    .shell,
    .shell > .dock-root,
    .dock-root > .dock-node,
    .dock-split-branch > .dock-node,
    .dock-node-split,
    .dock-node-stack,
    .dock-stack-panels { height: 100%; }
    .dock-root { background: #11151c; min-width: 0; min-height: 0; overflow: hidden; padding: 6px; display: flex; flex-direction: column; }
    .dock-root > .dock-node { flex: 1 1 auto; }
    .dock-node { min-width: 0; min-height: 0; }
    .dock-node-stack { display: grid; grid-template-rows: auto minmax(0, 1fr); min-width: 0; min-height: 0; border: 1px solid #2b3040; border-radius: 4px; background: #121922; overflow: hidden; }
    .dock-stack-panels { min-height: 0; overflow: hidden; padding: 0; position: relative; display: flex; flex-direction: column; }
    .dock-stack-panels > [role="tabpanel"] { min-width: 0; min-height: 0; height: 100%; overflow: hidden; flex: 1 1 auto; display: flex; flex-direction: column; }
    .dock-stack-panels > [role="tabpanel"][hidden] { display: none; }
    .dock-tabpanel { min-width: 0; min-height: 0; overflow: hidden; flex: 1 1 auto; display: flex; }
    .dock-tabpanel-content { min-width: 0; min-height: 0; width: 100%; height: 100%; max-width: 100%; max-height: 100%; overflow: auto; flex: 1 1 auto; padding: 6px; box-sizing: border-box; display: flex; flex-direction: column; }
    .dock-tabpanel-content > * { min-width: 0; }
    .dock-node-split { --dock-splitter-size: 12px; display: grid; gap: 0; min-width: 0; min-height: 0; }
    .dock-node-split-horizontal { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    .dock-node-split-vertical { grid-template-rows: minmax(0, 1fr) minmax(0, 1fr); }
    .dock-split-branch { min-width: 0; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
    .dock-splitter { position: relative; background: transparent; user-select: none; touch-action: none; z-index: 2; }
    .dock-splitter::before { content: ""; position: absolute; background: #2b3040; pointer-events: none; }
    .dock-splitter-horizontal { cursor: col-resize; }
    .dock-splitter-horizontal::before { top: 0; bottom: 0; left: 50%; width: 1px; transform: translateX(-0.5px); }
    .dock-splitter-vertical { cursor: row-resize; }
    .dock-splitter-vertical::before { left: 0; right: 0; top: 50%; height: 1px; transform: translateY(-0.5px); }
    .dock-splitter:hover::before { background: #7cb4ff; }
    .is-dock-splitter-dragging { cursor: grabbing; }
    .is-dock-splitter-dragging .dock-splitter-horizontal { cursor: col-resize; }
    .is-dock-splitter-dragging .dock-splitter-vertical { cursor: row-resize; }
    .part-tab-strip { display: flex; gap: 2px; align-items: center; overflow-x: auto; scrollbar-width: thin; padding: 2px; }
    .part-tab-item { display: inline-flex; align-items: center; gap: 2px; position: relative; }
    .part-tab { appearance: none; background: transparent; border: 1px solid transparent; border-bottom: none; color: #c6d0e0; padding: 5px 7px; border-radius: 4px 4px 0 0; cursor: grab; white-space: nowrap; }
    .part-tab:hover { background: #1a2230; color: #e9edf3; }
    .part-tab:active { cursor: grabbing; }
    .part-tab:focus-visible { outline: 2px solid #7cb4ff; outline-offset: 1px; }
    .part-tab.is-active { background: #1d2635; border-color: #334564; color: #f4f8ff; }
    .part-tab-close { appearance: none; background: transparent; border: 1px solid transparent; color: #aebbd0; border-radius: 3px; cursor: pointer; width: 18px; height: 18px; line-height: 1; padding: 0; }
    .part-tab-close:hover { background: #1a2230; color: #f4f8ff; border-color: #334564; }
    .part-tab-close:focus-visible { outline: 2px solid #7cb4ff; outline-offset: 1px; }
    .splitter { background: #2b3040; cursor: col-resize; user-select: none; touch-action: none; }
    .splitter[data-pane="secondary"] { cursor: row-resize; }
    .card { border: 1px solid #2d415f; border-radius: 4px; margin-bottom: 6px; padding: 6px; }
    .part-root { border: 1px solid #2d415f; border-radius: 4px; margin-bottom: 0; padding: 6px; container-type: inline-size; display: flex; flex-direction: column; min-height: 0; height: 100%; }
    .part-root h2 { margin: 0 0 6px; font-size: 14px; }
    .part-root.is-selected { border-color: #7cb4ff; box-shadow: 0 0 0 1px #7cb4ff33 inset; }
    .part-actions { display: flex; gap: 6px; margin-bottom: 6px; }
    .part-actions button { background: #1d2635; border: 1px solid #334564; border-radius: 3px; color: #e9edf3; padding: 3px 7px; cursor: pointer; }
    .part-actions button:hover { border-color: #7cb4ff; }
    .dock-drop-overlay { display: none; position: absolute; inset: 4px; z-index: 8; border-radius: 6px; pointer-events: none; }
    .is-dock-dragging .dock-drop-overlay { display: block; }
    .dock-drop-zone { position: absolute; border: 0; border-radius: 6px; background: transparent; pointer-events: auto; }
    .dock-drop-zone-left { left: 0; top: 0; width: 20%; height: 100%; }
    .dock-drop-zone-right { right: 0; top: 0; width: 20%; height: 100%; }
    .dock-drop-zone-top { left: 20%; top: 0; width: 60%; height: 20%; }
    .dock-drop-zone-bottom { left: 20%; bottom: 0; width: 60%; height: 20%; }
    .dock-drop-zone-center { left: 28%; top: 28%; width: 44%; height: 44%; }
    .dock-drop-preview { display: none; position: absolute; inset: 0; border-radius: 6px; background: transparent; pointer-events: none; }
    .dock-drop-overlay[class*="is-preview-"] .dock-drop-preview { display: block; }
    .dock-drop-overlay.is-preview-left .dock-drop-preview { left: 0; top: 0; right: auto; bottom: 0; width: 50%; background: #7cb4ff2e; }
    .dock-drop-overlay.is-preview-right .dock-drop-preview { left: auto; top: 0; right: 0; bottom: 0; width: 50%; background: #7cb4ff2e; }
    .dock-drop-overlay.is-preview-top .dock-drop-preview { left: 0; top: 0; right: 0; bottom: auto; height: 50%; background: #7cb4ff2e; }
    .dock-drop-overlay.is-preview-bottom .dock-drop-preview { left: 0; top: auto; right: 0; bottom: 0; height: 50%; background: #7cb4ff2e; }
    .dock-drop-overlay.is-preview-center .dock-drop-preview { inset: 8%; background: #7cb4ff2e; border: 1px solid #7cb4ff88; }
    .bridge-warning { border-left: 3px solid #f2a65a; padding: 6px 8px; background: #30261a; color: #f5d7b5; margin-bottom: 8px; }
    .sync-degraded { opacity: 0.62; filter: grayscale(0.5); }
    .runtime-note { color: #c6d0e0; font-size: 12px; margin: 0; }
    .plugin-row { display:block; margin: 6px 0; }
    .plugin-error { margin: 4px 0 0 22px; color: #f5b8b8; font-size: 12px; }
    .plugin-notice { margin:0 0 8px; font-size:12px; color:#f5d7b5; }
    .plugin-diag-list { margin: 8px 0 0; padding-left: 18px; font-size: 12px; color: #c6d0e0; }
    .plugin-diag-list li { margin: 2px 0; }
    .dev-inspector { border-color: #495f87; background: #0f1622; }
    .dev-inspector details { margin-bottom: 6px; }
    .dev-inspector pre { margin: 6px 0; max-height: 220px; overflow: auto; padding: 8px; border-radius: 4px; border: 1px solid #334564; background: #0a111c; color: #cfe3ff; font-size: 11px; }
    .dev-inspector ul { margin: 6px 0; padding-left: 18px; }
    .dev-inspector li { margin: 3px 0; }
    .domain-panel { display: grid; gap: 6px; grid-template-rows: minmax(0, 1fr) auto; min-width: 0; min-height: 0; flex: 1 1 auto; }
    .domain-panel-host,
    .domain-panel-fallback { min-width: 0; min-height: 0; overflow: auto; }
    .domain-hint { margin: 0; color: #b6c2d8; font-size: 12px; }
    .domain-list { display: grid; gap: 4px; }
    .domain-row { display: grid; gap: 2px; text-align: left; border: 1px solid #334564; background: #1a2230; color: #e9edf3; border-radius: 4px; padding: 6px; cursor: pointer; }
    .domain-row:hover { border-color: #7cb4ff; }
    .domain-row.is-selected { border-color: #7cb4ff; box-shadow: 0 0 0 1px #7cb4ff44 inset; }
    .intent-chooser { margin-top: 6px; border: 1px solid #334564; border-radius: 4px; padding: 6px; background: #101723; }
    .intent-chooser button { display: block; width: 100%; text-align: left; margin: 3px 0; background: #1d2635; border: 1px solid #334564; border-radius: 3px; color: #e9edf3; padding: 5px; cursor: pointer; }
    .intent-chooser button:hover { border-color: #7cb4ff; }
    .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
    @container (max-width: 420px) {
      .part-actions { flex-wrap: wrap; }
      .domain-row { font-size: 12px; padding: 6px; }
      .domain-row span { white-space: normal; }
    }
  </style>
  <main class="shell" id="shell-root">
    <section class="dock-root" id="dock-tree-root" data-slot="main"></section>
  </main>
  <div id="live-announcer" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
  <div id="action-palette-host"></div>
  `;

  deps.renderParts();
  deps.updateWindowReadOnlyState();
  const disposeResize = deps.setupResize();

  return () => {
    disposeResize();
  };
}

export function mountPopout(root: HTMLElement, runtime: ShellRuntime, deps: MountDeps): () => void {
  root.innerHTML = `
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    body { margin: 0; background: #14161a; color: #e9edf3; }
    .popout { padding: 8px; min-height: 100vh; min-height: 100dvh; height: 100vh; height: 100dvh; box-sizing: border-box; overflow: hidden; }
    #popout-slot { height: 100%; min-height: 0; }
    .card { border: 1px solid #2d415f; border-radius: 4px; margin-bottom: 6px; padding: 6px; }
    .part-root { border: 1px solid #2d415f; border-radius: 4px; margin-bottom: 0; padding: 6px; container-type: inline-size; display: flex; flex-direction: column; min-height: 0; height: 100%; }
    .part-root h2 { margin: 0 0 6px; font-size: 14px; }
    .part-root.is-selected { border-color: #7cb4ff; box-shadow: 0 0 0 1px #7cb4ff33 inset; }
    .part-actions { display: flex; gap: 6px; margin-bottom: 6px; }
    .part-actions button { background: #1d2635; border: 1px solid #334564; border-radius: 3px; color: #e9edf3; padding: 3px 7px; cursor: pointer; }
    .bridge-warning { border-left: 3px solid #f2a65a; padding: 6px 8px; background: #30261a; color: #f5d7b5; margin-bottom: 8px; }
    .sync-degraded { opacity: 0.62; filter: grayscale(0.5); }
    .runtime-note { color: #c6d0e0; font-size: 12px; margin: 0; }
    .dev-inspector { border-color: #495f87; background: #0f1622; }
    .dev-inspector details { margin-bottom: 6px; }
    .dev-inspector pre { margin: 6px 0; max-height: 220px; overflow: auto; padding: 8px; border-radius: 4px; border: 1px solid #334564; background: #0a111c; color: #cfe3ff; font-size: 11px; }
    .dev-inspector ul { margin: 6px 0; padding-left: 18px; }
    .dev-inspector li { margin: 3px 0; }
    .domain-panel { display: grid; gap: 6px; grid-template-rows: minmax(0, 1fr) auto; min-width: 0; min-height: 0; flex: 1 1 auto; }
    .domain-panel-host,
    .domain-panel-fallback { min-width: 0; min-height: 0; overflow: auto; }
    .domain-hint { margin: 0; color: #b6c2d8; font-size: 12px; }
    .domain-list { display: grid; gap: 4px; }
    .domain-row { display: grid; gap: 2px; text-align: left; border: 1px solid #334564; background: #1a2230; color: #e9edf3; border-radius: 4px; padding: 6px; cursor: pointer; }
    .domain-row:hover { border-color: #7cb4ff; }
    .domain-row.is-selected { border-color: #7cb4ff; box-shadow: 0 0 0 1px #7cb4ff44 inset; }
    .intent-chooser { margin-top: 6px; border: 1px solid #334564; border-radius: 4px; padding: 6px; background: #101723; }
    .intent-chooser button { display: block; width: 100%; text-align: left; margin: 3px 0; background: #1d2635; border: 1px solid #334564; border-radius: 3px; color: #e9edf3; padding: 5px; cursor: pointer; }
    .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
    @container (max-width: 420px) {
      .part-actions { flex-wrap: wrap; }
      .domain-row { font-size: 12px; padding: 6px; }
      .domain-row span { white-space: normal; }
    }
  </style>
  <main class="popout">
    <section id="popout-slot"></section>
  </main>
  <div id="live-announcer" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
  `;

  deps.renderParts();
  deps.updateWindowReadOnlyState();
  const disposeResize = deps.setupResize();

  const onBeforeUnload = () => {
    if (!runtime.popoutTabId || !runtime.hostWindowId) {
      return;
    }
    deps.publishRestoreRequestOnUnload();
  };

  window.addEventListener("beforeunload", onBeforeUnload);

  return () => {
    disposeResize();
    window.removeEventListener("beforeunload", onBeforeUnload);
  };
}
