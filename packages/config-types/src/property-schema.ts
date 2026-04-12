import type { ConfigurationLayer } from "./types.js";

export type ConfigChangePolicy =
  | "full-pipeline"
  | "staging-gate"
  | "direct-allowed"
  | "emergency-override";

export type ConfigurationVisibility =
  | "public"
  | "admin"
  | "platform"
  | "internal";

export type ConfigurationRole =
  | "platform-ops"
  | "tenant-admin"
  | "scope-admin"
  | "integrator"
  | "user"
  | "support"
  | "system"
  | "service"
  | "platform-service";

export type ConfigReloadBehavior =
  | "hot"
  | "restart-required"
  | "rolling-restart";

export interface ConfigurationPropertySchema {
  type: "string" | "number" | "boolean" | "object" | "array";
  default?: unknown;
  description?: string | undefined;
  enum?: ReadonlyArray<unknown> | undefined;
  minimum?: number | undefined;
  maximum?: number | undefined;
  expressionAllowed?: boolean | undefined;
  changePolicy?: ConfigChangePolicy | undefined;
  visibility?: ConfigurationVisibility | undefined;
  sensitive?: boolean | undefined;
  maxOverrideLayer?: ConfigurationLayer | undefined;
  writeRestriction?: ReadonlyArray<ConfigurationRole> | undefined;
  viewConfig?: boolean | undefined;
  instanceOverridable?: boolean | undefined;
  reloadBehavior?: ConfigReloadBehavior | undefined;
}
