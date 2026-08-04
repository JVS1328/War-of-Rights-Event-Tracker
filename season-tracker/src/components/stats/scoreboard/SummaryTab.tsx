// Summary tab of the round drawer, read as a matchup: the result first, then
// one mirrored line per metric, then the notes those numbers support. The
// event-binding panel sits above it when binding is allowed, and the raw
// casualty and weapon tables stay underneath for anyone reading exact figures.
import { useEffect, useState } from 'react';
import { Cell, fmtDuration, whenOf } from '../drawerPrimitives';
import { roundDurationSeconds } from '../../../stats/statsEngine';
import { Pill } from '../../ui';
import { Spine } from '../../ui/Spine';
import { Scoreline } from '../../ui/Scoreline';
import { StanceBar } from '../../ui/StanceBar';
import { matchupScore, matchupRows, matchupKeys } from '../../../stats/roundMatchup';
import type { Scoreboard } from '../../../stats/types';
import type { StoredScoreboard } from '../../../stats/StatsRepository';
import type { RoundAutofill } from '../../../stats/eventBinding';

interface WeekRef {
  id: string;
  name: string;
  round1Flipped?: boolean;
  round2Flipped?: boolean;
}

/** Share of a per-side total as a one-decimal percent, or `—` when the side has
 *  no entries (so we never render 0/0). */
function sharePct(n: number, total: number | null): string {
  if (total == null) return '';
  if (total <= 0) return '—';
  return `${((n / total) * 100).toFixed(1)}%`;
}

export function SummaryTab({
  sb,
  stored,
  canBind = false,
  weeks = [],
  buildAutofill,
  onApply,
}: {
  sb: Scoreboard;
  stored: StoredScoreboard | null;
  canBind?: boolean;
  weeks?: WeekRef[];
  buildAutofill?: (sb: Scoreboard, flipped: boolean) => RoundAutofill;
  onApply?: (weekId: string, round: 1 | 2, af: RoundAutofill) => void;
}) {
  const [weekId, setWeekId] = useState('');
  const [round, setRound] = useState<1 | 2>(1);
  useEffect(() => {
    setWeekId(stored?.binding?.weekId ?? '');
    setRound(stored?.binding?.round ?? 1);
  }, [stored?.id, stored?.binding?.weekId, stored?.binding?.round]);

  const meta = sb.meta;

  // Per-side casualty rows: total, then each stance as a share of that side's total.
  const statRow = (label: string, usa: number, csa: number, usaTotal: number | null, csaTotal: number | null) => (
    <tr key={label} className="border-t border-[color:var(--color-border)]">
      <td className="px-3 py-1 text-[color:var(--color-text-1)]">{label}</td>
      <td className="px-3 py-1 text-right font-mono tabular-nums text-[color:var(--color-usa)]">{usa}</td>
      <td className="px-2 py-1 text-right font-mono tabular-nums text-[color:var(--color-text-2)]">{sharePct(usa, usaTotal)}</td>
      <td className="px-3 py-1 text-right font-mono tabular-nums text-[color:var(--color-csa)]">{csa}</td>
      <td className="px-2 py-1 text-right font-mono tabular-nums text-[color:var(--color-text-2)]">{sharePct(csa, csaTotal)}</td>
    </tr>
  );

  const casUsa = meta.casualties.USA;
  const casCsa = meta.casualties.CSA;

  // Deaths-by-weapon: union of weapon keys across both sides, each as a share of
  // that side's total weapon deaths.
  const weaponKeys = [...new Set([...Object.keys(meta.deathsByWeapon.USA), ...Object.keys(meta.deathsByWeapon.CSA)])].sort();
  const usaWeaponTotal = Object.values(meta.deathsByWeapon.USA).reduce((n, v) => n + v, 0);
  const csaWeaponTotal = Object.values(meta.deathsByWeapon.CSA).reduce((n, v) => n + v, 0);

  return (
    <div className="text-base font-mono">
      {canBind && buildAutofill && weeks.length > 0 && (
        <div className="p-3 border-b border-[color:var(--color-border)]">
          <BindPanel
            sb={sb}
            stored={stored}
            weeks={weeks}
            weekId={weekId}
            round={round}
            setWeekId={setWeekId}
            setRound={setRound}
            buildAutofill={buildAutofill}
            onApply={onApply}
          />
        </div>
      )}

      <MatchupHead sb={sb} />

      <section className="p-4 border-b border-[color:var(--color-border)] grid grid-cols-3 gap-px bg-[color:var(--color-border)]">
        <Cell label="map" value={meta.map} />
        <Cell label="mode" value={meta.mode} />
        <Cell label="area" value={meta.area ?? '—'} />
        <Cell label="winner" value={meta.winner ?? '—'} />
        <Cell label="duration" value={fmtDuration(roundDurationSeconds(sb))} />
        <Cell label="round ended" value={whenOf(sb.recordedAt)} />
        <Cell label="pop @ start" value={String(meta.popRoundStart ?? '—')} />
        <Cell label="pop @ peak" value={String(meta.popRoundPeak ?? '—')} />
        <Cell label="pop @ end" value={String(meta.popRoundEnd ?? '—')} />
        <Cell label="unique players" value={String(meta.popRoundMax ?? '—')} />
        <Cell label="morale USA" value={meta.moraleUsa ?? '—'} />
        <Cell label="morale CSA" value={meta.moraleCsa ?? '—'} />
      </section>

      <section className="p-4 border-b border-[color:var(--color-border)]">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-2)] mb-2">casualties</div>
        <table className="w-full">
          <thead className="text-2xs uppercase tracking-wider text-[color:var(--color-text-2)]">
            <tr>
              <th className="text-left px-3 py-1"></th>
              <th className="text-right px-3 py-1">USA</th>
              <th className="text-right px-2 py-1">%</th>
              <th className="text-right px-3 py-1">CSA</th>
              <th className="text-right px-2 py-1">%</th>
            </tr>
          </thead>
          <tbody>
            {statRow('total', casUsa.total, casCsa.total, null, null)}
            {statRow('in formation', casUsa.inForm, casCsa.inForm, casUsa.total, casCsa.total)}
            {statRow('skirmish', casUsa.skirm, casCsa.skirm, casUsa.total, casCsa.total)}
            {statRow('out of line', casUsa.oob, casCsa.oob, casUsa.total, casCsa.total)}
          </tbody>
        </table>
      </section>

      <section className="p-4">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-2)] mb-2">deaths by weapon</div>
        {weaponKeys.length === 0 ? (
          <div className="text-xs text-[color:var(--color-text-2)] py-2">No weapon data</div>
        ) : (
          <table className="w-full">
            <thead className="text-2xs uppercase tracking-wider text-[color:var(--color-text-2)]">
              <tr>
                <th className="text-left px-3 py-1">weapon</th>
                <th className="text-right px-3 py-1">USA died</th>
                <th className="text-right px-2 py-1">%</th>
                <th className="text-right px-3 py-1">CSA died</th>
                <th className="text-right px-2 py-1">%</th>
              </tr>
            </thead>
            <tbody>
              {weaponKeys.map((w) =>
                statRow(
                  w,
                  meta.deathsByWeapon.USA[w] ?? 0,
                  meta.deathsByWeapon.CSA[w] ?? 0,
                  usaWeaponTotal,
                  csaWeaponTotal,
                ),
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

/** Scoreline, the mirrored metric spine, the stance split and the notes. */
function MatchupHead({ sb }: { sb: Scoreboard }) {
  const score = matchupScore(sb);
  const rows = matchupRows(sb);
  const keys = matchupKeys(sb);
  const cas = sb.meta.casualties;

  return (
    <>
      <section className="border-b border-[color:var(--color-border)]">
        <Scoreline
          winner={score.winner === 'USA' ? 'a' : score.winner === 'CSA' ? 'b' : null}
          label={score.winner ? 'Final' : 'Draw'}
          a={{
            chip: <Pill tone="usa">Union</Pill>,
            name: 'USA',
            value: score.usaInflicted,
            sub: 'casualties inflicted',
            hue: 'var(--color-usa)',
          }}
          b={{
            chip: <Pill tone="csa">Confederate</Pill>,
            name: 'CSA',
            value: score.csaInflicted,
            sub: 'casualties inflicted',
            hue: 'var(--color-csa)',
          }}
        />
      </section>

      <section className="border-b border-[color:var(--color-border)]">
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <h3 className="text-xs uppercase tracking-wider text-[color:var(--color-text-1)]">
            How the round was won
          </h3>
          <span className="h-px flex-1 bg-[color:var(--color-border)]" />
          <span className="text-2xs uppercase tracking-wider text-[color:var(--color-text-2)]">
            one line per metric
          </span>
        </div>
        <Spine rows={rows} aSide="usa" bSide="csa" />
      </section>

      <section className="grid grid-cols-1 gap-4 border-b border-[color:var(--color-border)] p-4 sm:grid-cols-2">
        <StanceBar counts={toCounts(cas.USA)} label="USA — where the losses happened" />
        <StanceBar counts={toCounts(cas.CSA)} label="CSA — where the losses happened" />
      </section>

      {keys.length > 0 && (
        <section className="border-b border-[color:var(--color-border)]">
          {keys.map((k) => (
            <div key={k.title} className="border-t border-[color:var(--color-border)] px-4 py-3 first:border-t-0">
              <div className="flex items-center gap-2">
                {k.side ? (
                  <Pill tone={k.side === 'USA' ? 'usa' : 'csa'}>{k.side}</Pill>
                ) : (
                  <Pill tone="neutral">Round</Pill>
                )}
                <strong className="text-sm text-[color:var(--color-text-0)]">{k.title}</strong>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[color:var(--color-text-1)]">{k.body}</p>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

/** The meta block counts casualties by stance; the bar wants FormationCounts. */
const toCounts = (c: { inForm: number; skirm: number; oob: number }) => ({
  in_form: c.inForm,
  skirm: c.skirm,
  oob: c.oob,
});

function BindPanel({
  sb,
  stored,
  weeks,
  weekId,
  round,
  setWeekId,
  setRound,
  buildAutofill,
  onApply,
}: {
  sb: Scoreboard;
  stored: StoredScoreboard | null;
  weeks: WeekRef[];
  weekId: string;
  round: 1 | 2;
  setWeekId: (id: string) => void;
  setRound: (r: 1 | 2) => void;
  buildAutofill: (sb: Scoreboard, flipped: boolean) => RoundAutofill;
  onApply?: (weekId: string, round: 1 | 2, af: RoundAutofill) => void;
}) {
  const selWeek = weeks.find((w) => w.id === weekId);
  const flipped = !!(round === 1 ? selWeek?.round1Flipped : selWeek?.round2Flipped);
  const af = buildAutofill(sb, flipped);
  const selectCls =
    'bg-[color:var(--color-bg-1)] border border-[color:var(--color-border)] px-1 py-0.5 text-[color:var(--color-text-0)]';
  return (
    <div className="border border-[color:var(--color-border)] bg-[color:var(--color-bg-2)] p-2 space-y-2">
      <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-2)]">
        Bind to event round → auto-fill standings
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select value={weekId} onChange={(e) => setWeekId(e.target.value)} className={selectCls}>
          <option value="">Select week…</option>
          {weeks.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <select value={round} onChange={(e) => setRound(Number(e.target.value) === 2 ? 2 : 1)} className={selectCls}>
          <option value={1}>Round 1</option>
          <option value={2}>Round 2</option>
        </select>
        <button
          disabled={!weekId}
          onClick={() => weekId && onApply?.(weekId, round, af)}
          className="border border-[color:var(--color-accent)] text-[color:var(--color-accent)] px-2 py-0.5 hover:bg-[color:var(--color-accent-soft)] disabled:opacity-40"
        >
          Apply auto-fill
        </button>
      </div>
      <div className="text-xs text-[color:var(--color-text-1)] space-y-0.5">
        <div>
          Map:{' '}
          {af.validMap ? (
            af.area
          ) : (
            <span className="text-[color:var(--color-warn)]">{af.areaRaw ?? '—'} — unknown area, set manually</span>
          )}
        </div>
        <div>
          Sides: A = {af.sideAFaction} · B = {af.sideBFaction}
          {af.flipped && <span className="text-[color:var(--color-warn)]"> (round flipped)</span>}
        </div>
        <div>
          Winner: {af.winner ?? 'Draw'} {af.winnerSide ? `→ side ${af.winnerSide}` : ''}
        </div>
        <div>
          Casualties: side A {af.casualtiesA} · side B {af.casualtiesB}
        </div>
      </div>
      {stored?.binding && (
        <div className="text-xs text-[color:var(--color-ok)]">
          Currently bound to {weeks.find((w) => w.id === stored.binding!.weekId)?.name ?? 'a week'} · Round{' '}
          {stored.binding.round}
        </div>
      )}
    </div>
  );
}
