/**
 * Schedule maker, built to the prototype's spec (V.simulator).
 *
 * Two ways to get a season: paste one someone already made, or state the rules
 * and let the generator solve for them. Either way the result goes through the
 * same audit — because a pasted schedule and a generated one fail in exactly
 * the same ways, and there is no reason to say so twice in two voices.
 *
 * The lead style governs everything downstream. Under full lead weeks a night
 * has one lead a side across both rounds, so there is no R1/R2 split to check
 * and the columns that would report on it are not drawn at all.
 */
import type { ReactNode } from 'react';
import { Check, Field } from './NightBuilder';
import type { ParsedSchedule, ScheduleAudit, ScheduleProblem } from '../../utils/scheduleImport';

export type LeadMode = 'fullWeeks' | 'rounds';

export interface LeadStyle {
  key: LeadMode;
  label: string;
  blurb: string;
  /** Whether a night carries a lead per round, which is what creates R1/R2. */
  splitRounds: boolean;
  /** Lead slots a night. */
  perNight: number;
}

export const LEAD_STYLES: Record<LeadMode, LeadStyle> = {
  fullWeeks: {
    key: 'fullWeeks',
    label: 'Full lead weeks',
    blurb: 'One unit leads both rounds of a night. Two lead slots a night.',
    splitRounds: false,
    perNight: 2,
  },
  rounds: {
    key: 'rounds',
    label: 'Single round leads',
    blurb: 'Four units lead a night — one per side, per round. Nobody leads both rounds.',
    splitRounds: true,
    perNight: 4,
  },
};

/** A pass/check card in the constraint report. */
function Verdict({ ok, label, children }: { ok: boolean; label: string; children: ReactNode }) {
  return (
    <div className="col">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {ok ? (
          <span className="tag usa">Pass</span>
        ) : (
          <span className="tag q" style={{ borderColor: 'var(--live)', color: 'var(--live)' }}>Check</span>
        )}
        <strong>{label}</strong>
      </div>
      <div className="note" style={{ marginTop: 5 }}>{children}</div>
    </div>
  );
}

export function ScheduleMaker({
  source,
  onSource,
  leadMode,
  onLeadMode,
  scheduleOnly,
  onScheduleOnly,
  leadNightsPerUnit,
  onLeadNightsPerUnit,
  leadNightsInDivision,
  onLeadNightsInDivision,
  homePerUnit,
  onHomePerUnit,
  awayPerUnit,
  onAwayPerUnit,
  splitRounds,
  onSplitRounds,
  paste,
  onPaste,
  preview,
  parsed,
  audit,
  describeProblem,
  onApplyPaste,
  onGenerate,
  tokenUnitCount,
  nonTokenUnitCount,
  unitCount,
  divisionCount,
  teamAName,
}: {
  source: 'paste' | 'generate';
  onSource: (s: 'paste' | 'generate') => void;
  leadMode: LeadMode;
  onLeadMode: (m: LeadMode) => void;
  scheduleOnly: boolean;
  onScheduleOnly: (v: boolean) => void;
  leadNightsPerUnit: number;
  onLeadNightsPerUnit: (n: number) => void;
  leadNightsInDivision: number;
  onLeadNightsInDivision: (n: number) => void;
  homePerUnit: number;
  onHomePerUnit: (n: number) => void;
  awayPerUnit: number;
  onAwayPerUnit: (n: number) => void;
  splitRounds: boolean;
  onSplitRounds: (v: boolean) => void;
  paste: string;
  onPaste: (s: string) => void;
  /** What the current rules work out to: nights, rounds, leftover slots. */
  preview: { nights: number; rounds: number; leadsPerNight: number; leftover: number };
  /** The parsed paste, or null when nothing parses. */
  parsed: ParsedSchedule | null;
  audit: ScheduleAudit | null;
  describeProblem: (p: ScheduleProblem) => string;
  onApplyPaste: () => void;
  onGenerate: () => void;
  tokenUnitCount: number;
  nonTokenUnitCount: number;
  unitCount: number;
  divisionCount: number;
  teamAName: string;
}) {
  const ST = LEAD_STYLES[leadMode];
  const perUnit = homePerUnit + awayPerUnit;
  const problems = parsed ? [...parsed.problems, ...(audit?.problems ?? [])] : [];
  // A paste carrying two distinct lead pairs a night can only be a single-round
  // schedule. Read under full lead weeks, half its leads would be dropped
  // silently — so say so before anything is written.
  const perRoundPaste = !!parsed && parsed.rows.some((r) => r.round === 2);
  const styleMismatch = source === 'paste' && !ST.splitRounds && perRoundPaste;

  const offBy = (n: number, target: number) => target > 0 && n !== target;
  const homeOk = !audit || !audit.tallies.some((t) => offBy(t.home, homePerUnit));
  const awayOk = !audit || !audit.tallies.some((t) => offBy(t.away, awayPerUnit));
  const okCount = audit
    ? audit.tallies.filter((t) => !offBy(t.home, homePerUnit) && !offBy(t.away, awayPerUnit)).length
    : 0;

  const rules = (
    <>
      <div className="grid-f">
        <Field label="Lead style" note={ST.blurb}>
          <select className="fld-i" value={leadMode} onChange={(e) => onLeadMode(e.target.value as LeadMode)}>
            {Object.values(LEAD_STYLES).map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </Field>
        <Field
          label={ST.splitRounds ? 'Lead rounds per unit' : 'Lead nights per unit'}
          note="total across the season"
        >
          <input
            className="fld-i" type="number" min={1} max={20} value={leadNightsPerUnit}
            onChange={(e) => onLeadNightsPerUnit(parseInt(e.target.value) || 1)}
          />
        </Field>
        <Field label="Home leads per unit" note="the rest are away">
          <input
            className="fld-i" type="number" min={0} value={homePerUnit}
            onChange={(e) => onHomePerUnit(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </Field>
        <Field label="Away leads per unit" note="0 turns the check off">
          <input
            className="fld-i" type="number" min={0} value={awayPerUnit}
            onChange={(e) => onAwayPerUnit(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </Field>
        {divisionCount > 0 && (
          <Field
            label="Lead nights within division"
            note={leadNightsInDivision === 0
              ? 'any matchup is fine'
              : `each unit leads ${leadNightsInDivision} night${leadNightsInDivision === 1 ? '' : 's'} against its own division`}
          >
            <input
              className="fld-i" type="number" min={0} max={leadNightsPerUnit} value={leadNightsInDivision}
              onChange={(e) => onLeadNightsInDivision(Math.min(parseInt(e.target.value) || 0, leadNightsPerUnit))}
            />
          </Field>
        )}
      </div>

      <div style={{ marginTop: 11 }}>
        <Check
          label="Schedule only"
          note="nights get their leads and nothing else — no teams, no maps, no results"
          checked={scheduleOnly}
          onChange={onScheduleOnly}
        />
      </div>
      {ST.splitRounds && (
        <div style={{ marginTop: 7 }}>
          <Check
            label="Split home and away across the rounds"
            note="a unit's home leads spread over R1 and R2, and the same for its away leads — so nobody always leads the same round"
            checked={splitRounds}
            onChange={onSplitRounds}
          />
        </div>
      )}

      <p className="note" style={{ marginTop: 11 }}>
        {tokenUnitCount} token unit{tokenUnitCount === 1 ? '' : 's'} × {leadNightsPerUnit} lead{' '}
        {ST.splitRounds ? 'rounds' : 'nights'} ÷ {preview.leadsPerNight} a night ={' '}
        <b style={{ color: 'var(--ink)' }}>{preview.nights} night{preview.nights === 1 ? '' : 's'}</b> ·{' '}
        {preview.rounds} rounds.{' '}
        {preview.leftover > 0
          ? `${preview.leftover} slot${preview.leftover === 1 ? '' : 's'} left over — that many units lead one fewer time.`
          : 'Every unit leads the same number of times.'}
      </p>

      <div style={{ display: 'flex', gap: 6, marginTop: 11, flexWrap: 'wrap' }}>
        <button className="gh live" onClick={onGenerate}>
          {scheduleOnly ? `Generate ${preview.nights} nights` : `Simulate ${preview.nights} nights`}
        </button>
      </div>
    </>
  );

  return (
    <>
      <div className="panel">
        <div className="ctl">
          <span className="cap">Source</span>
          <div className="seg">
            <button aria-pressed={source === 'paste'} onClick={() => onSource('paste')}>Paste a schedule</button>
            <button aria-pressed={source === 'generate'} onClick={() => onSource('generate')}>Generate one</button>
          </div>
          <span className="cap">Lead style</span>
          <div className="seg">
            {Object.values(LEAD_STYLES).map((s) => (
              <button key={s.key} aria-pressed={leadMode === s.key} onClick={() => onLeadMode(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
          <span className="rule" />
          <span className="meta">
            {ST.perNight} lead slots a night · {tokenUnitCount} token of {unitCount} units
            {divisionCount > 0 && ` · ${divisionCount} divisions`}
            {nonTokenUnitCount > 0 && ` · ${nonTokenUnitCount} score nothing`}
          </span>
        </div>
      </div>

      {styleMismatch && (
        <div className="panel">
          <header className="ph"><h2>Style mismatch</h2><span className="rule" /></header>
          <div className="pb">
            <p className="note" style={{ color: 'var(--live)' }}>
              This paste carries <b>two different lead pairs a night</b> — that is a single-round-leads schedule.
              Under full lead weeks a night has one lead a side for both rounds, so only the first pair of each
              night would be used and half the leads would be dropped. Switch the style back, or paste a
              one-pair-per-night schedule.
            </p>
          </div>
        </div>
      )}

      {source === 'paste' ? (
        <div className="panel">
          <header className="ph">
            <h2>Paste</h2><span className="rule" />
            <span className="meta">
              {ST.splitRounds
                ? 'one row per round: week, round, home, away, date'
                : 'one row per night: week, home, away, date'}{' '}
              — tabs or commas
            </span>
          </header>
          <div className="pb">
            <textarea
              rows={9}
              spellCheck={false}
              value={paste}
              onChange={(e) => onPaste(e.target.value)}
              placeholder={'Week\tRound\tHome\tAway\tDate\n1\t1\t1st Texas\t69th New York\t8/5/2026'}
            />
            <div className="grid-f" style={{ marginTop: 11 }}>
              <Field label="Home lead rounds per unit" note="0 turns the check off">
                <input
                  className="fld-i" type="number" min={0} value={homePerUnit}
                  onChange={(e) => onHomePerUnit(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </Field>
              <Field label="Away lead rounds per unit" note={`${perUnit} lead ${ST.splitRounds ? 'rounds' : 'nights'} a unit across the season`}>
                <input
                  className="fld-i" type="number" min={0} value={awayPerUnit}
                  onChange={(e) => onAwayPerUnit(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </Field>
            </div>
            {ST.splitRounds && (
              <div style={{ marginTop: 11 }}>
                <Check
                  label="Split home and away across the rounds"
                  note="each unit's home leads spread over round 1 and round 2, and the same for its away leads"
                  checked={splitRounds}
                  onChange={onSplitRounds}
                />
              </div>
            )}
            <p className="note" style={{ marginTop: 11 }}>
              Home picks the map and away picks the side, so home lands on {teamAName}.
            </p>
          </div>
        </div>
      ) : (
        <div className="panel">
          <header className="ph">
            <h2>Rules</h2><span className="rule" />
            <span className="meta">the generator solves for these, then reports what it could not hit</span>
          </header>
          <div className="pb">{rules}</div>
        </div>
      )}

      {source === 'paste' && parsed && (
        <>
          <div className="panel">
            <header className="ph">
              <h2>Constraint report</h2><span className="rule" />
              <span className="meta">
                {audit ? `${okCount} of ${audit.tallies.length} units meet the rule` : 'nothing to audit yet'}
              </span>
            </header>
            <div className="pb flush">
              <div className="cols">
                <Verdict ok={homeOk && awayOk} label="Home / away split">
                  {homeOk && awayOk
                    ? `Every unit leads ${homePerUnit} home and ${awayPerUnit} away.`
                    : `${(audit?.tallies.length ?? 0) - okCount} unit(s) miss the split. See the table below.`}
                </Verdict>
                <Verdict ok={problems.length === 0} label="Parse and rules">
                  {problems.length === 0
                    ? 'Every row parsed and every rule holds.'
                    : `${problems.length} thing${problems.length === 1 ? '' : 's'} to look at.`}
                </Verdict>
                {ST.splitRounds ? (
                  <Verdict ok={splitRounds} label="Round split">
                    {splitRounds
                      ? 'Home and away leads are spread across both rounds.'
                      : 'Not being checked — nobody is stopped from always leading the same round.'}
                  </Verdict>
                ) : (
                  <Verdict ok label="Both rounds">
                    Not applicable — a full-week lead is expected to lead both rounds.
                  </Verdict>
                )}
              </div>
              {problems.length > 0 && (
                <ul className="note" style={{ marginTop: 13, paddingLeft: 18, listStyle: 'disc' }}>
                  {problems.slice(0, 40).map((p, i) => <li key={i}>{describeProblem(p)}</li>)}
                </ul>
              )}
            </div>
          </div>

          {audit && audit.tallies.some((t) => t.total > 0) && (
            <div className="panel">
              <header className="ph">
                <h2>Per unit</h2><span className="rule" />
                <span className="meta">
                  target: {perUnit} leads · {homePerUnit}H / {awayPerUnit}A
                  {ST.splitRounds && ' · spread across both rounds'}
                </span>
              </header>
              <div className="pb flush scroll-x">
                <table>
                  <thead>
                    <tr>
                      <th>Unit</th>
                      <th className="num">Leads</th>
                      <th className="num">Home</th>
                      <th className="num">Away</th>
                      {ST.splitRounds && <th className="num">H · R1/R2</th>}
                      {ST.splitRounds && <th className="num">A · R1/R2</th>}
                      <th>Verdict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.tallies.map((t) => {
                      const bad = [
                        offBy(t.home, homePerUnit) && `home ${t.home} not ${homePerUnit}`,
                        offBy(t.away, awayPerUnit) && `away ${t.away} not ${awayPerUnit}`,
                      ].filter(Boolean) as string[];
                      return (
                        <tr key={t.unit}>
                          <td className="wor-name">{t.unit}</td>
                          <td className="num">{t.total}</td>
                          <td className="num" style={offBy(t.home, homePerUnit) ? { color: 'var(--live)' } : undefined}>{t.home}</td>
                          <td className="num" style={offBy(t.away, awayPerUnit) ? { color: 'var(--live)' } : undefined}>{t.away}</td>
                          {ST.splitRounds && <td className="num" style={{ color: 'var(--ink-2)' }}>{t.homeR1}/{t.homeR2}</td>}
                          {ST.splitRounds && <td className="num" style={{ color: 'var(--ink-2)' }}>{t.awayR1}/{t.awayR2}</td>}
                          <td>
                            {bad.length === 0
                              ? <span className="tag usa">Meets rule</span>
                              : <span className="tag q" style={{ borderColor: 'var(--live)', color: 'var(--live)' }}>{bad.join(' · ')}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="panel">
            <header className="ph">
              <h2>Parsed schedule</h2><span className="rule" />
              <span className="meta">
                {parsed.rows.length} {ST.splitRounds ? 'rounds' : 'pairings'} across {parsed.weeks.length} night
                {parsed.weeks.length === 1 ? '' : 's'}
              </span>
            </header>
            <div className="pb flush scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>Week</th><th className="num">Round</th>
                    <th>Home lead</th><th>Away lead</th><th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.map((r, i) => (
                    <tr key={`${r.week}-${r.round}-${i}`}>
                      <td style={{ color: 'var(--ink-3)' }}>{r.week}</td>
                      <td className="num">{ST.splitRounds ? `R${r.round}` : '—'}</td>
                      <td className="wor-name">{r.home}</td>
                      <td className="wor-name">{r.away}</td>
                      <td style={{ color: 'var(--ink-2)' }}>{r.date || '—'}</td>
                    </tr>
                  ))}
                  {parsed.rows.length === 0 && (
                    <tr><td colSpan={5} style={{ color: 'var(--ink-3)' }}>Nothing parsed yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="ctl" style={{ borderBottom: 0, borderTop: '1px solid var(--line)' }}>
              <button className="gh live" onClick={onApplyPaste} disabled={parsed.rows.length === 0}>
                Write {parsed.weeks.length} night{parsed.weeks.length === 1 ? '' : 's'} into the schedule
              </button>
              <span className="rule" />
              <span className="meta">
                round type {ST.splitRounds ? 'single round leads' : 'regular'} · nights with results are left alone
              </span>
            </div>
          </div>
        </>
      )}
    </>
  );
}
