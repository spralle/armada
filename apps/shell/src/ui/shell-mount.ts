import { DEV_MODE } from "../app/constants.js";
import type { ShellRuntime } from "../app/types.js";

type MountDeps = {
  renderParts: () => void;
  updateWindowReadOnlyState: () => void;
  setupResize: () => void;
  publishRestoreRequestOnUnload: () => void;
};

export function mountMainWindow(root: HTMLElement, deps: MountDeps): void {
  root.innerHTML = `
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; }
    body { margin: 0; background: #14161a; color: #e9edf3; }
    .shell { display: grid; grid-template-columns: var(--side-size) 6px 1fr; height: 100vh; }
    .slot-side { border-right: 1px solid #2b3040; background: #181c24; }
    .main-stack { display: grid; grid-template-rows: 1fr 6px var(--secondary-size); min-width: 0; min-height: 0; }
    .slot { min-width: 0; min-height: 0; overflow: hidden; }
    .slot-body { display: grid; grid-template-rows: auto 1fr; height: 100%; min-height: 0; }
    .slot-tabs { border-bottom: 1px solid #2b3040; padding: 0 8px; }
    .slot-panels { min-height: 0; overflow: auto; padding: 10px 12px; }
    .slot-main { background: #11151c; }
    .slot-secondary { border-top: 1px solid #2b3040; background: #121922; }
    .part-tab-strip { display: flex; gap: 2px; align-items: center; overflow-x: auto; scrollbar-width: thin; }
    .part-tab-item { display: inline-flex; align-items: center; gap: 2px; }
    .part-tab { appearance: none; background: transparent; border: 1px solid transparent; border-bottom: none; color: #c6d0e0; padding: 8px 10px; border-radius: 6px 6px 0 0; cursor: pointer; white-space: nowrap; }
    .part-tab:hover { background: #1a2230; color: #e9edf3; }
    .part-tab:focus-visible { outline: 2px solid #7cb4ff; outline-offset: 1px; }
    .part-tab.is-active { background: #1d2635; border-color: #334564; color: #f4f8ff; }
    .part-tab-close { appearance: none; background: transparent; border: 1px solid transparent; color: #aebbd0; border-radius: 4px; cursor: pointer; width: 20px; height: 20px; line-height: 1; padding: 0; }
    .part-tab-close:hover { background: #1a2230; color: #f4f8ff; border-color: #334564; }
    .part-tab-close:focus-visible { outline: 2px solid #7cb4ff; outline-offset: 1px; }
    .splitter { background: #2b3040; cursor: col-resize; user-select: none; touch-action: none; }
    .splitter[data-pane="secondary"] { cursor: row-resize; }
    .card { border: 1px solid #2d415f; border-radius: 6px; margin-bottom: 8px; padding: 8px; }
    .part-root { border: 1px solid #2d415f; border-radius: 6px; margin-bottom: 8px; padding: 8px; container-type: inline-size; }
    .part-root.is-selected { border-color: #7cb4ff; box-shadow: 0 0 0 1px #7cb4ff33 inset; }
    .part-actions { display: flex; gap: 8px; margin-bottom: 8px; }
    .part-actions button { background: #1d2635; border: 1px solid #334564; border-radius: 4px; color: #e9edf3; padding: 4px 8px; cursor: pointer; }
    .part-actions button:hover { border-color: #7cb4ff; }
    .dropzone { margin-top: 8px; border: 1px dashed #4d6389; border-radius: 4px; padding: 6px; color: #b6c2d8; font-size: 12px; }
    .bridge-warning { border-left: 3px solid #f2a65a; padding: 6px 8px; background: #30261a; color: #f5d7b5; margin-bottom: 8px; }
    .sync-degraded { opacity: 0.62; filter: grayscale(0.5); pointer-events: none; }
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
    .domain-panel { display: grid; gap: 6px; }
    .domain-hint { margin: 0; color: #b6c2d8; font-size: 12px; }
    .domain-list { display: grid; gap: 6px; }
    .domain-row { display: grid; gap: 2px; text-align: left; border: 1px solid #334564; background: #1a2230; color: #e9edf3; border-radius: 6px; padding: 8px; cursor: pointer; }
    .domain-row:hover { border-color: #7cb4ff; }
    .domain-row.is-selected { border-color: #7cb4ff; box-shadow: 0 0 0 1px #7cb4ff44 inset; }
    .intent-chooser { margin-top: 8px; border: 1px solid #334564; border-radius: 6px; padding: 8px; background: #101723; }
    .intent-chooser button { display: block; width: 100%; text-align: left; margin: 4px 0; background: #1d2635; border: 1px solid #334564; border-radius: 4px; color: #e9edf3; padding: 6px; cursor: pointer; }
    .intent-chooser button:hover { border-color: #7cb4ff; }
    .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
    @container (max-width: 420px) {
      .part-actions { flex-wrap: wrap; }
      .domain-row { font-size: 12px; padding: 6px; }
      .domain-row span { white-space: normal; }
    }
  </style>
  <main class="shell" id="shell-root">
    <section class="slot slot-side" data-slot="side">
      <section class="card" id="plugin-controls"></section>
      <section class="card" id="sync-status"></section>
      <section class="card" id="context-controls"></section>
      ${DEV_MODE ? '<section class="card dev-inspector" id="dev-context-inspector"></section>' : ""}
      <section class="slot-body">
        <section class="slot-tabs" id="slot-side-tabs"></section>
        <section class="slot-panels" id="slot-side-parts"></section>
      </section>
    </section>
    <div class="splitter" id="splitter-side" data-pane="side" aria-label="Resize side pane"></div>
    <section class="main-stack">
      <section class="slot slot-main" data-slot="main">
        <section class="slot-body">
          <section class="slot-tabs" id="slot-main-tabs"></section>
          <section class="slot-panels" id="slot-main-parts"></section>
        </section>
      </section>
      <div class="splitter" id="splitter-secondary" data-pane="secondary" aria-label="Resize secondary pane"></div>
      <section class="slot slot-secondary" data-slot="secondary">
        <section class="slot-body">
          <section class="slot-tabs" id="slot-secondary-tabs"></section>
          <section class="slot-panels" id="slot-secondary-parts"></section>
        </section>
      </section>
    </section>
  </main>
  <div id="live-announcer" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
  `;

  deps.renderParts();
  deps.updateWindowReadOnlyState();
  deps.setupResize();
}

export function mountPopout(root: HTMLElement, runtime: ShellRuntime, deps: MountDeps): void {
  root.innerHTML = `
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; }
    body { margin: 0; background: #14161a; color: #e9edf3; }
    .popout { padding: 12px; }
    .card { border: 1px solid #2d415f; border-radius: 6px; margin-bottom: 8px; padding: 8px; }
    .part-root { border: 1px solid #2d415f; border-radius: 6px; margin-bottom: 8px; padding: 8px; container-type: inline-size; }
    .part-root.is-selected { border-color: #7cb4ff; box-shadow: 0 0 0 1px #7cb4ff33 inset; }
    .part-actions { display: flex; gap: 8px; margin-bottom: 8px; }
    .part-actions button { background: #1d2635; border: 1px solid #334564; border-radius: 4px; color: #e9edf3; padding: 4px 8px; cursor: pointer; }
    .dropzone { margin-top: 8px; border: 1px dashed #4d6389; border-radius: 4px; padding: 6px; color: #b6c2d8; font-size: 12px; }
    .bridge-warning { border-left: 3px solid #f2a65a; padding: 6px 8px; background: #30261a; color: #f5d7b5; margin-bottom: 8px; }
    .sync-degraded { opacity: 0.62; filter: grayscale(0.5); pointer-events: none; }
    .runtime-note { color: #c6d0e0; font-size: 12px; margin: 0; }
    .dev-inspector { border-color: #495f87; background: #0f1622; }
    .dev-inspector details { margin-bottom: 6px; }
    .dev-inspector pre { margin: 6px 0; max-height: 220px; overflow: auto; padding: 8px; border-radius: 4px; border: 1px solid #334564; background: #0a111c; color: #cfe3ff; font-size: 11px; }
    .dev-inspector ul { margin: 6px 0; padding-left: 18px; }
    .dev-inspector li { margin: 3px 0; }
    .domain-panel { display: grid; gap: 6px; }
    .domain-hint { margin: 0; color: #b6c2d8; font-size: 12px; }
    .domain-list { display: grid; gap: 6px; }
    .domain-row { display: grid; gap: 2px; text-align: left; border: 1px solid #334564; background: #1a2230; color: #e9edf3; border-radius: 6px; padding: 8px; cursor: pointer; }
    .domain-row:hover { border-color: #7cb4ff; }
    .domain-row.is-selected { border-color: #7cb4ff; box-shadow: 0 0 0 1px #7cb4ff44 inset; }
    .intent-chooser { margin-top: 8px; border: 1px solid #334564; border-radius: 6px; padding: 8px; background: #101723; }
    .intent-chooser button { display: block; width: 100%; text-align: left; margin: 4px 0; background: #1d2635; border: 1px solid #334564; border-radius: 4px; color: #e9edf3; padding: 6px; cursor: pointer; }
    .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
    @container (max-width: 420px) {
      .part-actions { flex-wrap: wrap; }
      .domain-row { font-size: 12px; padding: 6px; }
      .domain-row span { white-space: normal; }
    }
  </style>
  <main class="popout">
    <section class="card" id="sync-status"></section>
    <section class="card" id="context-controls"></section>
    ${DEV_MODE ? '<section class="card dev-inspector" id="dev-context-inspector"></section>' : ""}
    <section id="popout-slot"></section>
  </main>
  <div id="live-announcer" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
  `;

  deps.renderParts();
  deps.updateWindowReadOnlyState();

  window.addEventListener("beforeunload", () => {
    if (!runtime.partId || !runtime.hostWindowId) {
      return;
    }
    deps.publishRestoreRequestOnUnload();
  });
}
