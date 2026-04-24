import { createGhostShell } from "@ghost-shell/shell";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Shell root element '#root' not found.");
}

const shell = createGhostShell({
  root,
  tenant: { id: "demo" },
  theme: "ghost.theme.tokyo-night",
  debug: true,
  hmr: true,
});

shell.start().catch(console.error);
