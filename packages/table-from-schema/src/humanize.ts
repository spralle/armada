/**
 * Convert a camelCase or snake_case field path to a human-readable label.
 *
 * "orderNumber" → "Order Number"
 * "created_at"  → "Created At"
 * "firstName"   → "First Name"
 * "id"          → "Id"
 */
export function humanize(path: string): string {
  // Take the last segment if it's a dotted path
  const segment = path.includes(".") ? path.split(".").pop()! : path;

  const words = segment
    // Insert space before uppercase letters in camelCase
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    // Replace underscores/hyphens with spaces
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/);

  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
