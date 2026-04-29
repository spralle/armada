import { Badge } from "@ghost-shell/ui";
import { CodeBlock } from "./CodeBlock";

interface CodeBlockEntry {
  readonly title: string;
  readonly code: string | object;
  readonly defaultOpen?: boolean;
}

interface DemoShellProps {
  readonly title: string;
  readonly description: string;
  readonly features: readonly string[];
  readonly schema: string;
  readonly data?: string;
  readonly codeBlocks?: readonly CodeBlockEntry[];
  readonly children: React.ReactNode;
}

export function DemoShell({ title, description, features, schema, data, codeBlocks, children }: DemoShellProps) {
  return (
    <div className="p-6">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          {features.map((f) => (
            <Badge key={f} variant="secondary" className="text-xs">
              {f}
            </Badge>
          ))}
        </div>
      </header>

      {/* Table area — full width */}
      <div className="mb-6">{children}</div>

      {/* Code blocks — horizontal row below */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <CodeBlock title="Zod Schema" code={schema} />
        {data && <CodeBlock title="Sample Data" code={data} />}
        {codeBlocks?.map((block) => (
          <CodeBlock key={block.title} title={block.title} code={block.code} defaultOpen={block.defaultOpen} />
        ))}
      </div>
    </div>
  );
}
