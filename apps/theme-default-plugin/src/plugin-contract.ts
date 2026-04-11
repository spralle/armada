import type { PluginContract } from "@ghost/plugin-contracts";

/**
 * Ghost Default Themes plugin contract.
 *
 * Packages the default dark palette (matching the original hardcoded shell values)
 * plus a Tokyo Night theme using minimal Omarchy-compatible palette input
 * to prove the derivation engine fills all gaps.
 */
export const pluginContract: PluginContract = {
  manifest: {
    id: "ghost.theme.default",
    name: "Ghost Default Themes",
    version: "1.0.0",
  },
  activationEvents: ["onStartup"],
  contributes: {
    themes: [
      {
        id: "ghost.theme.default.dark",
        name: "Default Dark",
        mode: "dark",
        palette: {
          background: "#14161a",
          foreground: "#e9edf3",
          surface: "#121922",
          overlay: "#101723",
          primary: "#7cb4ff",
          secondary: "#495f87",
          accent: "#7cb4ff",
          muted: "#2b3040",
          error: "#8b3030",
          warning: "#f2a65a",
          success: "#22c55e",
          info: "#3b82f6",
          border: "#334564",
          ring: "#7cb4ff",
          cursor: "#e9edf3",
          selectionBackground: "#7cb4ff",
        },
      },
      {
        id: "ghost.theme.tokyo-night",
        name: "Tokyo Night",
        mode: "dark",
        palette: {
          background: "#1a1b26",
          foreground: "#a9b1d6",
          accent: "#7aa2f7",
          cursor: "#c0caf5",
          selectionBackground: "#7aa2f7",
        },
        terminal: {
          color0: "#32344a",
          color1: "#f7768e",
          color2: "#9ece6a",
          color3: "#e0af68",
          color4: "#7aa2f7",
          color5: "#ad8ee6",
          color6: "#449dab",
          color7: "#787c99",
          color8: "#444b6a",
          color9: "#ff7a93",
          color10: "#b9f27c",
          color11: "#ff9e64",
          color12: "#7da6ff",
          color13: "#bb9af7",
          color14: "#0db9d7",
          color15: "#acb0d0",
        },
      },
    ],
  },
};
