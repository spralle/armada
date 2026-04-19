interface ChordDisplayProps {
  keybinding: string;
}

export function ChordDisplay({ keybinding }: ChordDisplayProps) {
  const parts = keybinding.split(" ");

  if (parts.length === 1) {
    return <code className="text-[11px]">{keybinding}</code>;
  }

  return (
    <span>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && (
            <span className="text-muted-foreground text-[10px]"> → </span>
          )}
          <code className="text-[11px]">{part}</code>
        </span>
      ))}
    </span>
  );
}
