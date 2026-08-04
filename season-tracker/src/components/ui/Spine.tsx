import { spineRow, isTextRow, type SpineRow, type SpineTextRow } from './spineModel';

export type SpineSide = 'usa' | 'csa' | 'neutral';

const HUE: Record<SpineSide, string> = {
  usa: 'var(--union)',
  csa: 'var(--reb)',
  neutral: 'var(--ink)',
};

/**
 * Mirrored comparison: two values either side of a centre rule, one line per
 * metric, the winning side at full strength and the other muted. Reads a round,
 * a night, two players or two units — only the values and the side colours change.
 *
 * Use `neutral` for both sides when the comparison is not between factions, so
 * a faction hue never stands in for "player A".
 */
export function Spine({
  rows,
  aSide = 'usa',
  bSide = 'csa',
}: {
  rows: (SpineRow | SpineTextRow)[];
  aSide?: SpineSide;
  bSide?: SpineSide;
}) {
  return (
    <div className="spine">
      {rows.map((row) => {
        if (isTextRow(row)) {
          return (
            <div className="sr txt" key={row.label}>
              <div />
              <div className="tv l">{row.aText}</div>
              <div className="sl">
                <div className="h">{row.label}</div>
                {row.sub && <div className="u">{row.sub}</div>}
              </div>
              <div className="tv r">{row.bText}</div>
              <div />
            </div>
          );
        }
        const v = spineRow(row);
        const aOn = v.winner !== 'b';
        const bOn = v.winner !== 'a';
        return (
          <div className="sr" key={v.label}>
            <div className={`sv l${aOn ? '' : ' off'}`}>{v.aText}</div>
            <span className="trk l">
              <i style={{ width: `${v.aWidth}%`, background: HUE[aSide], opacity: aOn ? 1 : 0.28 }} />
            </span>
            <div className="sl">
              <div className="h">{v.label}</div>
              {v.sub && <div className="u">{v.sub}</div>}
            </div>
            <span className="trk">
              <i style={{ width: `${v.bWidth}%`, background: HUE[bSide], opacity: bOn ? 1 : 0.28 }} />
            </span>
            <div className={`sv r${bOn ? '' : ' off'}`}>{v.bText}</div>
          </div>
        );
      })}
    </div>
  );
}
