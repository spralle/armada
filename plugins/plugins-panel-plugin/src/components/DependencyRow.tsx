import { Badge } from "@ghost/ui";
import { usePlugins } from "./PluginsContext.js";

interface DependencyRowProps {
  readonly id: string;
  readonly type: string;
  readonly linkable?: boolean;
}

export function DependencyRow({ id, type, linkable = false }: DependencyRowProps) {
  const { findPlugin, scrollToPlugin } = usePlugins();
  const exists = linkable && findPlugin(id) !== undefined;

  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="outline" className="text-[9px] px-1 py-0">{type}</Badge>
      {exists ? (
        <button
          type="button"
          onClick={() => scrollToPlugin(id)}
          className="underline cursor-pointer hover:opacity-70 text-primary"
        >
          {id}
        </button>
      ) : (
        <span className="text-muted-foreground">{id}</span>
      )}
    </div>
  );
}
