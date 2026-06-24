import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Animated,
} from 'react-native';
import { Faction, FACTIONS, FactionConfig } from '../constants/factions';
import { useUserStore } from '../stores/userStore';

export default function WelcomeScreen() {
  const [name, setName] = useState('');
  const [selectedFaction, setSelectedFaction] = useState<Faction | null>(null);
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);

  const canProceed = name.trim().length >= 2 && selectedFaction !== null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>⚔️ GEO BATTLE</Text>
        <Text style={styles.subtitle}>Erobere die Welt durch Bewegung</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Dein Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Kriegername..."
            placeholderTextColor="#555"
            maxLength={20}
            autoCorrect={false}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Wähle deine Fraktion</Text>
          {(Object.values(FACTIONS) as FactionConfig[]).map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[
                styles.factionCard,
                selectedFaction === f.id && { borderColor: f.color, backgroundColor: f.colorDim },
              ]}
              onPress={() => setSelectedFaction(f.id)}
              activeOpacity={0.8}
            >
              <View style={styles.factionHeader}>
                <Text style={styles.factionEmoji}>{f.emoji}</Text>
                <Text style={[styles.factionName, { color: f.color }]}>{f.name}</Text>
                {selectedFaction === f.id && (
                  <Text style={[styles.selected, { color: f.color }]}>✓ Gewählt</Text>
                )}
              </View>
              <Text style={styles.factionDesc}>{f.description}</Text>
              <Text style={styles.factionBonus}>🛡 {f.passiveBonus}</Text>
              <Text style={styles.factionSpell}>
                ✨ Spell: <Text style={{ color: f.color }}>{f.spell.name}</Text> — {f.spell.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.btn, !canProceed && styles.btnDisabled]}
          onPress={() => canProceed && completeOnboarding(name.trim(), selectedFaction!)}
          disabled={!canProceed}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>Ins Schlachtfeld →</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          ⚠️ Fraktion kann später nicht mehr gewechselt werden
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0F' },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 32, fontWeight: '900', color: '#E8E8F0', textAlign: 'center', marginTop: 20 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 30 },
  section: { marginBottom: 24 },
  label: { fontSize: 13, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: '#141420',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A3A',
    color: '#E8E8F0',
    fontSize: 16,
    padding: 14,
  },
  factionCard: {
    backgroundColor: '#141420',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2A2A3A',
    padding: 16,
    marginBottom: 12,
  },
  factionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  factionEmoji: { fontSize: 24, marginRight: 10 },
  factionName: { fontSize: 18, fontWeight: '700', flex: 1 },
  selected: { fontSize: 13, fontWeight: '600' },
  factionDesc: { color: '#AAA', fontSize: 13, marginBottom: 6, lineHeight: 18 },
  factionBonus: { color: '#888', fontSize: 12, marginBottom: 4 },
  factionSpell: { color: '#888', fontSize: 12 },
  btn: {
    backgroundColor: '#1E8FD9',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnDisabled: { backgroundColor: '#2A2A3A' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: { color: '#444', fontSize: 11, textAlign: 'center' },
});
