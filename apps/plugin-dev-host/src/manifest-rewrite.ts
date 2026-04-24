/**
 * Rewrites the publicPath in Module Federation manifests to an absolute URL.
 *
 * The gateway is the single source of truth for origin/port/pluginId,
 * so rewriting happens here rather than coupling plugins to env vars.
 *
 * publicPath is set on metaData, and relative asset paths in shared[]
 * and exposes[] entries are prefixed with the absolute base URL.
 */

interface MfManifest {
  metaData?: { publicPath?: string };
  shared?: MfEntry[];
  exposes?: MfEntry[];
  [key: string]: unknown;
}

interface MfEntry {
  assets?: {
    js?: { sync?: string[]; async?: string[] };
    css?: { sync?: string[]; async?: string[] };
  };
  [key: string]: unknown;
}

function isAbsoluteUrl(path: string): boolean {
  return path.startsWith("http://") || path.startsWith("https://");
}

function prefixPaths(paths: string[], base: string): string[] {
  return paths.map((p) => (isAbsoluteUrl(p) ? p : `${base}${p}`));
}

function rewriteEntryAssets(entries: MfEntry[], base: string): void {
  for (const entry of entries) {
    if (!entry.assets) continue;
    const { js, css } = entry.assets;
    if (js?.sync) js.sync = prefixPaths(js.sync, base);
    if (js?.async) js.async = prefixPaths(js.async, base);
    if (css?.sync) css.sync = prefixPaths(css.sync, base);
    if (css?.async) css.async = prefixPaths(css.async, base);
  }
}

/**
 * Deep-clones an MF manifest, sets `metaData.publicPath` to the given
 * absolute base URL, and prefixes relative asset paths in shared/exposes.
 */
export function rewriteManifestPublicPath(
  manifest: Record<string, unknown>,
  absoluteBase: string,
): Record<string, unknown> {
  const rewritten = JSON.parse(JSON.stringify(manifest)) as MfManifest;

  if (rewritten.metaData) {
    rewritten.metaData.publicPath = absoluteBase;
  }

  if (rewritten.shared) rewriteEntryAssets(rewritten.shared, absoluteBase);
  if (rewritten.exposes) rewriteEntryAssets(rewritten.exposes, absoluteBase);

  return rewritten as Record<string, unknown>;
}
