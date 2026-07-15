/* eslint-disable react-refresh/only-export-components -- this is a PDF-generation
   utility, not an HMR component module; @react-pdf primitives are rendered by
   pdf(), never mounted in the React tree. */
// After-action report (PDF) for a whole event.
//
// A print-friendly summary built with @react-pdf/renderer: event overview, a
// per-round table, and the season-style unit + player performance tables from
// the same eventStats aggregator the UI uses. No canvas/heatmap embedding —
// tables + summary render reliably headless and print well.

import {
  Document, Page, Text, View, StyleSheet, pdf,
} from '@react-pdf/renderer';
import { formatAvgT } from '../stats/labels';
import { UNTAGGED } from '../analytics/regiments';

const BLUE = '#1d4ed8';
const RED = '#b91c1c';
const AMBER = '#b45309';
const INK = '#0f172a';
const MUTE = '#64748b';
const LINE = '#e2e8f0';

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 9, color: INK, fontFamily: 'Helvetica' },
  h1: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
  sub: { fontSize: 10, color: MUTE, marginTop: 2 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: AMBER, marginBottom: 6, borderBottom: `1pt solid ${LINE}`, paddingBottom: 3 },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 10 },
  tile: { flex: 1, border: `1pt solid ${LINE}`, borderRadius: 3, padding: 6 },
  tileLabel: { fontSize: 7, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.5 },
  tileValue: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  row: { flexDirection: 'row', borderBottom: `0.5pt solid ${LINE}`, paddingVertical: 3 },
  th: { fontFamily: 'Helvetica-Bold', color: MUTE, fontSize: 7.5, textTransform: 'uppercase' },
  headRow: { flexDirection: 'row', borderBottom: `1pt solid ${MUTE}`, paddingBottom: 3, marginBottom: 1 },
  cell: { paddingRight: 4 },
  right: { textAlign: 'right' },
  dot: { width: 5, height: 5, borderRadius: 3, marginRight: 3 },
  footer: { position: 'absolute', bottom: 16, left: 28, right: 28, fontSize: 7, color: MUTE, textAlign: 'center' },
});

function winnerLabel(w) {
  if (w == null || w === '') return '—';
  if (w === '1' || w === 1 || w === 'USA') return 'USA';
  if (w === '2' || w === 2 || w === 'CSA') return 'CSA';
  return String(w);
}
const teamColor = (t) => (t === 1 || t === 'USA' ? BLUE : t === 2 || t === 'CSA' ? RED : MUTE);
const kd = (v) => (Number.isFinite(v) ? v.toFixed(2) : '—');

// Per-round casualty summary from metadata (or a kill count fallback).
function roundCasualties(round) {
  const sb = round.scoreboard;
  if (!sb) return { usa: null, csa: null, hasSb: false };
  const m = sb.metadata || {};
  let usa = parseInt(m.casualties_usa, 10);
  let csa = parseInt(m.casualties_csa, 10);
  if (!Number.isFinite(usa) || !Number.isFinite(csa)) {
    usa = 0; csa = 0;
    for (const k of sb.kills || []) {
      if (k.victimTeam === 1) usa++;
      else if (k.victimTeam === 2) csa++;
    }
  }
  return { usa, csa, hasSb: true };
}

function Tile({ label, value }) {
  return (
    <View style={s.tile}>
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={s.tileValue}>{value}</Text>
    </View>
  );
}

function ReportDoc({ event, stats, generatedAt }) {
  const o = stats.overview;
  const units = stats.units.filter((u) => u.regiment !== UNTAGGED);
  const players = [...stats.players].sort((a, b) => b.kills - a.kills).slice(0, 40);

  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        <Text style={s.h1}>After-Action Report</Text>
        <Text style={s.sub}>{event.name} · {event.rounds.length} round{event.rounds.length === 1 ? '' : 's'} · {generatedAt}</Text>

        <View style={s.tiles}>
          <Tile label="Rounds" value={o.rounds} />
          <Tile label="Scoreboards" value={o.scoreboardRounds} />
          <Tile label="Players" value={o.players} />
          <Tile label="Units" value={o.units} />
          <Tile label="Kills" value={o.kills} />
          <Tile label="Casualties" value={o.casualties} />
        </View>

        {/* rounds */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Rounds</Text>
          <View style={s.headRow}>
            <Text style={[s.th, s.cell, { width: 18 }]}>#</Text>
            <Text style={[s.th, s.cell, { flex: 2 }]}>Map</Text>
            <Text style={[s.th, s.cell, { flex: 2 }]}>Area</Text>
            <Text style={[s.th, s.cell, { width: 40 }]}>Winner</Text>
            <Text style={[s.th, s.cell, s.right, { width: 42 }]}>Players</Text>
            <Text style={[s.th, s.cell, s.right, { width: 40 }]}>USA cas</Text>
            <Text style={[s.th, s.cell, s.right, { width: 40 }]}>CSA cas</Text>
          </View>
          {event.rounds.map((r, i) => {
            const c = roundCasualties(r);
            return (
              <View style={s.row} key={r.id} wrap={false}>
                <Text style={[s.cell, { width: 18 }]}>{i + 1}</Text>
                <Text style={[s.cell, { flex: 2 }]}>{r.meta.map || '—'}</Text>
                <Text style={[s.cell, { flex: 2, color: MUTE }]}>{r.meta.area || '—'}</Text>
                <Text style={[s.cell, { width: 40, color: teamColor(winnerLabel(r.meta.winner)) }]}>{winnerLabel(r.meta.winner)}</Text>
                <Text style={[s.cell, s.right, { width: 42 }]}>{r.meta.playerCount ?? '—'}</Text>
                <Text style={[s.cell, s.right, { width: 40, color: BLUE }]}>{c.usa ?? '—'}</Text>
                <Text style={[s.cell, s.right, { width: 40, color: RED }]}>{c.csa ?? '—'}</Text>
              </View>
            );
          })}
        </View>

        {/* units */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Unit performance</Text>
          <View style={s.headRow}>
            <Text style={[s.th, s.cell, { flex: 2 }]}>Unit</Text>
            <Text style={[s.th, s.cell, s.right, { width: 36 }]}>Plrs</Text>
            <Text style={[s.th, s.cell, s.right, { width: 30 }]}>Rnds</Text>
            <Text style={[s.th, s.cell, s.right, { width: 28 }]}>K</Text>
            <Text style={[s.th, s.cell, s.right, { width: 28 }]}>D</Text>
            <Text style={[s.th, s.cell, s.right, { width: 34 }]}>K/D</Text>
            <Text style={[s.th, s.cell, s.right, { width: 34 }]}>xTd</Text>
            <Text style={[s.th, s.cell, s.right, { width: 34 }]}>xTk</Text>
          </View>
          {units.map((u) => (
            <View style={s.row} key={u.key} wrap={false}>
              <View style={[s.cell, { flex: 2, flexDirection: 'row', alignItems: 'center' }]}>
                <View style={[s.dot, { backgroundColor: teamColor(u.team) }]} />
                <Text>{u.regiment}</Text>
              </View>
              <Text style={[s.cell, s.right, { width: 36 }]}>{u.players}</Text>
              <Text style={[s.cell, s.right, { width: 30 }]}>{u.rounds}</Text>
              <Text style={[s.cell, s.right, { width: 28 }]}>{u.kills}</Text>
              <Text style={[s.cell, s.right, { width: 28 }]}>{u.deaths}</Text>
              <Text style={[s.cell, s.right, { width: 34 }]}>{kd(u.kd)}</Text>
              <Text style={[s.cell, s.right, { width: 34 }]}>{formatAvgT(u.avgTd)}</Text>
              <Text style={[s.cell, s.right, { width: 34 }]}>{formatAvgT(u.avgTk)}</Text>
            </View>
          ))}
        </View>

        {/* players */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Player performance {players.length < stats.players.length ? `(top ${players.length})` : ''}</Text>
          <View style={s.headRow}>
            <Text style={[s.th, s.cell, { flex: 2 }]}>Player</Text>
            <Text style={[s.th, s.cell, { flex: 1 }]}>Unit</Text>
            <Text style={[s.th, s.cell, s.right, { width: 24 }]}>R</Text>
            <Text style={[s.th, s.cell, s.right, { width: 28 }]}>K</Text>
            <Text style={[s.th, s.cell, s.right, { width: 28 }]}>D</Text>
            <Text style={[s.th, s.cell, s.right, { width: 34 }]}>K/D</Text>
            <Text style={[s.th, s.cell, s.right, { width: 34 }]}>xTd</Text>
            <Text style={[s.th, s.cell, s.right, { width: 34 }]}>xTk</Text>
          </View>
          {players.map((p) => (
            <View style={s.row} key={p.key} wrap={false}>
              <View style={[s.cell, { flex: 2, flexDirection: 'row', alignItems: 'center' }]}>
                <View style={[s.dot, { backgroundColor: teamColor(p.team) }]} />
                <Text>{p.name}</Text>
              </View>
              <Text style={[s.cell, { flex: 1, color: MUTE }]}>{p.regiment === UNTAGGED ? '—' : p.regiment}</Text>
              <Text style={[s.cell, s.right, { width: 24 }]}>{p.rounds}</Text>
              <Text style={[s.cell, s.right, { width: 28 }]}>{p.kills}</Text>
              <Text style={[s.cell, s.right, { width: 28 }]}>{p.deaths}</Text>
              <Text style={[s.cell, s.right, { width: 34 }]}>{kd(p.kd)}</Text>
              <Text style={[s.cell, s.right, { width: 34 }]}>{formatAvgT(p.avgTd)}</Text>
              <Text style={[s.cell, s.right, { width: 34 }]}>{formatAvgT(p.avgTk)}</Text>
            </View>
          ))}
        </View>

        <Text style={s.footer} render={({ pageNumber, totalPages }) => `Replay Suite · After-Action · page ${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}

// Build the PDF and trigger a browser download.
export async function generateEventReportPDF({ event, stats }) {
  const generatedAt = new Date().toLocaleString();
  const blob = await pdf(<ReportDoc event={event} stats={stats} generatedAt={generatedAt} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safe = (event.name || 'event').replace(/[^\w.-]+/g, '_');
  a.download = `${safe}_AfterAction.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
