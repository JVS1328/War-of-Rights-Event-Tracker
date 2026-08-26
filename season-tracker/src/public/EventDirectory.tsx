import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Scale } from 'lucide-react';
import { listEvents } from '../cloud/events';
import type { CloudEvent } from '../cloud/events';
import { hrefFor } from '../cloud/route';
import { ThemeControls } from '../components/ThemeControls';

/**
 * The front door: find the event you play in.
 *
 * Everything published is listed, so the common case is one click. The search
 * box is there for when the list gets long, and for the person who was told
 * the event's short name rather than sent a link — typing it and pressing
 * Enter goes straight there, whether or not it is in the list.
 */
export function EventDirectory() {
  const [events, setEvents] = useState<CloudEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let live = true;
    listEvents()
      .then((list) => { if (live) { setEvents(list); setError(null); } })
      .catch((err: Error) => { if (live) { setEvents([]); setError(err.message); } });
    return () => { live = false; };
  }, []);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return events ?? [];
    return (events ?? []).filter(
      (e) => e.name.toLowerCase().includes(needle) || e.slug.includes(needle),
    );
  }, [events, query]);

  /** Enter on a typed name: the one match, or the name read as a slug. */
  const go = () => {
    const needle = query.trim().toLowerCase();
    if (!needle) return;
    const target = matches.length === 1 ? matches[0].slug : needle;
    window.location.hash = hrefFor({ kind: 'event', slug: target, screen: 'overview', season: null });
  };

  return (
    <div className="app solo">
      <div className="main">
        <div className="crumb">
          <BarChart3 className="w-4 h-4" />
          <span className="wor-name">War of Rights</span>
          <span className="cap">events</span>
          <span className="rule" />
          <ThemeControls />
          <a className="gh" href={hrefFor({ kind: 'tools' })}>
            <Scale className="w-3 h-3" /> Balancer &amp; splitter
          </a>
        </div>
        <div className="body">
          <div className="panel">
            <header className="ph">
              <h2>Find your event</h2>
              <span className="rule" />
              {events && (
                <span className="meta">
                  {events.length} event{events.length === 1 ? '' : 's'}
                </span>
              )}
            </header>
            <div className="pb">
              <div className="fld">
                <label className="cap" htmlFor="event-search">Event name</label>
                <input
                  id="event-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') go(); }}
                  placeholder="Start typing, or paste the event's short name"
                  autoFocus
                />
              </div>

              {events === null && <p className="note" style={{ marginTop: 11 }}>Loading events…</p>}

              {error && (
                <p className="note" style={{ marginTop: 11 }}>
                  {error} Nothing is listed, but if you know the event's short name you can still type
                  it above and press Enter.
                </p>
              )}

              {events !== null && !error && events.length === 0 && (
                <p className="note" style={{ marginTop: 11 }}>
                  Nothing has been published yet.
                </p>
              )}

              {matches.length > 0 && (
                <div className="scroll-x" style={{ marginTop: 13 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Short name</th>
                        <th className="num">Seasons</th>
                        <th className="num">Rounds</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map((event) => (
                        <tr
                          key={event.slug}
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            window.location.hash = hrefFor({
                              kind: 'event', slug: event.slug, screen: 'overview', season: null,
                            });
                          }}
                        >
                          <td className="wor-name">{event.name}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>{event.slug}</td>
                          <td className="num">{event.seasons?.length ?? 0}</td>
                          <td className="num">{event.scoreboardCount ?? 0}</td>
                          <td style={{ color: 'var(--ink-2)' }}>
                            {event.updatedAt ? new Date(event.updatedAt).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {events !== null && events.length > 0 && matches.length === 0 && (
                <p className="note" style={{ marginTop: 11 }}>
                  Nothing matches "{query.trim()}". Press Enter to try it as the event's short name
                  anyway.
                </p>
              )}
            </div>
          </div>

          <div className="panel" style={{ marginTop: 13 }}>
            <header className="ph">
              <h2>No event needed</h2>
              <span className="rule" />
            </header>
            <div className="pb">
              <p className="note">
                The <a href={hrefFor({ kind: 'tools' })}>side balancer and company splitter</a> work
                on their own — paste the numbers off a sheet and split a night without an event
                behind it.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
