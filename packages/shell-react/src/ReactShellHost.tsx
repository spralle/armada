import { useEffect, useRef } from "react";
import { startShell } from "@ghost-shell/shell-dom";

export function ReactShellHost(): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    startShell(root);
  }, []);

  return <div ref={rootRef} style={{ height: "100%" }} />;
}
