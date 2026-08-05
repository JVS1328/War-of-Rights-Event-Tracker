/**
 * Season → Night builder, to the prototype's V.night.
 *
 * A night is: what kind of night it is, who is on each side, who leads, and
 * what happened in each round. The round type decides the rest — how many lead
 * slots there are, whether points and Elo move, whether the maps go on
 * cooldown — so it sits at the top with those consequences spelled out as
 * badges rather than buried in a help note.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';

export type Side = 'A' | 'B';
/** Where a dragged unit can land: either side, or off the night entirely. */
export type Drop = Side | 'bench';
export type RoundType = 'Regular' | 'Single round leads' | 'Playoffs' | 'Fun round';

export interface RoundTypeRule {
  leads: 0 | 2 | 4;
  points: boolean;
  elo: boolean;
  cooldown: boolean;
  note: string;
}

export const RT_RULES: Record<RoundType, RoundTypeRule> = {
  'Regular': {
    leads: 2, points: true, elo: true, cooldown: true,
    note: 'One lead a side, both rounds. Two lead slots a night.',
  },
  'Single round leads': {
    leads: 4, points: true, elo: true, cooldown: true,
    note: 'Four leads a night — one per side per round. No unit leads both rounds.',
  },
  'Playoffs': {
    leads: 4, points: false, elo: true, cooldown: true,
    note: 'Leads per round, and no points are awarded. Elo still moves, at the playoff multiplier.',
  },
  'Fun round': {
    leads: 0, points: false, elo: false, cooldown: false,
    note: 'Exhibition. No points, no Elo, and the maps played do not go on cooldown.',
  },
};

export const ROUND_TYPES = Object.keys(RT_RULES) as RoundType[];

// ── form primitives, matching the prototype's field/pick/check ──────────────

export function Field({ label, note, children }: { label: string; note?: ReactNode; children: ReactNode }) {
  return (
    <div className="fld">
      <label className="cap">{label}</label>
      {children}
      {note && <div className="note">{note}</div>}
    </div>
  );
}

export function Check({
  label,
  note,
  checked,
  onChange,
}: {
  label: string;
  note?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="chk">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="l">{label}</span>
        {note && <span className="note">{note}</span>}
      </span>
    </label>
  );
}

/** On / off state of a rule this night is playing under. */
const Badge = ({ on, label }: { on: boolean; label: string }) => (
  <span className="tag q" style={on ? undefined : { opacity: 0.45, borderStyle: 'dashed' }}>
    {on ? '' : 'no '}{label}
  </span>
);

export interface NightRound {
  round: 1 | 2;
  map: string | null;
  winner: Side | null;
  flipped: boolean;
  casualtiesA: number | null;
  casualtiesB: number | null;
  swaps: string[];
}

export interface NightBuilderWeek {
  id: string | number;
  name: string;
  teamA: string[];
  teamB: string[];
  leadA: string | null;
  leadB: string | null;
  leadA_r1: string | null;
  leadB_r1: string | null;
  leadA_r2: string | null;
  leadB_r2: string | null;
  rounds: [NightRound, NightRound];
}

export function NightBuilder({
  weeks,
  week,
  type,
  registry,
  headcount,
  counts,
  elo,
  balancePoints,
  balancePointsStyle,
  tokenUnits,
  maps,
  mapCooldown,
  onPickWeek,
  onType,
  onRename,
  onNewNight,
  onDuplicate,
  onMoveUnit,
  onClearSides,
  onLead,
  onRound,
  onSwap,
  onBalancer,
  onAssignStats,
}: {
  weeks: { id: string | number; name: string }[];
  week: NightBuilderWeek | null;
  type: RoundType;
  /** Every registered unit, for the bench. */
  registry: string[];
  /** Unit → expected head count, for the side sizes. */
  headcount: Record<string, number>;
  /** Unit → min/max men, so a side can show the spread and not just the mean. */
  counts: Record<string, { min: number; max: number }>;
  /** Unit → Elo, for the side's average rating. */
  elo: Record<string, number>;
  /** Balance points a swapped unit earns, and in which style. 0 = off. */
  balancePoints: number;
  balancePointsStyle: string;
  /** Units that hold a standings token; the rest are drawn faint. */
  tokenUnits: string[];
  maps: string[];
  mapCooldown: number;
  onPickWeek: (id: string) => void;
  onType: (t: RoundType) => void;
  onRename: (name: string) => void;
  onNewNight: () => void;
  onDuplicate: () => void;
  onMoveUnit: (unit: string, to: Drop) => void;
  onClearSides: () => void;
  onLead: (side: Side, round: 0 | 1 | 2, unit: string | null) => void;
  onRound: (round: 1 | 2, patch: Partial<NightRound>) => void;
  onSwap: (round: 1 | 2, unit: string, on: boolean) => void;
  onBalancer: () => void;
  /**
   * Open the mapping from this night's units to the scoreboard regiments that
   * played as them. Omitted when there is nothing to map against.
   */
  onAssignStats?: () => void;
}) {
  const R = RT_RULES[type];
  const scores = new Set(tokenUnits);
  const size = (list: string[]) => list.reduce((s, u) => s + (headcount[u] ?? 0), 0);

  const picker = (
    <div className="ctl">
      <span className="cap">Night</span>
      <select value={week ? String(week.id) : ''} onChange={(e) => onPickWeek(e.target.value)} aria-label="Night">
        <option value="">Pick a night…</option>
        {weeks.map((w) => (
          <option key={String(w.id)} value={String(w.id)}>{w.name}</option>
        ))}
      </select>
      <button className="gh" onClick={onNewNight}>＋ New night</button>
      <button className="gh" onClick={onDuplicate} disabled={!week}>Duplicate</button>
      <span className="rule" />
      <Badge on={R.points} label="points" />
      <Badge on={R.elo} label="Elo" />
      <Badge on={R.cooldown} label="map cooldown" />
      <span className="tag q">{R.leads} leads</span>
    </div>
  );

  if (!week) {
    return (
      <div className="panel">
        {picker}
        <div className="pb"><p className="note">Pick a night above, or add one.</p></div>
      </div>
    );
  }

  const assigned = new Set([...week.teamA, ...week.teamB]);
  const bench = registry.filter((u) => !assigned.has(u));

  // Dragging a unit between sides. The dataTransfer payload is what actually
  // crosses the drop, so an external drag into the page cannot be mistaken for
  // one of ours; `dragging` is only for dimming the chip you picked up.
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropZone, setDropZone] = useState<Drop | null>(null);
  const startDrag = (e: React.DragEvent, unit: string) => {
    e.dataTransfer.setData('text/x-wor-unit', unit);
    e.dataTransfer.effectAllowed = 'move';
    setDragging(unit);
  };
  const dropOn = (e: React.DragEvent, to: Drop) => {
    const unit = e.dataTransfer.getData('text/x-wor-unit');
    setDragging(null);
    setDropZone(null);
    if (unit) onMoveUnit(unit, to);
  };

  const leadOf = (s: Side, r: 0 | 1 | 2): string | null =>
    r === 0 ? (s === 'A' ? week.leadA : week.leadB)
      : r === 1 ? (s === 'A' ? week.leadA_r1 : week.leadB_r1)
        : (s === 'A' ? week.leadA_r2 : week.leadB_r2);

  const leadSelect = (s: Side, r: 0 | 1 | 2, label: string, note?: string) => {
    const units = s === 'A' ? week.teamA : week.teamB;
    return (
      <Field label={label} note={note} key={`${s}${r}`}>
        <select value={leadOf(s, r) ?? ''} onChange={(e) => onLead(s, r, e.target.value || null)}>
          <option value="">—</option>
          {units.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </Field>
    );
  };

  const sideCol = (s: Side) => {
    const units = s === 'A' ? week.teamA : week.teamB;
    const nightLead = s === 'A' ? week.leadA : week.leadB;
    return (
      <div className={`col ${s === 'A' ? 'stripe-usa' : 'stripe-csa'}`} key={s}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`tag ${s === 'A' ? 'usa' : 'csa'}`}>Team {s}</span>
          <span className="tag q">{s === 'A' ? 'Home' : 'Away'}</span>
          <span className="rule" />
          <span className="meta">{units.length} units</span>
        </div>
        {/* What the side is worth before a shot is fired: how many men it can
            put up at worst and at best, and how the ladder rates it. */}
        <div className="ostat" style={{ marginTop: 9 }}>
          <span><b>{units.reduce((t, u) => t + (counts[u]?.min ?? 0), 0)}</b><i>min pop</i></span>
          <span><b>{units.reduce((t, u) => t + (counts[u]?.max ?? 0), 0)}</b><i>max pop</i></span>
          <span><b>{size(units).toFixed(0)}</b><i>avg pop</i></span>
          <span>
            <b>{units.length ? Math.round(units.reduce((t, u) => t + (elo[u] ?? 1500), 0) / units.length) : 1500}</b>
            <i>avg Elo</i>
          </span>
        </div>
        <div
          style={{ marginTop: 9, minHeight: 34 }}
          onDragOver={(e) => { e.preventDefault(); setDropZone(s); }}
          onDragLeave={() => setDropZone((z) => (z === s ? null : z))}
          onDrop={(e) => { e.preventDefault(); dropOn(e, s); }}
          data-drop={dropZone === s || undefined}
          className="dropzone"
        >
          {units.map((u) => (
            <div
              key={u}
              className="bteam"
              draggable
              onDragStart={(e) => startDrag(e, u)}
              onDragEnd={() => { setDragging(null); setDropZone(null); }}
              style={{
                border: '1px solid var(--line)', marginTop: 4, cursor: 'grab',
                ...(scores.has(u) ? {} : { opacity: 0.55, borderStyle: 'dashed' }),
                ...(dragging === u ? { opacity: 0.4 } : {}),
              }}
            >
              <span>
                <span className="wor-name">{u}</span>
                {R.leads === 2 && u === nightLead && (
                  <span className="tag q" style={{ borderColor: 'var(--ink)', color: 'var(--ink)', marginLeft: 6 }}>
                    Lead ★
                  </span>
                )}
              </span>
              <span className="s">
                {headcount[u] ? `~${headcount[u].toFixed(0)}` : '—'}
                <button
                  className="gh"
                  style={{ padding: '1px 5px', marginLeft: 6 }}
                  onClick={() => onMoveUnit(u, s === 'A' ? 'B' : 'A')}
                >
                  → {s === 'A' ? 'B' : 'A'}
                </button>
              </span>
            </div>
          ))}
          {units.length === 0 && <p className="note" style={{ marginTop: 4 }}>Nobody on this side yet.</p>}
        </div>
        {R.leads === 0 && <div className="note" style={{ marginTop: 9 }}>Fun round — no lead is recorded.</div>}
        {R.leads === 2 && <div style={{ marginTop: 9 }}>{leadSelect(s, 0, `Lead — Team ${s}`, 'leads both rounds')}</div>}
        {R.leads === 4 && (
          <div className="grid-f" style={{ marginTop: 9 }}>
            {leadSelect(s, 1, `R1 lead — Team ${s}`)}
            {leadSelect(s, 2, `R2 lead — Team ${s}`, 'must differ from R1')}
          </div>
        )}
      </div>
    );
  };

  const roundCol = (r: NightRound) => {
    const swappable = [...week.teamA, ...week.teamB];
    return (
      <div className="col" key={r.round}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="cap">Round {r.round}</span>
          <span className="rule" />
          {r.winner
            ? <span className={`tag ${r.winner === 'A' ? 'usa' : 'csa'}`}>Team {r.winner}</span>
            : <span className="meta">not played</span>}
        </div>
        <div className="grid-f" style={{ marginTop: 9 }}>
          <Field
            label="Map"
            note={R.cooldown ? `maps from the last ${mapCooldown} weeks are hidden` : 'cooldown does not apply'}
          >
            <select value={r.map ?? ''} onChange={(e) => onRound(r.round, { map: e.target.value || null })}>
              <option value="">—</option>
              {maps.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Winner">
            <select
              value={r.winner ?? ''}
              onChange={(e) => onRound(r.round, { winner: (e.target.value || null) as Side | null })}
            >
              <option value="">Not played</option>
              <option value="A">Team A</option>
              <option value="B">Team B</option>
            </select>
          </Field>
          <Field label="Casualties — A">
            <input
              type="number"
              value={r.casualtiesA ?? ''}
              onChange={(e) => onRound(r.round, { casualtiesA: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </Field>
          <Field label="Casualties — B">
            <input
              type="number"
              value={r.casualtiesB ?? ''}
              onChange={(e) => onRound(r.round, { casualtiesB: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </Field>
        </div>
        <div style={{ marginTop: 7 }}>
          <Check
            label="Sides flipped this round"
            note="Team A played CSA"
            checked={r.flipped}
            onChange={(v) => onRound(r.round, { flipped: v })}
          />
        </div>
        <div style={{ marginTop: 9 }}>
          <div className="cap">Balance swaps</div>
          <div className="tgs" style={{ marginTop: 6 }}>
            {swappable.map((u) => {
              const on = r.swaps.includes(u);
              const home: Side = week.teamA.includes(u) ? 'A' : 'B';
              const plays: Side = on ? (home === 'A' ? 'B' : 'A') : home;
              return (
                <button
                  key={u}
                  className={`tg${on ? ' on' : ''}`}
                  aria-pressed={on}
                  onClick={() => onSwap(r.round, u, !on)}
                  title={on ? `${u} moved to Team ${plays} for this round` : `${u} plays for Team ${plays}`}
                >
                  {u}
                </button>
              );
            })}
            {swappable.length === 0 && <span className="note">No units on either side yet.</span>}
          </div>
          <div className="note" style={{ marginTop: 6 }}>
            Units moved across to even this round.{' '}
            {balancePoints
              ? `Each earns ${balancePoints} balance point${balancePoints === 1 ? '' : 's'}, ${balancePointsStyle}.`
              : 'Balance points are off, so this is recorded but scores nothing.'}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="panel">
        {picker}
        <div className="grid-f" style={{ padding: 13 }}>
          <Field label="Name" note="shown in the schedule and exports">
            <input value={week.name} onChange={(e) => onRename(e.target.value)} />
          </Field>
          <Field label="Round type" note={R.note}>
            <select value={type} onChange={(e) => onType(e.target.value as RoundType)}>
              {ROUND_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="panel">
        <header className="ph">
          <h2>Rosters</h2>
          <span className="rule" />
          <span className="meta">move a unit between sides, or send the night to the balancer</span>
        </header>
        <div className="pb flush">
          <div className="cols">{sideCol('A')}{sideCol('B')}</div>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '11px 13px',
              borderTop: '1px solid var(--line)', flexWrap: 'wrap',
            }}
          >
            <button className="gh" onClick={onBalancer}>Open balancer</button>
            <button className="gh" onClick={onClearSides}>Clear both sides</button>
            {onAssignStats && (
              <button
                className="gh"
                onClick={onAssignStats}
                title="Map each unit on this night to the scoreboard regiments that played as it"
              >
                Assign player stats
              </button>
            )}
            <span className="rule" />
            <span className="meta">
              {bench.length
                ? `bench: ${bench.length} unit${bench.length === 1 ? '' : 's'} unassigned`
                : 'every registered unit is assigned'}
            </span>
          </div>
          <div
            style={{ padding: '0 13px 13px' }}
            onDragOver={(e) => { e.preventDefault(); setDropZone('bench'); }}
            onDragLeave={() => setDropZone((z) => (z === 'bench' ? null : z))}
            onDrop={(e) => { e.preventDefault(); dropOn(e, 'bench'); }}
            data-drop={dropZone === 'bench' || undefined}
            className="dropzone"
          >
            {bench.length > 0 ? (
              <div className="rl">
                {bench.map((u) => (
                  <button
                    key={u}
                    className="chip"
                    draggable
                    onDragStart={(e) => startDrag(e, u)}
                    onDragEnd={() => { setDragging(null); setDropZone(null); }}
                    onClick={() => onMoveUnit(u, 'A')}
                    title={`Drag onto a side, or click to put ${u} on Team A`}
                    style={{ cursor: 'grab', ...(dragging === u ? { opacity: 0.4 } : {}) }}
                  >
                    {u}
                  </button>
                ))}
              </div>
            ) : (
              <p className="note">
                {dragging ? 'Drop here to take a unit off the night.' : 'Every registered unit is on a side.'}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <header className="ph">
          <h2>Results</h2>
          <span className="rule" />
          <span className="meta">
            {R.points ? 'filling these updates the standings immediately' : 'recorded, but this night awards no points'}
          </span>
        </header>
        <div className="pb flush">
          <div className="cols">{roundCol(week.rounds[0])}{roundCol(week.rounds[1])}</div>
        </div>
      </div>
    </>
  );
}
