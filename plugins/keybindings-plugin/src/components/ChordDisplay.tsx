import { Kbd, KbdGroup } from "@ghost-shell/ui";

interface ChordDisplayProps {
  keybinding: string;
}

function capitalizeKey(key: string): string {
  if (key.length === 1) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function SingleChord({ chord }: { chord: string }) {
  const keys = chord.split("+");
  return (
    <KbdGroup>
      {keys.map((key, i) => (
        <Kbd key={i}>{capitalizeKey(key)}</Kbd>
      ))}
    </KbdGroup>
  );
}

export function ChordDisplay({ keybinding }: ChordDisplayProps) {
  const chords = keybinding.split(" ");

  if (chords.length === 1) {
    return <SingleChord chord={chords[0]} />;
  }

  return (
    <span className="inline-flex items-center gap-1">
      {chords.map((chord, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-muted-foreground text-[10px]">→</span>}
          <SingleChord chord={chord} />
        </span>
      ))}
    </span>
  );
}
