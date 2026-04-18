import type {
  PluginRegistryDiagnosticEntry,
} from "@ghost/plugin-contracts";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Badge,
} from "@ghost/ui";

interface DiagnosticsSectionProps {
  diagnostics: PluginRegistryDiagnosticEntry[];
}

export function DiagnosticsSection({ diagnostics }: DiagnosticsSectionProps) {
  return (
    <Accordion type="single" collapsible className="border-t border-border">
      <AccordionItem value="diagnostics" className="border-0">
        <AccordionTrigger className="py-2 text-xs hover:no-underline">
          <span className="flex items-center gap-1.5">
            Diagnostics
            <Badge variant="secondary" className="text-[9px] px-1 py-0">
              {diagnostics.length}
            </Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-1 text-[11px] max-h-48 overflow-y-auto">
            {diagnostics.map((d, i) => (
              <div
                key={`${d.at}-${d.pluginId}-${i}`}
                className="flex items-start gap-1.5 py-0.5 text-muted-foreground"
              >
                <Badge
                  variant={d.level === "warn" ? "destructive" : "secondary"}
                  className="text-[8px] px-1 py-0 shrink-0"
                >
                  {d.level}
                </Badge>
                <span className="font-mono">{d.pluginId}</span>
                <span className="flex-1">{d.message}</span>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
