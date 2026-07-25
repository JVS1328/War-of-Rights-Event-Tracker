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
      <div className="app-shell grid place-items-center p-6">
        <div className="ui-card max-w-sm w-full text-center p-8">
          <h2 className="text-lg font-bold text-mist-100 mb-2">Share Link Not Found</h2>
          <p className="text-sm text-mist-400 mb-5">This share link may have expired or is invalid.</p>
          <a href={window.location.pathname} className="ui-btn ui-btn-primary ui-btn-block">
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
