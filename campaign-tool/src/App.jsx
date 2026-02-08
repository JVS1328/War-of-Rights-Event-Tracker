import { useState, useEffect } from 'react';
import CampaignTracker from './CampaignTracker';
import SharedMapView from './components/SharedMapView';
import { getShareFromUrl } from './utils/shareMap';

function App() {
  const [shareData, setShareData] = useState(undefined); // undefined = not checked yet

  useEffect(() => {
    setShareData(getShareFromUrl());

    const onHashChange = () => setShareData(getShareFromUrl());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Still checking
  if (shareData === undefined) return null;

  // Shared view
  if (shareData) return <SharedMapView shareData={shareData} />;

  // Normal tracker
  return <CampaignTracker />;
}

export default App;
