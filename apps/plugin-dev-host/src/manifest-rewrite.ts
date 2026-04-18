/**
 * Rewrites the publicPath in Module Federation manifests to an absolute URL.
 *
 * The gateway is the single source of truth for origin/port/pluginId,
 * so rewriting happens here rather than coupling plugins to env vars.
 *
 * Only publicPath is set — the MF runtime resolves relative asset paths
 * against it, so asset paths in the manifest must stay relative.
 */

interface MfManifest {
  metaData?: { publicPath?: string };
  [key: string]: unknown;
}

/**
 * Deep-clones an MF manifest and sets `metaData.publicPath` to the given
 * absolute base URL (e.g. `http://127.0.0.1:41337/ghost.theme.default/`).
 *
 * Asset paths are left relative — the Module Federation runtime resolves
 * them against publicPath at load time.
 */
export function rewriteManifestPublicPath(
  manifest: Record<string, unknown>,
  absoluteBase: string,
): Record<string, unknown> {
  const rewritten = JSON.parse(JSON.stringify(manifest)) as MfManifest;

  if (rewritten.metaData) {
    rewritten.metaData.publicPath = absoluteBase;
  }

  return rewritten as Record<string, unknown>;
}
