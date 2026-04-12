export const LOCAL_PLUGIN_IDS = Object.freeze({
  actionPalette: "ghost.action-palette",
  appearanceSettings: "ghost.appearance-settings",
  domainUnplannedOrders: "ghost.domain.unplanned-orders",
  domainVesselView: "ghost.domain.vessel-view",
  pluginStarter: "ghost.plugin-starter",
  sharedUiCapabilities: "ghost.shared.ui-capabilities",
  sampleContractConsumer: "ghost.sample.contract-consumer",
  shadcnThemeBridge: "ghost.shadcn.theme-bridge",
  themeDefault: "ghost.theme.default",
});

export const SORTED_LOCAL_PLUGIN_IDS = Object.freeze([
  LOCAL_PLUGIN_IDS.actionPalette,
  LOCAL_PLUGIN_IDS.appearanceSettings,
  LOCAL_PLUGIN_IDS.domainUnplannedOrders,
  LOCAL_PLUGIN_IDS.domainVesselView,
  LOCAL_PLUGIN_IDS.pluginStarter,
  LOCAL_PLUGIN_IDS.sampleContractConsumer,
  LOCAL_PLUGIN_IDS.shadcnThemeBridge,
  LOCAL_PLUGIN_IDS.sharedUiCapabilities,
  LOCAL_PLUGIN_IDS.themeDefault,
]);

export const DEFAULT_LOCAL_PLUGIN_ENTRIES = Object.freeze({
  [LOCAL_PLUGIN_IDS.actionPalette]: "http://127.0.0.1:4179/mf-manifest.json",
  [LOCAL_PLUGIN_IDS.appearanceSettings]: "http://127.0.0.1:4178/mf-manifest.json",
  [LOCAL_PLUGIN_IDS.domainUnplannedOrders]: "http://127.0.0.1:4173/mf-manifest.json",
  [LOCAL_PLUGIN_IDS.domainVesselView]: "http://127.0.0.1:4174/mf-manifest.json",
  [LOCAL_PLUGIN_IDS.pluginStarter]: "http://127.0.0.1:4171/mf-manifest.json",
  [LOCAL_PLUGIN_IDS.sharedUiCapabilities]: "http://127.0.0.1:4175/mf-manifest.json",
  [LOCAL_PLUGIN_IDS.sampleContractConsumer]: "http://127.0.0.1:4172/mf-manifest.json",
  [LOCAL_PLUGIN_IDS.shadcnThemeBridge]: "http://127.0.0.1:4177/mf-manifest.json",
  [LOCAL_PLUGIN_IDS.themeDefault]: "http://127.0.0.1:4176/mf-manifest.json",
});

export const DEFAULT_GATEWAY_PORT = 41337;

export const DEFAULT_GATEWAY_PLUGIN_ENTRIES = Object.freeze({
  [LOCAL_PLUGIN_IDS.actionPalette]: `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}/ghost.action-palette/mf-manifest.json`,
  [LOCAL_PLUGIN_IDS.appearanceSettings]: `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}/ghost.appearance-settings/mf-manifest.json`,
  [LOCAL_PLUGIN_IDS.domainUnplannedOrders]: `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}/ghost.domain.unplanned-orders/mf-manifest.json`,
  [LOCAL_PLUGIN_IDS.domainVesselView]: `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}/ghost.domain.vessel-view/mf-manifest.json`,
  [LOCAL_PLUGIN_IDS.pluginStarter]: `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}/ghost.plugin-starter/mf-manifest.json`,
  [LOCAL_PLUGIN_IDS.sharedUiCapabilities]: `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}/ghost.shared.ui-capabilities/mf-manifest.json`,
  [LOCAL_PLUGIN_IDS.sampleContractConsumer]: `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}/ghost.sample.contract-consumer/mf-manifest.json`,
  [LOCAL_PLUGIN_IDS.shadcnThemeBridge]: `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}/ghost.shadcn.theme-bridge/mf-manifest.json`,
  [LOCAL_PLUGIN_IDS.themeDefault]: `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}/ghost.theme.default/mf-manifest.json`,
});

export function buildEntryOverrideMap(overrides) {
  return new Map(Object.entries(overrides));
}
