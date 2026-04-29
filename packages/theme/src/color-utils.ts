/**
 * Pure color math utilities for theme derivation.
 * No external dependencies — operates in RGB/HSL space on hex strings.
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** Parse a hex color string (#RGB, #RRGGBB) to an RGB tuple (0-255). */
export function hexToRgb(hex: string): Rgb {
  const cleaned = hex.replace(/^#/, "");
  let r: number;
  let g: number;
  let b: number;

  if (cleaned.length === 3) {
    r = parseInt(cleaned[0] + cleaned[0], 16);
    g = parseInt(cleaned[1] + cleaned[1], 16);
    b = parseInt(cleaned[2] + cleaned[2], 16);
  } else if (cleaned.length === 6) {
    r = parseInt(cleaned.slice(0, 2), 16);
    g = parseInt(cleaned.slice(2, 4), 16);
    b = parseInt(cleaned.slice(4, 6), 16);
  } else {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  return { r, g, b };
}

/** Convert an RGB tuple (0-255) to a 6-digit hex string with leading #. */
export function rgbToHex(rgb: Rgb): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHexPart = (v: number) => clamp(v).toString(16).padStart(2, "0");
  return `#${toHexPart(rgb.r)}${toHexPart(rgb.g)}${toHexPart(rgb.b)}`;
}

/** Convert RGB (0-255) to HSL (h: 0-360, s: 0-100, l: 0-100). */
export function rgbToHsl(rgb: Rgb): Hsl {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  } else if (max === g) {
    h = ((b - r) / d + 2) / 6;
  } else {
    h = ((r - g) / d + 4) / 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/** Convert HSL (h: 0-360, s: 0-100, l: 0-100) to RGB (0-255). */
export function hslToRgb(hsl: Hsl): Rgb {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  if (s === 0) {
    const val = Math.round(l * 255);
    return { r: val, g: val, b: val };
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/**
 * Adjust lightness of a hex color by a percentage delta.
 * Positive percent brightens, negative darkens.
 */
export function adjustLightness(hex: string, percent: number): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  hsl.l = Math.max(0, Math.min(100, hsl.l + percent));
  return rgbToHex(hslToRgb(hsl));
}

/**
 * Desaturate a hex color by reducing saturation by a percentage of its current value.
 * E.g. desaturate("#ff0000", 40) reduces saturation by 40% of current S.
 */
export function desaturate(hex: string, percent: number): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  hsl.s = Math.max(0, hsl.s * (1 - percent / 100));
  return rgbToHex(hslToRgb(hsl));
}

/**
 * Compute relative luminance per WCAG 2.x (0–1 range).
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  const linearize = (c: number): number => {
    const sRgb = c / 255;
    return sRgb <= 0.03928 ? sRgb / 12.92 : ((sRgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}

/** WCAG contrast ratio between two hex colors. */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Return "#ffffff" or "#000000" for best contrast against the given background.
 * Meets WCAG AA (ratio >= 4.5) when possible.
 */
export function contrastSafe(backgroundHex: string): string {
  const whiteRatio = contrastRatio(backgroundHex, "#ffffff");
  const blackRatio = contrastRatio(backgroundHex, "#000000");
  return whiteRatio >= blackRatio ? "#ffffff" : "#000000";
}

/**
 * Blend a foreground color with a background at a given opacity (0–1).
 * Simulates the visual result of `rgba(fg, opacity)` over `bg`.
 */
export function blendWithBackground(fgHex: string, bgHex: string, opacity: number): string {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  const blend = (f: number, b: number) => Math.round(f * opacity + b * (1 - opacity));
  return rgbToHex({ r: blend(fg.r, bg.r), g: blend(fg.g, bg.g), b: blend(fg.b, bg.b) });
}

/** Validate that a string is a well-formed hex color (#RGB or #RRGGBB). */
export function isValidHex(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

/** Append alpha (0–1) to a hex color, producing #RRGGBBAA. */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  const base = rgbToHex(rgb);
  const alphaHex = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${base}${alphaHex}`;
}
