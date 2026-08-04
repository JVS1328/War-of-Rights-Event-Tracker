/**
 * Geometry and verdict for one row of a mirrored comparison ("the spine").
 *
 * A spine row puts two values either side of a centre rule and fills a bar
 * from the centre outward for each. The longer bar is always the bigger
 * number; which side *wins* the row is separate, because for casualties taken
 * or ticket cost the smaller number is the better one.
 *
 * Kept free of React so the verdict logic can be tested directly — it is the
 * part that is easy to get backwards.
 */

export interface SpineRow {
  label: string;
  /** Short qualifier under the label, e.g. "lower is better". */
  sub?: string;
  a: number;
  b: number;
  /** Display text; falls back to the raw value. */
  aText?: string;
  bText?: string;
  /** Set when the smaller value wins the row. */
  lower?: boolean;
}

export interface SpineRowView {
  label: string;
  sub?: string;
  aText: string;
  bText: string;
  /** Percentage of that half's track, 0–100. */
  aWidth: number;
  bWidth: number;
  winner: 'a' | 'b' | 'tie';
}

/** A row of plain text either side of the label — morale, lead unit, and such. */
export interface SpineTextRow {
  label: string;
  sub?: string;
  aText: string;
  bText: string;
  text: true;
}

export const isTextRow = (r: SpineRow | SpineTextRow): r is SpineTextRow =>
  (r as SpineTextRow).text === true;

/**
 * Bar length is relative to the larger magnitude, so the bigger number always
 * fills its half. Magnitudes are used, so a negative delta still draws.
 */
export function spineRow(row: SpineRow): SpineRowView {
  const max = Math.max(Math.abs(row.a), Math.abs(row.b));
  const width = (v: number) => (max === 0 ? 0 : (Math.abs(v) / max) * 100);
  const winner: SpineRowView['winner'] =
    row.a === row.b ? 'tie' : (row.lower ? row.a < row.b : row.a > row.b) ? 'a' : 'b';
  return {
    label: row.label,
    sub: row.sub,
    aText: row.aText ?? String(row.a),
    bText: row.bText ?? String(row.b),
    aWidth: width(row.a),
    bWidth: width(row.b),
    winner,
  };
}

/** How many rows each side takes; ties count for neither. */
export function tally(rows: SpineRow[]): { a: number; b: number; tied: number } {
  let a = 0;
  let b = 0;
  let tied = 0;
  for (const r of rows) {
    const v = spineRow(r).winner;
    if (v === 'a') a++;
    else if (v === 'b') b++;
    else tied++;
  }
  return { a, b, tied };
}
