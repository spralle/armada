// Example: co-located view configuration file for VesselMap
// This file demonstrates the defineViewConfig convention.
// In a real plugin, this would be at: src/VesselMap.config.ts

import { defineViewConfig } from "@ghost/config-types";

export default defineViewConfig({
  viewId: "VesselMap",
  description: "Vessel map view configuration",
  category: "navigation",
  schemas: [
    {
      type: "number",
      description: "Default zoom level",
      minimum: 1,
      maximum: 20,
    },
    {
      type: "boolean",
      description: "Show vessel labels on map",
    },
    {
      type: "string",
      description: "Default map tile provider",
    },
  ],
});
