import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRunStore } from '../stores/runStore';
import { useUserStore } from '../stores/userStore';
import { FACTIONS } from '../constants/factions';

interface Props {
  onStop: () => void;
}

export default function RunOverlay({ onStop }: Props) {
  const { distanceKm, capturedCells, inProgressCell, lastSpeedKmh, isSpeeding, startedAt } = useRunStore();
  const { faction } = useUserStore();
  const factionConfig = faction ? FACTIONS[faction] : null;

  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      if (startedAt) setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const captureProgress = inProgressCell
    ? Math.min(1, inProgressCell.secondsIn / inProgressCell.requiredSeconds)
    : 0;

  return (
    <View style={styles.overlay}>
      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{formatTime(elapsedSec)}</Text>
          <Text style={styles.statLabel}>Zeit</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{distanceKm.toFixed(2)}</Text>
          <Text style={styles.statLabel}>km</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, isSpeeding && styles.speeding]}>
            {lastSpeedKmh.toFixed(0)}
          </Text>
          <Text style={styles.statLabel}>km/h {isSpeeding ? '⚠️' : ''}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: factionConfig?.color ?? '#fff' }]}>
            {capturedCells.length}
          </Text>
          <Text style={styles.statLabel}>Captured</Text>
        </View>
      </View>

      {/* Capture progress */}
      {inProgressCell && (
        <View style={styles.captureBox}>
          <View style={styles.captureHeader}>
            <Text style={styles.captureLabel}>⚔️ Eroberung läuft...</Text>
            <Text style={styles.capturePercent}>{Math.round(captureProgress * 100)}%</Text>
          </View>
          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${captureProgress * 100}%`,
                  backgroundColor: factionConfig?.color ?? '#1E8FD9',
                },
              ]}
            />
          </View>
          <Text style={styles.captureTime}>
            {Math.round(inProgressCell.requiredSeconds - inProgressCell.secondsIn)}s verbleibend
          </Text>
        </View>
      )}

      {isSpeeding && (
        <View style={styles.speedWarning}>
          <Text style={styles.speedWarningText}>
            ⚠️ Zu schnell! Captures werden nicht gezählt ({lastSpeedKmh.toFixed(0)} km/h)
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.stopBtn} onPress={onStop} activeOpacity={0.85}>
        <Text style={styles.stopBtnText}>■ RUN BEENDEN</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10,10,15,0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#2A2A3A',
    padding: 16,
    paddingBottom: 30,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statBox: { alignItems: 'center' },
  statValue: { color: '#E8E8F0', fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#666', fontSize: 11, marginTop: 2 },
  speeding: { color: '#FF4444' },
  captureBox: {
    backgroundColor: '#141420',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
  captureHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  captureLabel: { color: '#AAA', fontSize: 13 },
  capturePercent: { color: '#E8E8F0', fontSize: 13, fontWeight: '700' },
  progressBg: { height: 8, backgroundColor: '#2A2A3A', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  captureTime: { color: '#666', fontSize: 11, marginTop: 6 },
  speedWarning: {
    backgroundColor: 'rgba(255,68,68,0.15)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FF4444',
  },
  speedWarningText: { color: '#FF8888', fontSize: 12, textAlign: 'center' },
  stopBtn: {
    backgroundColor: '#2A0000',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF4444',
  },
  stopBtnText: { color: '#FF6666', fontSize: 16, fontWeight: '700', letterSpacing: 1 },
});
