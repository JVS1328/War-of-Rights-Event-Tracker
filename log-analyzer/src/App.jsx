import { useState, useEffect } from 'react';
import LogAnalyzer from './LogAnalyzer';
import { getShareFromUrl, fetchSharePayload, restoreShareState } from './utils/shareAnalysis';

function App() {
  const [shareData, setShareData] = useState(undefined);
  const [shareError, setShareError] = useState(false);

  useEffect(() => {
    const loadShare = async () => {
      setShareError(false);
      const result = getShareFromUrl();

      if (result?.pending) {
        const data = await fetchSharePayload(result.id);
        if (data) {
          setShareData(restoreShareState(data));
        } else {
          setShareError(true);
          setShareData(null);
        }
      } else if (result) {
        setShareData(restoreShareState(result));
      } else {
        setShareData(null);
      }
    };

    loadShare();

    const onHashChange = () => loadShare();
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (shareData === undefined) return null;

  if (shareError) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Share Link Not Found</h2>
          <p className="text-slate-400 mb-4">This share link may have expired or is invalid.</p>
          <a href={window.location.pathname} className="text-amber-400 hover:text-amber-300">
            Open Log Analyzer
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <LogAnalyzer initialShareData={shareData} />
    </div>
  );
}

export default App;
