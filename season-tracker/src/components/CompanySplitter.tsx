import { useEffect, useMemo, useState } from 'react';
import { Copy, Check, Trash2 } from 'lucide-react';
import { CompanyConfigFields, CompanyList } from './CompanyBalancer';
import {
  clampSideConfig,
  companiesToText,
  distributeCompanies,
  parseRosterPaste,
  rosterAvg,
} from '../utils/companySplit';
import type { CompanySideConfig } from '../utils/companySplit';

const STORAGE_KEY = 'WarOfRightsCompanySplitter';
const PLACEHOLDER = '7th SC\t8\t11\n1stLAR\t7\t10\nSB Arty\t4\t5\nPB\t22\t26';

interface SavedState {
  text?: string;
  config?: Partial<CompanySideConfig>;
}

const loadSaved = (): SavedState => {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as SavedState;
  } catch {
    return {};
  }
};

/**
 * Standalone company splitter: paste a roster ("name  min  max" per line),
 * pick the company counts, get the split. No week or season involved — it
 * runs the same packing the per-week Company Balancer uses.
 */
export function CompanySplitter() {
  const [text, setText] = useState(() => loadSaved().text ?? '');
  const [config, setConfig] = useState<CompanySideConfig>(() =>
    clampSideConfig(loadSaved().config ?? { count: 2 }),
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ text, config }));
  }, [text, config]);

  const roster = useMemo(() => parseRosterPaste(text), [text]);
  const companies = useMemo(() => distributeCompanies(roster, config), [roster, config]);
  const totalAvg = roster.reduce((sum, r) => sum + rosterAvg(r), 0);

  const copySplit = async () => {
    await navigator.clipboard.writeText(companiesToText(companies));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="panel">
      <header className="ph">
        <h2>Company splitter</h2>
        <span className="rule" />
        <span className="meta">
          {roster.length} unit{roster.length === 1 ? '' : 's'} · {Math.round(totalAvg)} men
        </span>
      </header>
      <div className="pb flush">
        <div className="cols">
          <div className="col">
            <div className="cap">Roster</div>
            <p className="note" style={{ margin: '5px 0 7px' }}>
              One unit a line: name, min, max — tab-separated straight from the coord sheet, or
              spaced. Blank lines and filler columns are ignored.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={14}
            />
            {text.trim() && (
              <button className="gh" style={{ marginTop: 7 }} onClick={() => setText('')}>
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            )}
            {roster.length > 0 && (
              <div className="scroll-x" style={{ maxHeight: 240, overflowY: 'auto', marginTop: 11 }}>
                <table>
                  <thead>
                    <tr><th>Unit</th><th className="num">Range</th><th className="num">Avg</th></tr>
                  </thead>
                  <tbody>
                    {roster.map((r, idx) => (
                      <tr key={idx}>
                        <td className="wor-name">{r.unit}</td>
                        <td className="num" style={{ color: 'var(--ink-2)' }}>{r.min}–{r.max}</td>
                        <td className="num">{Math.round(rosterAvg(r))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="col">
            <div className="cap">Split</div>
            <div style={{ marginTop: 7 }}>
              <CompanyConfigFields
                config={config}
                onChange={(patch) => setConfig((prev) => clampSideConfig({ ...prev, ...patch }))}
              />
            </div>
            {companies.length > 0 ? (
              <>
                <CompanyList companies={companies} />
                <button className="gh live" style={{ marginTop: 11 }} onClick={copySplit}>
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy split'}
                </button>
              </>
            ) : (
              <p className="note" style={{ marginTop: 7 }}>
                {roster.length === 0
                  ? 'Paste a roster to split it into companies.'
                  : 'Set a company count to build the split.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
