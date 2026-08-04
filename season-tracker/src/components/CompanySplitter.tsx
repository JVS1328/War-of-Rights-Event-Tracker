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
    <div className="bg-bg-card border border-border-default rounded-lg p-4">
      <div className="grid md:grid-cols-2 gap-4">
        {/* Roster paste */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold">Roster</label>
          <p className="text-xs text-text-secondary">
            One unit per line: name, min, max — tab-separated (paste straight from the coord
            sheet) or space-separated. Blank lines and filler columns are ignored.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={14}
            className="fld-i"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">
              {roster.length} unit{roster.length === 1 ? '' : 's'} · {Math.round(totalAvg)} avg
              players
            </span>
            {text.trim() && (
              <button
                onClick={() => setText('')}
                className="ml-auto flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:bg-bg-inset rounded-md transition"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
          {roster.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded border border-border-default">
              <table className="w-full text-xs">
                <tbody>
                  {roster.map((r, idx) => (
                    <tr key={idx} className="border-b border-border-default last:border-0">
                      <td className="px-2 py-1 text-text-primary">{r.unit}</td>
                      <td className="px-2 py-1 text-text-secondary text-right">
                        {r.min}–{r.max}
                      </td>
                      <td className="px-2 py-1 text-text-secondary text-right w-16">
                        {Math.round(rosterAvg(r))} avg
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Split */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold">Split</label>
          <CompanyConfigFields
            config={config}
            onChange={(patch) => setConfig((prev) => clampSideConfig({ ...prev, ...patch }))}
          />
          {companies.length > 0 ? (
            <>
              <CompanyList companies={companies} />
              <button
                onClick={copySplit}
                className="gh live"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy split'}
              </button>
            </>
          ) : (
            <p className="text-xs text-text-secondary py-2">
              {roster.length === 0
                ? 'Paste a roster to split it into companies.'
                : 'Set a company count to build the split.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
