import { pluginContract } from "./plugin-contract-expose.js";

export { pluginContract as pluginStarterContract };

console.log("[plugin-starter] POC plugin stub ready", pluginContract.manifest.id);
