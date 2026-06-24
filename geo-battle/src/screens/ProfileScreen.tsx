import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useUserStore } from '../stores/userStore';
import { useMapStore } from '../stores/mapStore';
import { FACTIONS } from '../constants/factions';

export default function ProfileScreen() {
  const { name, faction, stats, spellLastUsedAt, canUseSpell, useSpell } = useUserStore();
  const { territories } = useMapStore();

  const factionConfig = faction ? FACTIONS[faction] : null;

  const ownedCells = Object.values(territories).filter((t) => t.faction === faction).length;

  const spellReady = canUseSpell();
  const spellCooldownHours = spellLastUsedAt
    ? Math.max(0, 24 - (Date.now() - spellLastUsedAt) / 3600000)
    : 0;

  const handleSpell = () => {
    if (!spellReady) return;
    Alert.alert(
      `✨ ${factionConfig?.spell.name}`,
      factionConfig?.spell.description + '\n\nSpell aktivieren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Aktivieren!',
          onPress: () => {
            useSpell();
            Alert.alert('✨ Spell aktiviert!', `${factionConfig?.spell.name} wurde eingesetzt.`);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.screenTitle}>Profil</Text>

        {/* Player Card */}
        {factionConfig && (
          <View style={[styles.playerCard, { borderColor: factionConfig.color }]}>
            <Text style={styles.playerEmoji}>{factionConfig.emoji}</Text>
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>{name}</Text>
              <Text style={[styles.playerFaction, { color: factionConfig.color }]}>
                {factionConfig.name}
              </Text>
            </View>
          </View>
        )}

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistiken</Text>
          <View style={styles.statsGrid}>
            <StatBox label="Runs" value={stats.totalRuns.toString()} />
            <StatBox label="Gesamt km" value={stats.totalKm.toFixed(1)} />
            <StatBox label="Zellen erobert" value={stats.cellsCaptured.toString()} color={factionConfig?.color} />
            <StatBox label="Aktuell besessen" value={ownedCells.toString()} color={factionConfig?.color} />
          </View>
        </View>

        {/* Spell */}
        {factionConfig && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fraktion Spell</Text>
            <TouchableOpacity
              style={[
                styles.spellCard,
                spellReady ? { borderColor: factionConfig.color } : styles.spellCooldown,
              ]}
              onPress={handleSpell}
              disabled={!spellReady}
              activeOpacity={0.8}
            >
              <View style={styles.spellHeader}>
                <Text style={[styles.spellName, { color: spellReady ? factionConfig.color : '#555' }]}>
                  ✨ {factionConfig.spell.name}
                </Text>
                {spellReady ? (
                  <Text style={[styles.spellStatus, { color: factionConfig.color }]}>BEREIT</Text>
                ) : (
                  <Text style={styles.spellCooldownText}>
                    {spellCooldownHours.toFixed(1)}h
                  </Text>
                )}
              </View>
              <Text style={styles.spellDesc}>{factionConfig.spell.description}</Text>
              {!spellReady && (
                <View style={styles.cooldownBar}>
                  <View
                    style={[
                      styles.cooldownFill,
                      {
                        width: `${((24 - spellCooldownHours) / 24) * 100}%`,
                        backgroundColor: factionConfig.color,
                      },
                    ]}
                  />
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Passive Bonus */}
        {factionConfig && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Passiver Bonus</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>🛡 {factionConfig.passiveBonus}</Text>
              <Text style={styles.infoDesc}>{factionConfig.description}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={statStyles.box}>
      <Text style={[statStyles.value, color ? { color } : null]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: '#141420',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    margin: 4,
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
  value: { color: '#E8E8F0', fontSize: 22, fontWeight: '700' },
  label: { color: '#666', fontSize: 11, marginTop: 4, textAlign: 'center' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0F' },
  container: { padding: 20, paddingBottom: 40 },
  screenTitle: { color: '#E8E8F0', fontSize: 24, fontWeight: '800', marginBottom: 20 },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141420',
    borderRadius: 14,
    borderWidth: 2,
    padding: 16,
    marginBottom: 24,
  },
  playerEmoji: { fontSize: 36, marginRight: 14 },
  playerInfo: { flex: 1 },
  playerName: { color: '#E8E8F0', fontSize: 20, fontWeight: '700' },
  playerFaction: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  section: { marginBottom: 24 },
  sectionTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', margin: -4 },
  spellCard: {
    backgroundColor: '#141420',
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 16,
  },
  spellCooldown: { borderColor: '#2A2A3A' },
  spellHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  spellName: { fontSize: 16, fontWeight: '700' },
  spellStatus: { fontSize: 13, fontWeight: '700' },
  spellCooldownText: { color: '#555', fontSize: 13 },
  spellDesc: { color: '#AAA', fontSize: 13, lineHeight: 18 },
  cooldownBar: {
    height: 4,
    backgroundColor: '#2A2A3A',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 12,
  },
  cooldownFill: { height: '100%', borderRadius: 2 },
  infoCard: {
    backgroundColor: '#141420',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A3A',
    padding: 16,
  },
  infoText: { color: '#E8E8F0', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  infoDesc: { color: '#888', fontSize: 13, lineHeight: 18 },
});
