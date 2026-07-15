import { useState, useEffect } from 'react';
import ReplaySuite from './ReplaySuite';
import { getShareFromUrl, fetchSharePayload, restoreEventShare } from './share/shareEvent';

function App() {
  // undefined = still resolving a possible share link; null = no share;
  // { event, replays } = a shared event to hydrate.
  const [shared, setShared] = useState(undefined);
  const [shareError, setShareError] = useState(false);

  useEffect(() => {
    const load = async () => {
      setShareError(false);
      const res = getShareFromUrl();
      if (res?.pending) {
        const data = await fetchSharePayload(res.id);
        if (data) setShared(restoreEventShare(data));
        else { setShareError(true); setShared(null); }
      } else if (res) {
        setShared(restoreEventShare(res));
      } else {
        setShared(null);
      }
      // Drop the share hash so a refresh loads the now-persisted local copy.
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    };
    load();
  }, []);

  if (shared === undefined) return null;

  if (shareError) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Share link not found</h2>
          <p className="text-slate-400 mb-4">This link may have expired or is invalid.</p>
          <a href={window.location.pathname} className="text-amber-400 hover:text-amber-300">Open Replay Suite</a>
        </div>
      </div>
    );
  }

  return <ReplaySuite initialEvent={shared?.event || null} initialReplays={shared?.replays || null} />;
}

export default App;
