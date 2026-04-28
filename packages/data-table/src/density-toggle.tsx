import { Button } from "@ghost-shell/ui";
import { AlignJustify, Menu, StretchHorizontal } from "lucide-react";

export type TableDensity = "compact" | "default" | "spacious";

interface DensityToggleProps {
  density: TableDensity;
  onDensityChange: (density: TableDensity) => void;
}

const CYCLE: TableDensity[] = ["default", "compact", "spacious"];
const ICONS: Record<TableDensity, React.ReactNode> = {
  compact: <AlignJustify className="h-4 w-4" />,
  default: <Menu className="h-4 w-4" />,
  spacious: <StretchHorizontal className="h-4 w-4" />,
};

export function DensityToggle({ density, onDensityChange }: DensityToggleProps) {
  const next = CYCLE[(CYCLE.indexOf(density) + 1) % CYCLE.length];
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8"
      onClick={() => onDensityChange(next)}
      title={`Density: ${density}`}
    >
      {ICONS[density]}
    </Button>
  );
}
