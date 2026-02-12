import { useState, useEffect } from 'react';
import CampaignTracker from './CampaignTracker';
import SharedMapView from './components/SharedMapView';
import { getShareFromUrl, fetchSharePayload } from './utils/shareMap';

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
            Open Campaign Tracker
          </a>
        </div>
      </div>
    );
  }

  // Shared view
  if (shareData) return <SharedMapView shareData={shareData} />;

  // Normal tracker
  return <CampaignTracker />;
}

export default App;
