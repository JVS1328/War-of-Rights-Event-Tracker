import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, X, Film, Trophy, Users, MapPin, Paperclip, Trash2,
  AlertTriangle, Clapperboard, Pencil, Check,
  Activity, Navigation, Star, Swords, Flame,
} from 'lucide-react';
import { parseReplayCsv, looksLikeReplayCsv, timestampFromFilename } from './utils/replayParser';
import { encodeReplay, decodeReplay } from './utils/replayCodec';
import { putReplay, getReplay, deleteReplay, computeReplayId } from './utils/replayStore';
import { parseScoreboardCsv, looksLikeScoreboardCsv } from './scoreboard/parseScoreboard';
import {
  loadEvent, saveEvent, newEvent, makeRound, upsertRound, nearestRoundForTimestamp,
} from './event/eventStore';
import ReplayViewer from './ReplayViewer';
import AttritionTimeline from './components/afteraction/AttritionTimeline';
import MovementFrontline from './components/afteraction/MovementFrontline';
import Leadership from './components/afteraction/Leadership';
import Engagement from './components/afteraction/Engagement';
import Heatmap from './components/afteraction/Heatmap';

const TEAM_NAME = { 1: 'USA', 2: 'CSA', USA: 'USA', CSA: 'CSA' };

// Display a raw winner field (team code or name) as USA/CSA/—.
function winnerLabel(w) {
  if (w == null || w === '') return null;
  return TEAM_NAME[w] || String(w);
}

// ms epoch → local HH:MM (round start clock, for the round list).
function clockLabel(ts) {
  if (ts == null) return null;
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Immutably patch one round inside an event.
function updateRound(event, roundId, patch) {
  return { ...event, rounds: event.rounds.map(r => (r.id === roundId ? { ...r, ...patch } : r)) };
}

export default function ReplaySuite() {
  const [event, setEvent] = useState(null);
  const [selectedRoundId, setSelectedRoundId] = useState(null);
  const [replays, setReplays] = useState(() => new Map());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);       // { kind: 'error' | 'info', text }
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef(null);
  const scoreboardInputRef = useRef(null);

  // --- boot: load persisted event (or a fresh one) ---
  useEffect(() => {
    const evt = loadEvent() || newEvent();
    setEvent(evt);
    if (evt.rounds.length) setSelectedRoundId(evt.rounds[0].id);
  }, []);

  // --- persist event on change ---
  useEffect(() => {
    if (event) saveEvent(event);
  }, [event]);

  // --- rehydrate replay payloads from IndexedDB for any round missing one ---
  useEffect(() => {
    if (!event) return;
    let cancelled = false;
    const missing = event.rounds.map(r => r.replayId).filter(id => id && !replays.has(id));
    if (missing.length === 0) return;
    (async () => {
      const loaded = new Map();
      for (const id of missing) {
        try {
          const buf = await getReplay(id);
          if (buf) loaded.set(id, decodeReplay(buf));
        } catch (err) {
          console.warn('Failed to load replay from IDB', id, err);
        }
      }
      if (cancelled || loaded.size === 0) return;
      setReplays(prev => {
        const next = new Map(prev);
        for (const [id, replay] of loaded) next.set(id, replay);
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [event, replays]);

  const selectedRound = event?.rounds.find(r => r.id === selectedRoundId) || null;

  // --- ingest uploaded files: route replay vs scoreboard, persist, attach ---
  const ingestFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList).filter(f => /\.csv$/i.test(f.name));
    if (files.length === 0) {
      setNotice({ kind: 'error', text: 'Please upload replay or scoreboard .csv files.' });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const texts = await Promise.all(files.map(async f => ({ name: f.name, text: await f.text() })));
      const replayFiles = [];
      const scoreboardFiles = [];
      for (const t of texts) {
        if (looksLikeReplayCsv(t.text)) replayFiles.push(t);
        else if (looksLikeScoreboardCsv(t.text)) scoreboardFiles.push(t);
      }
      if (replayFiles.length === 0 && scoreboardFiles.length === 0) {
        setNotice({ kind: 'error', text: 'No replay or scoreboard CSVs recognized in that upload.' });
        return;
      }

      let nextEvent = event || newEvent();
      const nextReplays = new Map(replays);
      let firstNewRoundId = null;

      // Replays → rounds (deduped by replayId; preserves an existing round's
      // attached scoreboard if the same replay is re-uploaded).
      for (const rf of replayFiles) {
        let parsed;
        try { parsed = parseReplayCsv(rf.text); }
        catch (err) { console.warn('Replay parse failed for', rf.name, err); continue; }
        if (!parsed) continue;
        const id = computeReplayId(rf.name, parsed.meta.sampleCount, parsed.frameCount);
        try { await putReplay(id, encodeReplay(parsed)); }
        catch (err) { console.warn('Failed to persist replay to IDB', err); }
        nextReplays.set(id, parsed);
        const round = makeRound(id, rf.name, parsed, timestampFromFilename);
        const existing = nextEvent.rounds.find(r => r.id === id);
        if (existing) {
          round.scoreboard = existing.scoreboard;
          round.scoreboardFilename = existing.scoreboardFilename;
        }
        nextEvent = upsertRound(nextEvent, round);
        if (!firstNewRoundId) firstNewRoundId = id;
      }

      // Scoreboards → auto-attach to the nearest replay round by filename time.
      const unmatched = [];
      for (const sf of scoreboardFiles) {
        const sb = parseScoreboardCsv(sf.text);
        if (!sb) { unmatched.push(sf.name); continue; }
        const d = timestampFromFilename(sf.name);
        const roundId = nearestRoundForTimestamp(nextEvent, d ? d.getTime() : null);
        if (roundId) {
          nextEvent = updateRound(nextEvent, roundId, { scoreboard: sb, scoreboardFilename: sf.name });
        } else {
          unmatched.push(sf.name);
        }
      }

      setReplays(nextReplays);
      setEvent(nextEvent);
      const selectId = firstNewRoundId || (nextEvent.rounds[0] && nextEvent.rounds[0].id);
      if (selectId && !selectedRoundId) setSelectedRoundId(selectId);

      if (unmatched.length) {
        setNotice({
          kind: 'info',
          text: `Added ${replayFiles.length} replay(s). ${unmatched.length} scoreboard(s) had no matching replay by time — attach them from a round: ${unmatched.join(', ')}.`,
        });
      }
    } finally {
      setBusy(false);
    }
  }, [event, replays, selectedRoundId]);

  const onFileInput = (e) => {
    if (e.target.files?.length) ingestFiles(e.target.files);
    e.target.value = '';
  };

  const onAttachScoreboard = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedRound) return;
    const text = await file.text();
    const sb = parseScoreboardCsv(text);
    if (!sb) {
      setNotice({ kind: 'error', text: `"${file.name}" isn't a recognizable scoreboard CSV.` });
      return;
    }
    setEvent(ev => updateRound(ev, selectedRound.id, { scoreboard: sb, scoreboardFilename: file.name }));
  };

  const detachScoreboard = (roundId) => {
    setEvent(ev => updateRound(ev, roundId, { scoreboard: null, scoreboardFilename: null }));
  };

  const removeRound = async (roundId) => {
    const round = event.rounds.find(r => r.id === roundId);
    if (!round) return;
    const rounds = event.rounds.filter(r => r.id !== roundId);
    setEvent({ ...event, rounds });
    // Replay id == round id here, so nothing else references it — drop from IDB.
    try { await deleteReplay(round.replayId); } catch { /* best effort */ }
    setReplays(prev => { const next = new Map(prev); next.delete(round.replayId); return next; });
    if (selectedRoundId === roundId) setSelectedRoundId(rounds[0]?.id || null);
  };

  const commitName = () => {
    const name = nameDraft.trim() || 'Untitled Event';
    setEvent(ev => ({ ...ev, name }));
    setEditingName(false);
  };

  // --- drag & drop over the whole surface ---
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) ingestFiles(e.dataTransfer.files);
  };

  if (!event) return null;

  const hasRounds = event.rounds.length > 0;

  return (
    <div
      className="min-h-screen bg-slate-900 text-slate-100"
      onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={onDrop}
    >
      {/* header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <Clapperboard className="w-6 h-6 text-amber-400 shrink-0" />
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight">Replay Suite</h1>
            <span className="text-slate-600">/</span>
            {editingName ? (
              <span className="flex items-center gap-1">
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); }}
                  className="px-2 py-0.5 text-sm bg-slate-800 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-amber-500"
                />
                <button onClick={commitName} className="p-1 text-emerald-400 hover:text-emerald-300" title="Save">
                  <Check className="w-4 h-4" />
                </button>
              </span>
            ) : (
              <button
                onClick={() => { setNameDraft(event.name); setEditingName(true); }}
                className="group flex items-center gap-1 text-sm text-slate-300 hover:text-white"
                title="Rename event"
              >
                {event.name}
                <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60" />
              </button>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {hasRounds && (
              <span className="text-xs text-slate-400">
                {event.rounds.length} round{event.rounds.length === 1 ? '' : 's'}
              </span>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm rounded transition"
            >
              <Upload className="w-4 h-4" /> {busy ? 'Loading…' : 'Add replays'}
            </button>
          </div>
        </div>
        {notice && (
          <div className={`max-w-[1400px] mx-auto px-4 pb-2 text-xs flex items-start gap-1.5 ${notice.kind === 'error' ? 'text-red-300' : 'text-amber-300'}`}>
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{notice.text}</span>
            <button onClick={() => setNotice(null)} className="ml-auto text-slate-500 hover:text-slate-300"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        multiple
        onChange={onFileInput}
        className="hidden"
      />

      {!hasRounds ? (
        <EmptyState onPick={() => fileInputRef.current?.click()} busy={busy} dragOver={dragOver} />
      ) : (
        <div className="max-w-[1400px] mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          {/* round list */}
          <aside className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-1 mb-1">Rounds</div>
            {event.rounds.map((r, i) => (
              <RoundListItem
                key={r.id}
                round={r}
                index={i}
                selected={r.id === selectedRoundId}
                onSelect={() => setSelectedRoundId(r.id)}
              />
            ))}
          </aside>

          {/* selected round */}
          <main>
            {selectedRound ? (
              <RoundView
                round={selectedRound}
                replay={replays.get(selectedRound.replayId)}
                onAttachScoreboard={() => scoreboardInputRef.current?.click()}
                onDetachScoreboard={() => detachScoreboard(selectedRound.id)}
                onRemove={() => removeRound(selectedRound.id)}
              />
            ) : (
              <div className="text-slate-500 text-sm p-8 text-center">Select a round.</div>
            )}
          </main>
        </div>
      )}

      <input
        ref={scoreboardInputRef}
        type="file"
        accept=".csv"
        onChange={onAttachScoreboard}
        className="hidden"
      />

      {dragOver && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 border-4 border-dashed border-amber-500 flex items-center justify-center pointer-events-none">
          <div className="text-amber-300 text-lg font-semibold flex items-center gap-2">
            <Upload className="w-6 h-6" /> Drop replay / scoreboard CSVs
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onPick, busy, dragOver }) {
  return (
    <div className="max-w-[1400px] mx-auto px-4 py-16 flex flex-col items-center">
      <button
        onClick={onPick}
        disabled={busy}
        className={`w-full max-w-2xl rounded-xl border-2 border-dashed p-12 text-center transition ${
          dragOver ? 'border-amber-500 bg-amber-500/5' : 'border-slate-700 hover:border-slate-600 bg-slate-800/40'
        }`}
      >
        <Film className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <div className="text-lg font-semibold text-slate-200 mb-1">Drop your War of Rights replays</div>
        <div className="text-sm text-slate-400 mb-4">
          Build an after-action from a night of rounds. Each replay CSV becomes a round;
          drop matching scoreboard CSVs alongside to add kills &amp; casualties.
        </div>
        <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-sm rounded">
          <Upload className="w-4 h-4" /> {busy ? 'Loading…' : 'Choose CSV files'}
        </div>
        <div className="text-xs text-slate-500 mt-4">
          Replay CSVs (positions/headings) are the spine · scoreboard CSVs are optional
        </div>
      </button>
    </div>
  );
}

function RoundListItem({ round, index, selected, onSelect }) {
  const win = winnerLabel(round.meta.winner);
  const clock = clockLabel(round.ts);
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-lg px-3 py-2 border transition ${
        selected ? 'bg-slate-800 border-amber-600/60' : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 tabular-nums w-5 shrink-0">{index + 1}</span>
        <span className="text-sm font-medium truncate flex-1">{round.meta.map || 'Unknown map'}</span>
        {round.scoreboard && <Paperclip className="w-3 h-3 text-emerald-400 shrink-0" title="Scoreboard attached" />}
      </div>
      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 pl-7">
        {round.meta.area && <span className="truncate">{round.meta.area}</span>}
        {clock && <span className="tabular-nums">{clock}</span>}
        {win && (
          <span className="flex items-center gap-0.5 ml-auto">
            <Trophy className="w-3 h-3 text-amber-400" />{win}
          </span>
        )}
      </div>
    </button>
  );
}

const ROUND_TABS = [
  { key: 'playback', label: 'Playback', icon: Film },
  { key: 'attrition', label: 'Attrition', icon: Activity },
  { key: 'movement', label: 'Movement', icon: Navigation },
  { key: 'leadership', label: 'Leadership', icon: Star },
  { key: 'engagement', label: 'Engagement', icon: Swords },
  { key: 'heatmap', label: 'Heatmap', icon: Flame },
];

function RoundView({ round, replay, onAttachScoreboard, onDetachScoreboard, onRemove }) {
  const meta = round.meta;
  const win = winnerLabel(meta.winner);
  const sb = round.scoreboard;
  const finalCasualties = sb?.metadata
    ? { usa: sb.metadata.casualties_usa, csa: sb.metadata.casualties_csa }
    : null;

  // Reset to Playback when switching rounds so a tab never renders against the
  // wrong replay for a frame.
  const [tab, setTab] = useState('playback');
  useEffect(() => { setTab('playback'); }, [round.id]);

  return (
    <div className="space-y-3">
      {/* round header */}
      <div className="bg-slate-800 rounded-lg p-3 flex items-center gap-3 flex-wrap">
        <MapPin className="w-5 h-5 text-amber-400 shrink-0" />
        <div>
          <div className="font-semibold">{meta.map || 'Unknown map'}</div>
          <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
            {meta.area && <span>{meta.area}</span>}
            {meta.mode && <span>· {meta.mode}</span>}
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{meta.playerCount}</span>
            {win && <span className="flex items-center gap-1"><Trophy className="w-3 h-3 text-amber-400" />{win}</span>}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {sb ? (
            <button
              onClick={onDetachScoreboard}
              className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-xs rounded transition"
              title={`Scoreboard: ${round.scoreboardFilename}`}
            >
              <Paperclip className="w-3 h-3 text-emerald-400" /> Scoreboard <X className="w-3 h-3" />
            </button>
          ) : (
            <button
              onClick={onAttachScoreboard}
              className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-xs rounded transition"
              title="Attach a scoreboard CSV for kills & casualties"
            >
              <Paperclip className="w-3 h-3" /> Attach scoreboard
            </button>
          )}
          <button
            onClick={onRemove}
            className="p-1.5 text-slate-500 hover:text-red-400 transition"
            title="Remove round"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!replay ? (
        <div className="bg-slate-800 rounded-lg p-12 text-center text-slate-400 text-sm">
          Loading replay from cache…
        </div>
      ) : (
        <>
          {/* tab bar */}
          <div className="flex items-center gap-1 flex-wrap">
            {ROUND_TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition ${
                    tab === t.key ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {t.label}
                </button>
              );
            })}
          </div>

          {/* tab content */}
          {tab === 'playback' && (
            <ReplayViewer replay={replay} kills={sb?.kills || null} finalCasualties={finalCasualties} />
          )}
          {tab === 'attrition' && <AttritionTimeline replay={replay} scoreboard={sb} />}
          {tab === 'movement' && <MovementFrontline replay={replay} />}
          {tab === 'leadership' && <Leadership replay={replay} />}
          {tab === 'engagement' && <Engagement replay={replay} />}
          {tab === 'heatmap' && <Heatmap replay={replay} scoreboard={sb} />}
        </>
      )}
    </div>
  );
}
