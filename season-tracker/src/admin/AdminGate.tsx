import { useEffect, useState } from 'react';
import { KeyRound, ArrowLeft } from 'lucide-react';
import { checkAdmin, setAdminToken, hasAdminToken } from '../cloud/session';
import { hrefFor } from '../cloud/route';
import { ThemeControls } from '../components/ThemeControls';

/**
 * The door to the admin site. Everything behind it — the tracker, importing
 * rounds, publishing — needs the admin pass, so it is asked for once and
 * remembered.
 *
 * This is a courtesy gate, not the security boundary: the API checks the pass
 * on every write regardless, so a visitor who got past this screen would still
 * be told no by the server. What it buys is that the tracker never opens in a
 * state where every save is about to fail.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'in' | 'out'>('checking');
  const [configured, setConfigured] = useState(true);
  const [token, setToken] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const verify = async () => {
    try {
      const result = await checkAdmin();
      setConfigured(result.configured);
      setState(result.admin ? 'in' : 'out');
      if (!result.admin && hasAdminToken()) setProblem('That is not the pass this site expects.');
    } catch (err) {
      // The tracker itself runs offline, so a server that cannot be reached
      // should not lock the owner out of their own season.
      setProblem(err instanceof Error ? err.message : 'Could not reach the server.');
      setState('out');
    }
  };

  useEffect(() => { void verify(); }, []);

  const signIn = async () => {
    setProblem(null);
    setAdminToken(token.trim());
    setState('checking');
    await verify();
  };

  if (state === 'checking') {
    return (
      <div className="app solo">
        <div className="main"><div className="body">
          <div className="panel"><div className="pb"><p className="note">Checking…</p></div></div>
        </div></div>
      </div>
    );
  }

  if (state === 'in') return <>{children}</>;

  return (
    <div className="app solo">
      <div className="main">
        <div className="crumb">
          <KeyRound className="w-4 h-4" />
          <span className="wor-name">Admin</span>
          <span className="rule" />
          <ThemeControls />
          <a className="gh" href={hrefFor({ kind: 'directory' })}>
            <ArrowLeft className="w-3 h-3" /> Public site
          </a>
        </div>
        <div className="body">
          <div className="panel">
            <header className="ph"><h2>Admin pass</h2><span className="rule" /></header>
            <div className="pb">
              {configured ? (
                <p className="note">
                  This is the tracker: events, rounds, everything that changes what the site shows.
                  Enter the pass this deployment was given.
                </p>
              ) : (
                <p className="note">
                  <strong>No admin pass is set on this deployment.</strong> Until{' '}
                  <code>ADMIN_PASS</code> is set in the environment, the database refuses every
                  write — so the tracker would open but nothing would save. You can still work
                  offline below.
                </p>
              )}
              <div className="fld" style={{ marginTop: 9 }}>
                <label className="cap" htmlFor="admin-token">Pass</label>
                <input
                  id="admin-token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void signIn(); }}
                  autoComplete="current-password"
                  autoFocus
                />
              </div>
              {problem && <p className="note" style={{ marginTop: 9 }}><strong>{problem}</strong></p>}
              <div className="ctl" style={{ marginTop: 11 }}>
                <button className="gh live" onClick={signIn} disabled={!token.trim()}>Sign in</button>
                <button className="gh" onClick={() => setState('in')}>
                  Work offline
                </button>
                <span className="rule" />
                <span className="meta">offline still saves to this browser — it just cannot publish</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
