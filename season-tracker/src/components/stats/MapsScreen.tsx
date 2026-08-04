/**
 * Stats → Maps, built to the prototype's spec (V.maps).
 *
 * A source strip, four overall figures, the casualty and formation makeup as
 * three stacked bars, the most-played table with a USA-share split bar, and
 * then one collapsible panel per playable area holding a card per map.
 *
 * Faction hues are used here and only here on the split bars, because the
 * question genuinely is "which side won" — everywhere the question is ordinal
 * (a stance, a share) the sequential ramp does the work instead.
 */
import { useState } from 'react';
import { MAP_AREAS, areaOf, prettyArea } from '../../stats/mapAreas';
import { mapAttacker } from '../../stats/mapCatalog';
import { FORMATION_LABEL } from '../../stats/labels';
import type { FormationCounts, TrackerMapEntry, TrackerMapStats } from '../../stats/statsEngine';

type Source = 'tracker' | 'scoreboard';

const pct = (w: number, t: number) => (t > 0 ? ((w / t) * 100).toFixed(1) : '0.0');
const pc = (w: number, t: number) => (t > 0 ? (w / t) * 100 : 0);

const STOPS = [
  { key: 'in_form', hue: 'var(--st1)' },
  { key: 'skirm', hue: 'var(--st2)' },
  { key: 'oob', hue: 'var(--st3)' },
] as const;

/** A side's losses split by stance, with the counts spelled out beneath. */
function StanceBlock({
  label,
  tone,
  total,
  form,
  hasFormation,
}: {
  label: string;
  tone: 'usa' | 'csa' | null;
  total: number;
  form: FormationCounts;
  hasFormation: boolean;
}) {
  const sum = form.in_form + form.skirm + form.oob;
  return (
    <div className="col">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {tone ? <span className={`tag ${tone}`}>{label}</span> : <span className="cap">{label}</span>}
        <span className="rule" />
        <span className="meta">{total.toLocaleString()} men</span>
      </div>
      {hasFormation && sum > 0 ? (
        <>
          <div className="stack" style={{ marginTop: 9 }}>
            {STOPS.map(({ key, hue }) => (
              <i key={key} style={{ width: `${pc(form[key], sum)}%`, background: hue }} />
            ))}
          </div>
          <div className="leg">
            {STOPS.map(({ key, hue }) => (
              <span key={key}>
                <i style={{ background: hue }} />
                {FORMATION_LABEL[key]}
                <b style={{ color: 'var(--ink)', fontWeight: 400 }}>{form[key].toLocaleString()}</b>
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="stack" style={{ marginTop: 9 }}>
          <i style={{ flex: 1, background: 'var(--line-2)' }} />
        </div>
      )}
    </div>
  );
}

function MapCard({ name, s }: { name: string; s: TrackerMapEntry }) {
  // The catalog is keyed on the playable area, which is what a map name is here.
  const attacker = s.hasAttacker === false ? null : mapAttacker(name);
  // Attacker/defender rounds exclude draws, so they get their own denominator.
  const decided = s.attackerWins + s.defenderWins;
  const perRound = s.plays > 0 ? Math.round(s.totalCasualties / s.plays) : 0;
  return (
    <div className="mapcard">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="wor-name" style={{ fontSize: 13 }}>{name}</span>
        <span className="rule" />
        <span className="meta">{s.plays} round{s.plays === 1 ? '' : 's'}</span>
      </div>
      <div className="stack" style={{ marginTop: 8 }}>
        <i style={{ width: `${pc(s.usaWins, s.plays)}%`, background: 'var(--union)' }} />
        <i style={{ width: `${pc(s.csaWins, s.plays)}%`, background: 'var(--reb)' }} />
        <i style={{ flex: 1, background: 'var(--line-2)' }} />
      </div>
      <div className="leg">
        <span><i style={{ background: 'var(--union)' }} />USA {s.usaWins} · {pct(s.usaWins, s.plays)}%</span>
        <span><i style={{ background: 'var(--reb)' }} />CSA {s.csaWins} · {pct(s.csaWins, s.plays)}%</span>
        {s.draws > 0 && <span><i style={{ background: 'var(--line-2)' }} />Draw {s.draws}</span>}
      </div>
      <dl className="mapdl">
        {attacker ? (
          <>
            <dt>{attacker} attacks</dt>
            <dd>
              attacker {s.attackerWins} · {pct(s.attackerWins, decided)}% — defender {s.defenderWins} ·{' '}
              {pct(s.defenderWins, decided)}%
            </dd>
          </>
        ) : (
          <>
            <dt>Attacker</dt>
            <dd>none — both sides hold ground on this one</dd>
          </>
        )}
        <dt>Avg losses</dt>
        <dd>
          <span className="f-usa">USA {s.avgLossesUsa}</span> · <span className="f-csa">CSA {s.avgLossesCsa}</span>{' '}
          <span style={{ color: 'var(--ink-3)' }}>
            ({s.totalCasualties.toLocaleString()} total · {perRound}/rd)
          </span>
        </dd>
        {s.hasFormation && (
          <>
            <dt>Avg formation</dt>
            <dd>
              <span className="f-usa">USA</span> {s.avgFormationUsa.in_form} IF · {s.avgFormationUsa.skirm} Sk ·{' '}
              {s.avgFormationUsa.oob} OoL
              <br />
              <span className="f-csa">CSA</span> {s.avgFormationCsa.in_form} IF · {s.avgFormationCsa.skirm} Sk ·{' '}
              {s.avgFormationCsa.oob} OoL
            </dd>
          </>
        )}
        {s.hasMorale && (
          <>
            <dt>Usual morale</dt>
            <dd>
              <span className="f-usa">USA {s.avgMoraleUsa || '—'}</span> ·{' '}
              <span className="f-csa">CSA {s.avgMoraleCsa || '—'}</span>
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}

export function MapsScreen({
  trackerMapStats,
  scoreboardMapStats,
}: {
  trackerMapStats?: TrackerMapStats;
  scoreboardMapStats?: TrackerMapStats;
}) {
  const trackerRounds = trackerMapStats?.overall.totalRounds ?? 0;
  const scoreboardRounds = scoreboardMapStats?.overall.totalRounds ?? 0;
  // Which source to prefer. Resolved per render rather than only at mount:
  // the stats often arrive after the panel does, and a mount-time default left
  // the tab reading "no data" while the other source had rounds all along.
  const [preferred, setPreferred] = useState<Source>('tracker');
  const source: Source =
    preferred === 'tracker'
      ? trackerRounds > 0 || scoreboardRounds === 0 ? 'tracker' : 'scoreboard'
      : scoreboardRounds > 0 || trackerRounds === 0 ? 'scoreboard' : 'tracker';

  const [closed, setClosed] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const stats = source === 'tracker' ? trackerMapStats : scoreboardMapStats;

  const ctl = (
    <div className="panel">
      <div className="ctl">
        <span
          className="cap"
          title="Tracker: rounds bound to a week. Scoreboards: every imported round, bound or not."
        >
          Source
        </span>
        <div className="seg">
          <button aria-pressed={source === 'tracker'} onClick={() => setPreferred('tracker')}>
            Tracker ({trackerRounds})
          </button>
          <button aria-pressed={source === 'scoreboard'} onClick={() => setPreferred('scoreboard')}>
            Scoreboards ({scoreboardRounds})
          </button>
        </div>
        <span className="rule" />
        <span className="meta">
          {source === 'tracker' ? 'rounds recorded on a night' : 'every imported scoreboard, bound or not'}
        </span>
      </div>
    </div>
  );

  if (!stats || stats.overall.totalRounds === 0) {
    return (
      <>
        {ctl}
        <div className="panel">
          <header className="ph"><h2>Maps</h2><span className="rule" /></header>
          <div className="pb">
            <p className="note">
              {source === 'tracker'
                ? 'No tracker map data — bind rounds to a night, or switch to Scoreboards.'
                : 'No scoreboard map data — import scoreboards to populate it.'}
            </p>
          </div>
        </div>
      </>
    );
  }

  const { overall, byMap } = stats;
  // Attacker/defender denominator excludes Conquest/Contention (no attacker).
  // Falls back for bundles shared before attackerRounds existed.
  const atkRounds = overall.attackerRounds ?? overall.attackerWins + overall.defenderWins;
  const names = Object.keys(byMap);
  const mostPlayed = Object.entries(byMap).sort(([, a], [, b]) => b.plays - a.plays).slice(0, 6);
  const orphans = names.filter((m) => !areaOf(m));

  const tiles: [string, string, string][] = [
    ['USA overall', `${pct(overall.usaWins, overall.totalRounds)}%`, `${overall.usaWins} of ${overall.totalRounds}`],
    ['CSA overall', `${pct(overall.csaWins, overall.totalRounds)}%`, `${overall.csaWins} of ${overall.totalRounds}`],
    ['Attackers won', `${pct(overall.attackerWins, atkRounds)}%`, `${overall.attackerWins} of ${atkRounds}`],
    ['Defenders won', `${pct(overall.defenderWins, atkRounds)}%`, `${overall.defenderWins} of ${atkRounds}`],
  ];

  const areaPanel = (key: string, areaMaps: string[], title: string) => {
    const played = areaMaps.filter((m) => byMap[m]).sort((a, b) => byMap[b].plays - byMap[a].plays);
    if (played.length === 0) return null;
    const open = !closed.has(key);
    const rounds = played.reduce((s, m) => s + byMap[m].plays, 0);
    const usa = played.reduce((s, m) => s + byMap[m].usaWins, 0);
    const missing = areaMaps.filter((m) => !byMap[m]);
    return (
      <div className="panel" key={key}>
        <header
          className="ph area-h"
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onClick={() => toggle(key)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(key); } }}
        >
          <span className="cap" style={{ width: 11 }}>{open ? '▼' : '▶'}</span>
          <h2>{title}</h2>
          <span className="rule" />
          <span className="meta">
            {played.length} of {areaMaps.length} maps drawn · {rounds} rounds · USA {pct(usa, rounds)}%
          </span>
        </header>
        {open && (
          <div className="pb">
            <div className="mapgrid">
              {played.map((m) => <MapCard key={m} name={m} s={byMap[m]} />)}
            </div>
            {missing.length > 0 && (
              <p className="note" style={{ marginTop: 11 }}>Never drawn: {missing.join(' · ')}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {ctl}

      <div className="panel">
        <header className="ph">
          <h2>Overall</h2><span className="rule" />
          <span className="meta">{names.length} map{names.length === 1 ? '' : 's'} drawn</span>
        </header>
        <div className="pb flush">
          <div className="kpis">
            {tiles.map(([h, v, x]) => (
              <div className="kpi" key={h}>
                <div className="cap">{h}</div><div className="v">{v}</div><div className="h">{x}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {overall.totalCasualties > 0 && (
        <div className="panel">
          <header className="ph">
            <h2>Casualties and formation makeup</h2><span className="rule" />
            <span className="meta">{overall.totalCasualties.toLocaleString()} men lost</span>
          </header>
          <div className="pb flush">
            <div className="cols">
              <StanceBlock label="USA" tone="usa" total={overall.usaCasualties} form={overall.usaFormation} hasFormation={overall.hasFormation} />
              <StanceBlock label="CSA" tone="csa" total={overall.csaCasualties} form={overall.csaFormation} hasFormation={overall.hasFormation} />
              <StanceBlock label="Overall" tone={null} total={overall.totalCasualties} form={overall.formationTotal} hasFormation={overall.hasFormation} />
            </div>
            {!overall.hasFormation && (
              <p className="note" style={{ marginTop: 11 }}>
                Week-bound rounds record a casualty total only — no stance split is stored with them. Switch
                the source to Scoreboards to see where the losses happened.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="panel">
        <header className="ph">
          <h2>Most played</h2><span className="rule" />
          <span className="meta">split bar is USA share of wins</span>
        </header>
        <div className="pb flush scroll-x">
          <table>
            <thead>
              <tr>
                <th>Map</th><th>Area</th>
                <th className="num">Rounds</th><th className="num">USA</th><th className="num">CSA</th>
                <th>Split</th><th className="num">Casualties</th>
              </tr>
            </thead>
            <tbody>
              {mostPlayed.map(([name, s]) => (
                <tr key={name}>
                  <td className="wor-name">{name}</td>
                  <td>{areaOf(name) && <span className="tag q">{prettyArea(areaOf(name)!)}</span>}</td>
                  <td className="num">{s.plays}</td>
                  <td className="num f-usa">{s.usaWins}</td>
                  <td className="num f-csa">{s.csaWins}</td>
                  <td>
                    <div className="stack" style={{ width: 110 }}>
                      <i style={{ width: `${pc(s.usaWins, s.plays)}%`, background: 'var(--union)' }} />
                      <i style={{ flex: 1, background: 'var(--reb)' }} />
                    </div>
                  </td>
                  <td className="num" style={{ color: 'var(--ink-2)' }}>
                    {(s.plays > 0 ? Math.round(s.totalCasualties / s.plays) : 0).toLocaleString()}/rd
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {Object.entries(MAP_AREAS).map(([key, areaMaps]) => areaPanel(key, areaMaps, prettyArea(key)))}
      {orphans.length > 0 && areaPanel('__other', orphans, 'Other')}
    </>
  );
}
