/** Anchor edges — bitfield for combining (top|bottom|left|right). */
export enum AnchorEdge {
  None = 0,
  Top = 1,
  Bottom = 2,
  Left = 4,
  Right = 8,
}

/** Keyboard interactivity modes for layer surfaces. */
export enum KeyboardInteractivity {
  None = "none",
  OnDemand = "on_demand",
  Exclusive = "exclusive",
}

/** Input (pointer) behavior modes for layer surfaces. */
export enum InputBehavior {
  Opaque = "opaque",
  Passthrough = "passthrough",
  ContentAware = "content_aware",
}

/** Layer definition (built-in or plugin-registered). */
export interface LayerDefinition {
  name: string;
  zOrder: number;
  defaultKeyboard: KeyboardInteractivity;
  defaultPointer: InputBehavior;
  supportsSessionLock: boolean;
  pluginContributable: boolean;
  /** Undefined for built-in layers, plugin ID for plugin-registered. */
  pluginId?: string | undefined;
}

/** Focus grab configuration. */
export interface FocusGrabConfig {
  /** true = default dim, string = CSS color. */
  backdrop?: boolean | string | undefined;
  dismissOnOutsideClick?: boolean | undefined;
}

/** Auto-stack configuration for notification-like surfaces. */
export interface AutoStackConfig {
  direction: "up" | "down" | "left" | "right";
  /** Gap in pixels. */
  gap: number;
}

/** Plugin layer surface contribution (declared in plugin contract). */
export interface PluginLayerSurfaceContribution {
  id: string;
  /** Module Federation component path. */
  component: string;
  /** Target layer name. */
  layer: string;
  /** Bitfield of AnchorEdge values. */
  anchor: number;
  size?: { width?: number | string | undefined; height?: number | string | undefined } | undefined;
  margin?:
    | {
        top?: number | undefined;
        right?: number | undefined;
        bottom?: number | undefined;
        left?: number | undefined;
      }
    | undefined;
  /** >0 = reserve space, 0 = respect zones, -1 = ignore zones. */
  exclusiveZone?: number | undefined;
  keyboardInteractivity?: KeyboardInteractivity | undefined;
  inputBehavior?: InputBehavior | undefined;
  focusGrab?: FocusGrabConfig | undefined;
  /** 0.0 to 1.0. */
  opacity?: number | undefined;
  /** CSS backdrop-filter value e.g. 'blur(12px)'. */
  backdropFilter?: string | undefined;
  autoStack?: AutoStackConfig | undefined;
  sessionLock?: boolean | undefined;
  /** Sort order within same anchor point. */
  order?: number | undefined;
  /** Conditional expression for visibility. */
  when?: string | undefined;
}

/** Plugin layer definition (plugin can register custom layers). */
export interface PluginLayerDefinition {
  name: string;
  zOrder: number;
  defaultKeyboard?: KeyboardInteractivity | undefined;
  defaultPointer?: InputBehavior | undefined;
  supportsSessionLock?: boolean | undefined;
}

/** Runtime API passed to mounted layer surfaces. */
export interface LayerSurfaceContext {
  readonly surfaceId: string;
  readonly layerName: string;
  onConfigure(callback: (rect: { width: number; height: number }) => void): { dispose(): void };
  onClose(callback: () => void): { dispose(): void };
  getExclusiveZones(): { top: number; right: number; bottom: number; left: number };
  setLayer(name: string): void;
  setOpacity(value: number): void;
  setExclusiveZone(value: number): void;
  dismiss(): void;
  grabFocus(options?: FocusGrabConfig): void;
  releaseFocus(): void;
}
