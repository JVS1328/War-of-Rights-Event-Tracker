import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  title: {
    fontSize: 20,
    marginBottom: 10,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 8,
    marginTop: 16,
    fontWeight: 'bold',
    color: '#334155',
  },
  sectionTitle: {
    fontSize: 12,
    marginBottom: 6,
    marginTop: 12,
    fontWeight: 'bold',
    color: '#475569',
  },
  text: {
    fontSize: 10,
    marginBottom: 4,
    color: '#1e293b',
  },
  table: {
    display: 'table',
    width: 'auto',
    marginTop: 8,
    marginBottom: 12,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  tableHeader: {
    backgroundColor: '#f1f5f9',
    fontWeight: 'bold',
  },
  tableCell: {
    padding: 6,
    fontSize: 9,
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
  },
  metadata: {
    backgroundColor: '#f8fafc',
    padding: 10,
    marginBottom: 12,
    borderRadius: 4,
  },
  regimentSection: {
    marginBottom: 16,
    padding: 10,
    backgroundColor: '#fafafa',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  divider: {
    marginTop: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  statRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  statLabel: {
    fontWeight: 'bold',
    width: 120,
  },
  statValue: {
    flex: 1,
  },
});

// PDF Document Component
const RoundAnalysisPDF = ({
  round,
  regimentStats,
  lossRates,
  topDeaths,
  timelineData,
  getPlayerPresenceData
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

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <Text style={styles.title}>War of Rights - Round {round.id} Analysis</Text>

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

        {/* Highest Loss Rates */}
        <Text style={styles.subtitle}>Highest Loss Rates by Regiment</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, { width: '40%' }]}>Regiment</Text>
            <Text style={[styles.tableCell, { width: '20%' }]}>Loss Rate</Text>
            <Text style={[styles.tableCell, { width: '20%' }]}>Casualties</Text>
            <Text style={[styles.tableCell, { width: '20%', borderRightWidth: 0 }]}>Players</Text>
          </View>
          {lossRates.map((regiment, index) => (
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
        <View style={styles.table}>
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

      {/* Regiment Casualty Details - Page 2+ */}
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

      {/* Timeline Data - Page 3 */}
      {timelineData && timelineData.buckets && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>Regiment Losses Over Time</Text>
          <Text style={styles.text}>Casualties per regiment in 1-minute intervals</Text>
          <View style={styles.divider} />

          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, { width: '25%' }]}>Regiment</Text>
              {timelineData.buckets.slice(0, 10).map((bucket, i) => (
                <Text key={i} style={[styles.tableCell, { width: `${75 / Math.min(10, timelineData.buckets.length)}%`, borderRightWidth: i === Math.min(9, timelineData.buckets.length - 1) ? 0 : 1 }]}>
                  {bucket}
                </Text>
              ))}
            </View>
            {timelineData.regiments
              .filter(r => r.name !== 'UNTAGGED')
              .sort((a, b) => b.deaths.reduce((sum, d) => sum + d, 0) - a.deaths.reduce((sum, d) => sum + d, 0))
              .slice(0, 15)
              .map((regiment, regIndex) => (
                <View key={regIndex} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { width: '25%' }]}>{regiment.name}</Text>
                  {regiment.deaths.slice(0, 10).map((count, i) => (
                    <Text key={i} style={[styles.tableCell, { width: `${75 / Math.min(10, timelineData.buckets.length)}%`, borderRightWidth: i === Math.min(9, timelineData.buckets.length - 1) ? 0 : 1 }]}>
                      {count || 0}
                    </Text>
                  ))}
                </View>
              ))}
          </View>

          <Text style={[styles.text, { marginTop: 12, fontSize: 8, color: '#64748b' }]}>
            Note: Showing first 10 time intervals and top 15 regiments by total casualties
          </Text>
        </Page>
      )}
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
