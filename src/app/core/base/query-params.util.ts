/**
 * Pure comparison for route query parameter maps.
 * True when left and right have identical keys and their string values match.
 */
export function sameQueryParams(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean {
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => String(left[key]) === String(right[key]))
  );
}
