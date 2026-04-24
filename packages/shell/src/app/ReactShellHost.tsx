import { useEffect, useRef } from "react";
import { createGhostShell } from "../create-ghost-shell.js";

export function ReactShellHost(): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const shell = createGhostShell({
      root,
      tenant: { id: "demo" },
      theme: "ghost.theme.tokyo-night",
      debug: true,
    });

    shell.start().catch(console.error);

    return () => shell.dispose();
  }, []);

  return <div ref={rootRef} style={{ height: "100%" }} />;
}
