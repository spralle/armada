import type { CellRendererRegistry } from "../cell-registry.js";

export { textRenderer } from "./text-renderer.js";
export { badgeRenderer } from "./badge-renderer.js";
export { currencyRenderer } from "./currency-renderer.js";
export { dateRenderer, datetimeRenderer } from "./date-renderer.js";
export { booleanRenderer } from "./boolean-renderer.js";
export { linkRenderer } from "./link-renderer.js";
export { tagsRenderer } from "./tags-renderer.js";
export { avatarRenderer } from "./avatar-renderer.js";

import { textRenderer } from "./text-renderer.js";
import { badgeRenderer } from "./badge-renderer.js";
import { currencyRenderer } from "./currency-renderer.js";
import { dateRenderer, datetimeRenderer } from "./date-renderer.js";
import { booleanRenderer } from "./boolean-renderer.js";
import { linkRenderer } from "./link-renderer.js";
import { tagsRenderer } from "./tags-renderer.js";
import { avatarRenderer } from "./avatar-renderer.js";

export function registerBuiltins(registry: CellRendererRegistry): void {
  registry.register("text", textRenderer);
  registry.register("badge", badgeRenderer);
  registry.register("currency", currencyRenderer);
  registry.register("date", dateRenderer);
  registry.register("datetime", datetimeRenderer);
  registry.register("boolean", booleanRenderer);
  registry.register("link", linkRenderer);
  registry.register("tags", tagsRenderer);
  registry.register("avatar", avatarRenderer);
}
