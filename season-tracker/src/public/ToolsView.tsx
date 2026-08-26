import { ArrowLeft, Scale } from 'lucide-react';
import { SideBalancer } from '../components/SideBalancer';
import { CompanySplitter } from '../components/CompanySplitter';
import { ThemeControls } from '../components/ThemeControls';
import { hrefFor } from '../cloud/route';

/**
 * The two tools that need nothing behind them: split a night into two sides,
 * and split a side into companies. Both run entirely in the browser off a
 * pasted sheet, so they work for a pickup night that no event has ever heard
 * of — which is most of them.
 */
export function ToolsView() {
  return (
    <div className="app solo">
      <div className="main">
        <div className="crumb">
          <Scale className="w-4 h-4" />
          <span className="wor-name">Balancer &amp; splitter</span>
          <span className="cap">no event needed</span>
          <span className="rule" />
          <ThemeControls />
          <a className="gh" href={hrefFor({ kind: 'directory' })}>
            <ArrowLeft className="w-3 h-3" /> Events
          </a>
        </div>
        <div className="body">
          <SideBalancer />
          <div style={{ marginTop: 13 }}>
            <CompanySplitter />
          </div>
        </div>
      </div>
    </div>
  );
}
