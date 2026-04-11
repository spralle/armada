export const LOCAL_PLUGIN_IDS = Object.freeze({
  domainUnplannedOrders: "ghost.domain.unplanned-orders",
  domainVesselView: "ghost.domain.vessel-view",
  pluginStarter: "ghost.plugin-starter",
  sharedUiCapabilities: "ghost.shared.ui-capabilities",
  sampleContractConsumer: "ghost.sample.contract-consumer",
  themeDefault: "ghost.theme.default",
});

export const SORTED_LOCAL_PLUGIN_IDS = Object.freeze([
  LOCAL_PLUGIN_IDS.domainUnplannedOrders,
  LOCAL_PLUGIN_IDS.domainVesselView,
  LOCAL_PLUGIN_IDS.pluginStarter,
  LOCAL_PLUGIN_IDS.sampleContractConsumer,
  LOCAL_PLUGIN_IDS.sharedUiCapabilities,
  LOCAL_PLUGIN_IDS.themeDefault,
]);

export const DEFAULT_LOCAL_PLUGIN_ENTRIES = Object.freeze({
  [LOCAL_PLUGIN_IDS.domainUnplannedOrders]: "http://127.0.0.1:4173/mf-manifest.json",
  [LOCAL_PLUGIN_IDS.domainVesselView]: "http://127.0.0.1:4174/mf-manifest.json",
  [LOCAL_PLUGIN_IDS.pluginStarter]: "http://127.0.0.1:4171/mf-manifest.json",
  [LOCAL_PLUGIN_IDS.sharedUiCapabilities]: "http://127.0.0.1:4175/mf-manifest.json",
  [LOCAL_PLUGIN_IDS.sampleContractConsumer]: "http://127.0.0.1:4172/mf-manifest.json",
  [LOCAL_PLUGIN_IDS.themeDefault]: "http://127.0.0.1:4176/mf-manifest.json",
});

export function buildEntryOverrideMap(overrides) {
  return new Map(Object.entries(overrides));
}
