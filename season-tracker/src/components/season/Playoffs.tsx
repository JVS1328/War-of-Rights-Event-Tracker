/**
 * Season → Playoffs, to the prototype's V.playoffs plus its format-planner
 * revision: the bracket as it stands, who is qualifying on the table as it
 * sits, formats that would fit the nights available, and why the lengths are
 * what they are.
 */
import type { StandingRow } from './SeasonScreens';

export interface BracketSlot {
  /** "Round 1", "Semi-final", "Final" — whatever the stage is called. */
  stage: string;
  /** The night it is scheduled on. */
  night: string;
  a: string;
  b: string;
  roundsA: number;
  roundsB: number;
  map1: string | null;
  map2: string | null;
}

export interface FormatOption {
  field: number;
  series: number;
  style: string;
  entry: string;
  bestOf: string;
  nights: number;
  /** Share of the league that qualifies, as a whole percentage. */
  share: number;
}

const Panel = ({
  title, meta, flush = false, children,
}: { title: string; meta?: string; flush?: boolean; children: React.ReactNode }) => (
  <div className="panel">
    <header className="ph"><h2>{title}</h2><span className="rule" />{meta && <span className="meta">{meta}</span>}</header>
    <div className={flush ? 'pb flush' : 'pb'}>{children}</div>
  </div>
);

export function Playoffs({
  enabled,
  bracket,
  standings,
  divisions,
  qualifyPerDivision,
  nightsAvailable,
  formats,
  onApplyFormat,
  onSettings,
}: {
  enabled: boolean;
  bracket: BracketSlot[];
  standings: StandingRow[];
  divisions: { name: string }[];
  /** Places that qualify from each division. */
  qualifyPerDivision: number;
  nightsAvailable: number;
  formats: FormatOption[];
  onApplyFormat?: (f: FormatOption) => void;
  onSettings?: () => void;
}) {
  if (!enabled) {
    return (
      <Panel title="Playoffs" meta="off for this season">
        <p className="note">
          Playoffs are switched off. Turn them on in Settings to draw a bracket, and the planner here will say which
          formats fit the nights you have left.
        </p>
        {onSettings && (
          <div style={{ marginTop: 9 }}><button className="gh" onClick={onSettings}>Open settings</button></div>
        )}
      </Panel>
    );
  }

  return (
    <>
      <Panel title="Bracket" meta={`${bracket.length} playoff night${bracket.length === 1 ? '' : 's'}`} flush>
        {bracket.length === 0 ? (
          <div className="pb"><p className="note">No bracket drawn yet.</p></div>
        ) : (
          <div className="bracket">
            {bracket.map((b, i) => (
              <div className="bslot" key={i}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span className="cap">{b.stage}</span>
                  <span className="rule" />
                  <span className="meta wor-name">{b.night}</span>
                </div>
                <div className="bpair">
                  <div className={`bteam${b.roundsA > b.roundsB ? ' win' : ''}`}>
                    <span className="wor-name">{b.a}</span><span className="s">{b.roundsA}</span>
                  </div>
                  <div className={`bteam${b.roundsB > b.roundsA ? ' win' : ''}`}>
                    <span className="wor-name">{b.b}</span><span className="s">{b.roundsB}</span>
                  </div>
                </div>
                <div className="note" style={{ marginTop: 6 }}>
                  {b.map1 ?? '—'}{b.map2 ? ` · ${b.map2}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Qualification" meta="as the standings sit" flush>
        <div className="cols">
          {divisions.map((dv) => {
            const rows = standings.filter((r) => r.division === dv.name).slice(0, 4);
            return (
              <div className="col" key={dv.name}>
                <div className="cap" style={{ marginBottom: 7 }}>{dv.name} · qualifiers</div>
                {rows.map((r, i) => (
                  <div
                    key={r.unit}
                    className={`bteam${i < qualifyPerDivision ? ' win' : ''}`}
                    style={{ border: '1px solid var(--line)', marginTop: 5 }}
                  >
                    <span><span className="pos">{i + 1}</span> <span className="wor-name">{r.unit}</span></span>
                    <span className="s">{r.points} pts · {r.w}–{r.l}</span>
                  </div>
                ))}
                {rows.length === 0 && <p className="note">Nobody in this division.</p>}
                <div className="note" style={{ marginTop: 9 }}>
                  Top {qualifyPerDivision} qualify. Seeds below take wildcard seats if the field expands.
                </div>
              </div>
            );
          })}
          {divisions.length === 0 && (
            <div className="col"><p className="note">No divisions — qualification is straight off the table.</p></div>
          )}
        </div>
      </Panel>

      {formats.length > 0 && (
        <Panel title="Format planner" meta={`${nightsAvailable} playoff nights on the calendar`} flush>
          <div className="cols">
            {formats.map((o, i) => (
              <div className={`col${o.nights <= nightsAvailable ? ' stripe-usa' : ''}`} key={i}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="cap">Option {i + 1}</span>
                  <span className="rule" />
                  {o.nights <= nightsAvailable ? (
                    <span className="tag usa">Fits</span>
                  ) : (
                    <span className="tag q" style={{ borderColor: 'var(--live)', color: 'var(--live)' }}>
                      {o.nights - nightsAvailable} night over
                    </span>
                  )}
                </div>
                <div className="mid wor-name" style={{ marginTop: 6 }}>
                  {o.field}-team {o.style.toLowerCase()}
                </div>
                <div className="note" style={{ marginTop: 5 }}>{o.entry} · {o.bestOf}</div>
                <div className="hb" style={{ marginTop: 9 }}>
                  <span className="note">nights</span>
                  <span className="t"><i style={{ width: `${Math.min((o.nights / 6) * 100, 100)}%` }} /></span>
                  <span className="n">{o.nights}</span>
                </div>
                <div className="note" style={{ marginTop: 6 }}>
                  <b>{o.series}</b> series · <b>{o.share}%</b> of the league qualifies
                </div>
                {onApplyFormat && (
                  <div style={{ marginTop: 9 }}>
                    <button className="gh" aria-pressed={i === 0} onClick={() => onApplyFormat(o)}>Apply</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Why these lengths">
        <div className="prose">
          <p>
            <b>A round hosts one matchup</b>, because each side has one lead — so a night fits two. That, not the
            number of stages, is what sets the length.
          </p>
          <p>
            <b>"Rounds per stage" is really first to (N ÷ 2) + 1 wins.</b> 2 and 3 are the same series: both need two
            wins and both can run to a third round. The planner prefers the odd setting, which says what it means.
          </p>
          <p className="note">
            Only brackets the tracker draws whole are offered. A field that half-draws — where the standings promise a
            seed the bracket never plays — is never recommended, though the audit will explain one you configure by
            hand.
          </p>
        </div>
      </Panel>
    </>
  );
}
