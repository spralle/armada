/**
 * Rewrites relative asset paths in Module Federation manifests to absolute URLs.
 *
 * The gateway is the single source of truth for origin/port/pluginId,
 * so rewriting happens here rather than coupling plugins to env vars.
 */

interface ManifestAssets {
  js?: { sync?: string[]; async?: string[] };
  css?: { sync?: string[]; async?: string[] };
}

interface ManifestEntry {
  assets?: ManifestAssets;
}

interface MfManifest {
  metaData?: { publicPath?: string };
  shared?: ManifestEntry[];
  exposes?: ManifestEntry[];
  [key: string]: unknown;
}

/**
 * Deep-clones an MF manifest and rewrites all relative asset paths
 * to use an absolute base URL (e.g. `http://127.0.0.1:41337/ghost.theme.default/`).
 *
 * Touches:
 * - `metaData.publicPath`
 * - `shared[].assets.{js,css}.{sync,async}`
 * - `exposes[].assets.{js,css}.{sync,async}`
 */
export function rewriteManifestPublicPath(
  manifest: Record<string, unknown>,
  absoluteBase: string,
): Record<string, unknown> {
  // Deep clone to avoid mutating the original object
  const rewritten = JSON.parse(JSON.stringify(manifest)) as MfManifest;

  if (rewritten.metaData) {
    rewritten.metaData.publicPath = absoluteBase;
  }

  function prefixAssetPaths(assets: ManifestAssets | undefined): void {
    if (!assets) return;
    for (const type of ["js", "css"] as const) {
      const group = assets[type];
      if (!group) continue;
      for (const timing of ["sync", "async"] as const) {
        if (Array.isArray(group[timing])) {
          group[timing] = group[timing].map((path: string) =>
            path.startsWith("http") ? path : `${absoluteBase}${path}`,
          );
        }
      }
    }
  }

  if (Array.isArray(rewritten.shared)) {
    for (const item of rewritten.shared) prefixAssetPaths(item.assets);
  }

  if (Array.isArray(rewritten.exposes)) {
    for (const item of rewritten.exposes) prefixAssetPaths(item.assets);
  }

  return rewritten as Record<string, unknown>;
}
