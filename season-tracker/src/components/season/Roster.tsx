/**
 * Season → Roster: who is in this season at all.
 *
 * Adding a unit, renaming it and marking it token or non-token used to live in
 * an "enlarged" panel nothing could open once the rail replaced the old
 * dashboard, which left no way to do any of it. This is that screen, on the
 * rail where the rest of the season lives.
 *
 * Renaming is event-wide — it sweeps the registry and every season's rosters,
 * leads and swaps — while removing only takes the unit out of this season.
 */

export interface RosterUnit {
  name: string;
  /** Non-token units play but hold no standings token, so they score nothing. */
  token: boolean;
  /** Division this season puts it in, if any. */
  division: string | null;
  /** Nights it appears on a side this season. */
  nights: number;
  /** Expected men, from the season's player counts. Null when none is set. */
  men: number | null;
}

export function RosterScreen({
  seasonName,
  units,
  draft,
  onDraft,
  onAdd,
  onRename,
  onToggleToken,
  onRemove,
}: {
  seasonName: string;
  units: RosterUnit[];
  /** The name being typed into the add field. */
  draft: string;
  onDraft: (name: string) => void;
  onAdd: () => void;
  onRename: (unit: string) => void;
  onToggleToken: (unit: string) => void;
  onRemove: (unit: string) => void;
}) {
  const tokens = units.filter((u) => u.token).length;
  const taken = new Set(units.map((u) => u.name.trim().toLowerCase()));
  const duplicate = taken.has(draft.trim().toLowerCase());

  return (
    <>
      <div className="panel">
        <header className="ph">
          <h2>Season roster</h2>
          <span className="rule" />
          <span className="meta">
            {seasonName} · {units.length} unit{units.length === 1 ? '' : 's'} · {tokens} scoring,{' '}
            {units.length - tokens} guest
          </span>
        </header>
        <div className="ctl">
          <input
            type="text"
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !duplicate) onAdd(); }}
            placeholder="Unit name…"
            aria-label="New unit name"
            style={{ minWidth: 220 }}
          />
          <button className="gh live" onClick={onAdd} disabled={!draft.trim() || duplicate}>
            ＋ Add unit
          </button>
          <span className="rule" />
          <span className="meta">
            {duplicate ? `${draft.trim()} is already on the roster` : 'added to this season and to the event registry'}
          </span>
        </div>
        <div className="pb flush scroll-x">
          <table>
            <thead>
              <tr>
                <th>Unit</th>
                <th>Scores</th>
                <th>Division</th>
                <th className="num">Nights</th>
                <th className="num">Men</th>
                <th className="num" />
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.name}>
                  <td className="wor-name">{u.name}</td>
                  <td>
                    <button
                      className="gh"
                      onClick={() => onToggleToken(u.name)}
                      style={u.token ? undefined : { borderColor: 'var(--live)', color: 'var(--live)' }}
                      title={
                        u.token
                          ? `${u.name} holds a token — click to make it a guest unit that scores nothing`
                          : `${u.name} is a guest unit and scores nothing — click to give it a token`
                      }
                    >
                      {u.token ? 'Token' : 'Guest'}
                    </button>
                  </td>
                  <td>{u.division ? <span className="tag q">{u.division}</span> : <span style={{ color: 'var(--ink-3)' }}>—</span>}</td>
                  <td className="num" style={{ color: 'var(--ink-2)' }}>{u.nights || <span style={{ color: 'var(--ink-3)' }}>—</span>}</td>
                  <td className="num" style={{ color: 'var(--ink-2)' }}>
                    {u.men == null || u.men === 0 ? <span style={{ color: 'var(--ink-3)' }}>—</span> : `~${u.men.toFixed(0)}`}
                  </td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>
                    <button className="gh" onClick={() => onRename(u.name)} title="Renames it across every season in the event">
                      Rename
                    </button>
                    <button
                      className="gh c-danger"
                      style={{ marginLeft: 5 }}
                      onClick={() => onRemove(u.name)}
                      title={`Take ${u.name} out of ${seasonName}`}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {units.length === 0 && (
                <tr><td colSpan={6} style={{ color: 'var(--ink-3)' }}>No units in this season yet — add one above.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6}>
                  Token units hold a standings place; guest units play and are balanced but score no points.
                  Renaming sweeps the whole event, so history follows the unit. Removing takes it out of this
                  season only — the registry keeps it so older seasons still resolve.
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
