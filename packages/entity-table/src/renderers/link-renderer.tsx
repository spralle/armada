import type { CellRendererFn } from "../cell-renderer-types.js";

export const linkRenderer: CellRendererFn = (value, _row, props) => {
  if (value == null) return "—";
  const str = String(value);
  const label = (props?.label as string) ?? str;
  const href = str.includes("@") && !str.startsWith("mailto:") ? `mailto:${str}` : str;
  return (
    <a
      href={href}
      className="text-primary underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {label}
    </a>
  );
};
