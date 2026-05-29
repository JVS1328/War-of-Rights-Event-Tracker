import { useState, useEffect } from 'react';
import SeasonTracker from './SeasonTracker';
import SharedStatsView from './components/stats/SharedStatsView';
import { isStatsBundle } from './stats/statsBundle';
import { getShareFromUrl, fetchSharePayload } from './utils/shareSeason';

function App() {
  const [shareData, setShareData] = useState(undefined); // undefined = not checked yet
  const [shareError, setShareError] = useState(false);

  useEffect(() => {
    const loadShare = async () => {
      setShareError(false);
      const result = getShareFromUrl();

      if (result?.pending) {
        const data = await fetchSharePayload(result.id);
        if (data) {
          setShareData(data);
        } else {
          setShareError(true);
          setShareData(null);
        }
      } else {
        setShareData(result);
      }
    };

    loadShare();

    const onHashChange = () => loadShare();
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Still checking
  if (shareData === undefined) return null;

  // Short link failed to load
  if (shareError) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Share Link Not Found</h2>
          <p className="text-gray-400 mb-4">This share link may have expired or is invalid.</p>
          <a href={window.location.pathname} className="text-teal-400 hover:text-teal-300">
            Open Season Tracker
          </a>
        </div>
      </div>
    );
  }

  // Player-stats-only share → dedicated read-only view (no tracker chrome,
  // no local writes), mirroring the campaign tracker's shared map page.
  if (shareData?.kind === 'stats') {
    if (isStatsBundle(shareData.bundle)) {
      return <SharedStatsView bundle={shareData.bundle} eventName={shareData.name} />;
    }
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Share Link Not Found</h2>
          <p className="text-gray-400 mb-4">This share link may have expired or is invalid.</p>
          <a href={window.location.pathname} className="text-teal-400 hover:text-teal-300">
            Open Season Tracker
          </a>
        </div>
      </div>
    );
  }

  // Pass remaining share data to tracker (it handles the import prompt)
  return <SeasonTracker initialShareData={shareData} />;
}

export default App;
