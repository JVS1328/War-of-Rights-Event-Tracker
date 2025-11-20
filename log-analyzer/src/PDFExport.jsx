import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf, Svg, Line, Polyline, Circle, Rect } from '@react-pdf/renderer';

// Create dark theme styles matching the web page
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#1e293b', // slate-800
  },
  title: {
    fontSize: 20,
    marginBottom: 10,
    fontWeight: 'bold',
    color: '#f59e0b', // amber-500
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 8,
    marginTop: 16,
    fontWeight: 'bold',
    color: '#fbbf24', // amber-400
  },
  sectionTitle: {
    fontSize: 12,
    marginBottom: 6,
    marginTop: 12,
    fontWeight: 'bold',
    color: '#fcd34d', // amber-300
  },
  text: {
    fontSize: 10,
    marginBottom: 4,
    color: '#e2e8f0', // slate-200
  },
  textSmall: {
    fontSize: 8,
    color: '#cbd5e1', // slate-300
  },
  table: {
    display: 'table',
    width: 'auto',
    marginTop: 8,
    marginBottom: 12,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#475569', // slate-600
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#475569',
  },
  tableHeader: {
    backgroundColor: '#334155', // slate-700
    fontWeight: 'bold',
    color: '#fbbf24', // amber-400
  },
  tableCell: {
    padding: 6,
    fontSize: 9,
    borderRightWidth: 1,
    borderRightColor: '#475569',
    color: '#e2e8f0',
  },
  metadata: {
    backgroundColor: '#334155', // slate-700
    padding: 10,
    marginBottom: 12,
    borderRadius: 4,
  },
  regimentSection: {
    marginBottom: 16,
    padding: 10,
    backgroundColor: '#334155',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  divider: {
    marginTop: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#475569',
  },
  statRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  statLabel: {
    fontWeight: 'bold',
    width: 120,
    color: '#fbbf24',
  },
  statValue: {
    flex: 1,
    color: '#e2e8f0',
  },
  chartContainer: {
    marginTop: 12,
    marginBottom: 16,
    padding: 10,
    backgroundColor: '#334155',
    borderRadius: 4,
  },
  deathBox: {
    padding: 10,
    backgroundColor: '#475569', // slate-600
    borderRadius: 4,
    marginBottom: 10,
  },
  deathLabel: {
    fontSize: 9,
    color: '#cbd5e1',
    marginBottom: 3,
  },
  deathValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#e2e8f0',
  },
});

// Regiment Losses Over Time Chart Component
const LossesOverTimeChart = ({ timelineData }) => {
  if (!timelineData || !timelineData.buckets || !timelineData.regiments) {
    return null;
  }

  const width = 500;
  const height = 250;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Get all regiments sorted by total casualties
  const allRegiments = timelineData.regiments
    .filter(r => r.name !== 'UNTAGGED')
    .sort((a, b) => b.deaths.reduce((sum, d) => sum + d, 0) - a.deaths.reduce((sum, d) => sum + d, 0));

  if (allRegiments.length === 0) return null;

  // Find max value for scaling
  const maxDeaths = Math.max(
    ...allRegiments.map(r => Math.max(...r.deaths)),
    1
  );

  // Colors for regiment lines
  const colors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#3b82f6', '#a855f7', '#ec4899', '#06b6d4',
  ];

  // Calculate points for each regiment
  const getPoints = (regiment) => {
    return regiment.deaths.map((deaths, i) => {
      const x = padding.left + (i / Math.max(regiment.deaths.length - 1, 1)) * chartWidth;
      const y = padding.top + chartHeight - (deaths / maxDeaths) * chartHeight;
      return `${x},${y}`;
    }).join(' ');
  };

  // Grid lines (horizontal)
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
    const y = padding.top + chartHeight - ratio * chartHeight;
    return { y, value: Math.round(maxDeaths * ratio) };
  });

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Background */}
      <Rect x="0" y="0" width={width} height={height} fill="#1e293b" />

      {/* Grid lines */}
      {gridLines.map((line, i) => (
        <React.Fragment key={i}>
          <Line
            x1={padding.left}
            y1={line.y}
            x2={width - padding.right}
            y2={line.y}
            stroke="#475569"
            strokeWidth="0.5"
            strokeDasharray="3,3"
          />
        </React.Fragment>
      ))}

      {/* Y-axis labels */}
      {gridLines.map((line, i) => (
        <React.Fragment key={`label-${i}`}>
          <Rect x="0" y={line.y - 6} width={padding.left - 5} height="12" fill="#1e293b" />
        </React.Fragment>
      ))}

      {/* Regiment lines */}
      {allRegiments.map((regiment, i) => (
        <Polyline
          key={i}
          points={getPoints(regiment)}
          fill="none"
          stroke={colors[i % colors.length]}
          strokeWidth="2"
        />
      ))}

      {/* Data points */}
      {allRegiments.map((regiment, regIndex) => (
        <React.Fragment key={`points-${regIndex}`}>
          {regiment.deaths.map((deaths, i) => {
            const x = padding.left + (i / Math.max(regiment.deaths.length - 1, 1)) * chartWidth;
            const y = padding.top + chartHeight - (deaths / maxDeaths) * chartHeight;
            return (
              <Circle
                key={i}
                cx={x}
                cy={y}
                r="2"
                fill={colors[regIndex % colors.length]}
              />
            );
          })}
        </React.Fragment>
      ))}

      {/* X-axis */}
      <Line
        x1={padding.left}
        y1={height - padding.bottom}
        x2={width - padding.right}
        y2={height - padding.bottom}
        stroke="#475569"
        strokeWidth="1"
      />

      {/* Y-axis */}
      <Line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={height - padding.bottom}
        stroke="#475569"
        strokeWidth="1"
      />
    </Svg>
  );
};

// PDF Document Component
const RoundAnalysisPDF = ({
  round,
  regimentStats,
  lossRates,
  topDeaths,
  timelineData,
  getPlayerPresenceData,
  logDate,
  firstAndLastDeaths,
}) => {
  // Helper to format time in combat
  const formatTimeInCombat = (presencePercentage, roundDurationSeconds) => {
    const seconds = Math.round((presencePercentage / 100) * roundDurationSeconds);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s (${presencePercentage}%)`;
  };

  // Calculate round duration in seconds
  const getRoundDurationSeconds = () => {
    if (!round.startTime || !round.endTime) return 0;
    const timeToSeconds = (timeStr) => {
      const [hours, minutes, seconds] = timeStr.split(':').map(Number);
      return hours * 3600 + minutes * 60 + seconds;
    };
    return timeToSeconds(round.endTime) - timeToSeconds(round.startTime);
  };

  const roundDuration = getRoundDurationSeconds();

  // Get regiment-level time in combat data
  const getRegimentTimeInCombat = () => {
    return regimentStats
      .filter(r => r.name !== 'UNTAGGED')
      .map(regiment => {
        const playerData = getPlayerPresenceData(regiment.name);
        const totalPlayers = playerData.length;

        // Calculate average presence across all players in the regiment
        const avgPresence = totalPlayers > 0
          ? Math.round(playerData.reduce((sum, p) => sum + p.presence, 0) / totalPlayers)
          : 0;

        return {
          name: regiment.name,
          totalPlayers,
          avgPresence,
          casualties: regiment.casualties,
        };
      })
      .sort((a, b) => b.avgPresence - a.avgPresence); // Sort by average presence
  };

  const regimentTimeInCombatData = getRegimentTimeInCombat();

  // Colors for chart legend
  const colors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#3b82f6', '#a855f7', '#ec4899', '#06b6d4',
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <Text style={styles.title}>
          War of Rights - Round {round.id} Analysis
        </Text>
        {logDate && (
          <Text style={[styles.text, { marginBottom: 12 }]}>{logDate}</Text>
        )}

        {/* Round Metadata */}
        <View style={styles.metadata}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Start Time:</Text>
            <Text style={styles.statValue}>{round.startTime}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>End Time:</Text>
            <Text style={styles.statValue}>{round.endTime}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Duration:</Text>
            <Text style={styles.statValue}>{round.duration}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total Casualties:</Text>
            <Text style={styles.statValue}>{round.adjustedCasualties}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total Players:</Text>
            <Text style={styles.statValue}>{new Set(round.kills.map(k => k.player)).size}</Text>
          </View>
        </View>

        {/* First and Last Deaths */}
        {firstAndLastDeaths && (firstAndLastDeaths.firstDeath || firstAndLastDeaths.lastDeath) && (
          <View style={{ marginTop: 12, marginBottom: 12 }} wrap={false}>
            <Text style={styles.subtitle}>First & Last Deaths</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {firstAndLastDeaths.firstDeath && (
                <View style={[styles.deathBox, { flex: 1 }]}>
                  <Text style={[styles.sectionTitle, { marginTop: 0, color: '#22c55e' }]}>First Death</Text>
                  <View style={{ marginTop: 6 }}>
                    <Text style={styles.deathLabel}>Player</Text>
                    <Text style={styles.deathValue}>{firstAndLastDeaths.firstDeath.player}</Text>
                  </View>
                  <View style={{ marginTop: 6 }}>
                    <Text style={styles.deathLabel}>Regiment</Text>
                    <Text style={[styles.deathValue, { color: '#fbbf24' }]}>{firstAndLastDeaths.firstDeath.regiment}</Text>
                  </View>
                </View>
              )}
              {firstAndLastDeaths.lastDeath && (
                <View style={[styles.deathBox, { flex: 1 }]}>
                  <Text style={[styles.sectionTitle, { marginTop: 0, color: '#ef4444' }]}>Last Death</Text>
                  <View style={{ marginTop: 6 }}>
                    <Text style={styles.deathLabel}>Player</Text>
                    <Text style={styles.deathValue}>{firstAndLastDeaths.lastDeath.player}</Text>
                  </View>
                  <View style={{ marginTop: 6 }}>
                    <Text style={styles.deathLabel}>Regiment</Text>
                    <Text style={[styles.deathValue, { color: '#fbbf24' }]}>{firstAndLastDeaths.lastDeath.regiment}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Highest Loss Rates */}
        <Text style={styles.subtitle}>Highest Loss Rates by Regiment</Text>
        <View style={styles.table} wrap={false}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, { width: '40%' }]}>Regiment</Text>
            <Text style={[styles.tableCell, { width: '20%' }]}>Loss Rate</Text>
            <Text style={[styles.tableCell, { width: '20%' }]}>Casualties</Text>
            <Text style={[styles.tableCell, { width: '20%', borderRightWidth: 0 }]}>Players</Text>
          </View>
          {lossRates.slice(0, 12).map((regiment, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: '40%' }]}>{regiment.name}</Text>
              <Text style={[styles.tableCell, { width: '20%' }]}>{regiment.lossRate.toFixed(2)}</Text>
              <Text style={[styles.tableCell, { width: '20%' }]}>{regiment.casualties}</Text>
              <Text style={[styles.tableCell, { width: '20%', borderRightWidth: 0 }]}>{regiment.playerCount}</Text>
            </View>
          ))}
        </View>

        {/* Top Individual Deaths */}
        <Text style={styles.subtitle}>Top Individual Deaths</Text>
        <View style={styles.table} wrap={false}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, { width: '50%' }]}>Player</Text>
            <Text style={[styles.tableCell, { width: '30%' }]}>Regiment</Text>
            <Text style={[styles.tableCell, { width: '20%', borderRightWidth: 0 }]}>Deaths</Text>
          </View>
          {topDeaths.slice(0, 15).map((player, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: '50%' }]}>{player.name}</Text>
              <Text style={[styles.tableCell, { width: '30%' }]}>{player.regiment}</Text>
              <Text style={[styles.tableCell, { width: '20%', borderRightWidth: 0 }]}>{player.deaths}</Text>
            </View>
          ))}
        </View>
      </Page>

      {/* Time in Combat - Page 2 */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Time in Combat by Regiment</Text>
        <Text style={styles.text}>Average time spent in combat per regiment</Text>
        <View style={styles.divider} />

        <View style={styles.table} wrap={false}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, { width: '35%' }]}>Regiment</Text>
            <Text style={[styles.tableCell, { width: '20%' }]}>Players</Text>
            <Text style={[styles.tableCell, { width: '25%' }]}>Avg Time</Text>
            <Text style={[styles.tableCell, { width: '20%', borderRightWidth: 0 }]}>Casualties</Text>
          </View>
          {regimentTimeInCombatData.map((regiment, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: '35%' }]}>{regiment.name}</Text>
              <Text style={[styles.tableCell, { width: '20%' }]}>{regiment.totalPlayers}</Text>
              <Text style={[styles.tableCell, { width: '25%' }]}>
                {formatTimeInCombat(regiment.avgPresence, roundDuration)}
              </Text>
              <Text style={[styles.tableCell, { width: '20%', borderRightWidth: 0 }]}>
                {regiment.casualties}
              </Text>
            </View>
          ))}
        </View>
      </Page>

      {/* Regiment Losses Over Time Chart - Page 3 */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Regiment Losses Over Time</Text>
        <Text style={styles.text}>Deaths per regiment throughout the round (1-minute intervals)</Text>
        <View style={styles.divider} />

        <View style={styles.chartContainer}>
          <LossesOverTimeChart timelineData={timelineData} />
        </View>

        {/* Chart Legend */}
        <Text style={styles.sectionTitle}>Legend</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
          {timelineData && timelineData.regiments
            .filter(r => r.name !== 'UNTAGGED')
            .sort((a, b) => b.deaths.reduce((sum, d) => sum + d, 0) - a.deaths.reduce((sum, d) => sum + d, 0))
            .map((regiment, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 4 }}>
                <View style={{ width: 12, height: 12, backgroundColor: colors[i % colors.length], marginRight: 4 }} />
                <Text style={[styles.textSmall, { color: '#e2e8f0' }]}>{regiment.name}</Text>
              </View>
            ))}
        </View>
      </Page>

      {/* Regiment Casualty Details - Page 4+ */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Regiment Casualty Details</Text>
        <Text style={styles.text}>Organized by regiment with individual player statistics</Text>
        <View style={styles.divider} />

        {regimentStats
          .filter(r => r.name !== 'UNTAGGED')
          .sort((a, b) => b.casualties - a.casualties)
          .map((regiment, regIndex) => {
            const playerData = getPlayerPresenceData(regiment.name);
            const avgLossRate = regiment.casualties / Object.keys(regiment.players).length;

            return (
              <View key={regIndex} style={styles.regimentSection} wrap={false}>
                <Text style={styles.sectionTitle}>{regiment.name}</Text>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Total Casualties:</Text>
                  <Text style={styles.statValue}>{regiment.casualties}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Total Players:</Text>
                  <Text style={styles.statValue}>{Object.keys(regiment.players).length}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Avg Loss Rate:</Text>
                  <Text style={styles.statValue}>{avgLossRate.toFixed(2)} deaths/player</Text>
                </View>

                {/* Player Details */}
                <View style={[styles.table, { marginTop: 6 }]}>
                  <View style={[styles.tableRow, styles.tableHeader]}>
                    <Text style={[styles.tableCell, { width: '45%' }]}>Player</Text>
                    <Text style={[styles.tableCell, { width: '20%' }]}>Deaths</Text>
                    <Text style={[styles.tableCell, { width: '35%', borderRightWidth: 0 }]}>Time in Combat</Text>
                  </View>
                  {playerData.map((player, pIndex) => (
                    <View key={pIndex} style={styles.tableRow}>
                      <Text style={[styles.tableCell, { width: '45%' }]}>{player.name}</Text>
                      <Text style={[styles.tableCell, { width: '20%' }]}>{player.deaths}</Text>
                      <Text style={[styles.tableCell, { width: '35%', borderRightWidth: 0 }]}>
                        {formatTimeInCombat(player.presence, roundDuration)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
      </Page>
    </Document>
  );
};

// Export function
export const generateRoundPDF = async (data) => {
  const blob = await pdf(<RoundAnalysisPDF {...data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Round_${data.round.id}_Analysis.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

export default RoundAnalysisPDF;
