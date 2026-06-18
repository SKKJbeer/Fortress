import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import MapView, { Polygon, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { latLngToCell, gridDisk, cellToLatLng } from 'h3-js';

import { FACTIONS, NEUTRAL_STYLE, H3_RESOLUTION, NEARBY_RING_RADIUS } from '../constants/factions';
import { h3ToPolygonCoords } from '../utils/h3Utils';
import { useUserStore } from '../stores/userStore';
import { useMapStore } from '../stores/mapStore';
import { useRunStore } from '../stores/runStore';
import RunOverlay from './RunOverlay';

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [visibleCells, setVisibleCells] = useState<string[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const { faction, name } = useUserStore();
  const { territories, setUserCell, captureCell, seedDemoTerritories } = useMapStore();
  const { isRunning, startRun, stopRun, updatePosition, progressCapture, currentH3Cell, inProgressCell, capturedCells } = useRunStore();
  const addRunStats = useUserStore((s) => s.addRunStats);

  const factionConfig = faction ? FACTIONS[faction] : null;

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Standort benötigt', 'Geo Battle braucht deinen Standort für die Karte.');
        return;
      }
      setPermissionGranted(true);

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      setUserLocation({ latitude, longitude });

      const h3id = latLngToCell(latitude, longitude, H3_RESOLUTION);
      setUserCell(h3id);
      updateCells(h3id);

      if (Object.keys(useMapStore.getState().territories).length === 0 && faction) {
        seedDemoTerritories(h3id, faction);
      }

      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      });
    })();
  }, []);

  function updateCells(centerH3: string) {
    const cells = gridDisk(centerH3, NEARBY_RING_RADIUS);
    setVisibleCells(cells);
  }

  const handleStartRun = async () => {
    if (!permissionGranted) return;
    startRun();

    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 15 },
      (loc) => {
        const { latitude, longitude, speed } = loc.coords;
        const speedKmh = ((speed ?? 0) * 3.6);
        const h3id = latLngToCell(latitude, longitude, H3_RESOLUTION);
        const pos = { latitude, longitude };

        setUserLocation(pos);
        updateCells(h3id);
        setUserCell(h3id);
        updatePosition(pos, h3id, speedKmh);

        const territory = useMapStore.getState().territories[h3id];
        const isEnemy = territory && territory.faction !== faction;
        const isNeutral = !territory;

        if ((isEnemy || isNeutral) && faction && name) {
          const strength = territory?.strength ?? 1;
          const fConfig = FACTIONS[faction];
          const required = Math.round(60 * strength * fConfig.captureMultiplier);
          const captured = progressCapture(h3id, required);

          if (captured) {
            captureCell(h3id, faction, name);
          }
        }
      }
    );
  };

  const handleStopRun = () => {
    locationSub.current?.remove();
    locationSub.current = null;
    const result = stopRun();
    addRunStats(result.distanceKm, result.capturedCells.length);
    Alert.alert(
      '🏁 Run beendet!',
      `${result.distanceKm.toFixed(2)} km · ${result.capturedCells.length} Zellen erobert`,
      [{ text: 'Super!' }]
    );
  };

  const handleRegionChange = useCallback((region: Region) => {
    const centerH3 = latLngToCell(region.latitude, region.longitude, H3_RESOLUTION);
    const cells = gridDisk(centerH3, NEARBY_RING_RADIUS + 2);
    setVisibleCells(cells);
  }, []);

  const centerOnUser = () => {
    if (userLocation) {
      mapRef.current?.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        userInterfaceStyle="dark"
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChangeComplete={handleRegionChange}
        initialRegion={{
          latitude: 47.3769,
          longitude: 8.5417,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }}
      >
        {visibleCells.map((h3id) => {
          const territory = territories[h3id];
          const isCapturing = inProgressCell?.h3id === h3id;
          const isCaptured = capturedCells.includes(h3id);
          const isUserCell = h3id === currentH3Cell;

          let fillColor: string;
          let strokeColor: string;
          let strokeWidth = 0.5;

          if (isCaptured && faction) {
            fillColor = FACTIONS[faction].colorDim;
            strokeColor = FACTIONS[faction].color;
            strokeWidth = 2;
          } else if (isCapturing && faction) {
            const progress = inProgressCell!.secondsIn / inProgressCell!.requiredSeconds;
            fillColor = `rgba(${faction === 'undead' ? '155,48,255' : faction === 'human' ? '30,143,217' : '0,200,83'},${0.2 + progress * 0.5})`;
            strokeColor = FACTIONS[faction].color;
            strokeWidth = 2;
          } else if (isUserCell && !isRunning) {
            fillColor = 'rgba(255,255,255,0.1)';
            strokeColor = '#FFFFFF';
            strokeWidth = 1.5;
          } else if (territory) {
            const f = FACTIONS[territory.faction];
            fillColor = f.colorDim;
            strokeColor = f.colorBorder;
          } else {
            fillColor = NEUTRAL_STYLE.colorDim;
            strokeColor = NEUTRAL_STYLE.colorBorder;
          }

          return (
            <Polygon
              key={h3id}
              coordinates={h3ToPolygonCoords(h3id)}
              fillColor={fillColor}
              strokeColor={strokeColor}
              strokeWidth={strokeWidth}
            />
          );
        })}
      </MapView>

      {/* Top HUD */}
      <View style={styles.hud}>
        {factionConfig && (
          <View style={[styles.factionBadge, { borderColor: factionConfig.color }]}>
            <Text style={styles.factionEmoji}>{factionConfig.emoji}</Text>
            <Text style={[styles.factionText, { color: factionConfig.color }]}>
              {factionConfig.name}
            </Text>
          </View>
        )}
      </View>

      {/* Center on user button */}
      <TouchableOpacity style={styles.locBtn} onPress={centerOnUser} activeOpacity={0.8}>
        <Text style={styles.locBtnText}>◎</Text>
      </TouchableOpacity>

      {/* Run overlay während eines Runs */}
      {isRunning && <RunOverlay onStop={handleStopRun} />}

      {/* Start Run Button */}
      {!isRunning && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.runBtn, factionConfig && { backgroundColor: factionConfig.color }]}
            onPress={handleStartRun}
            activeOpacity={0.85}
          >
            <Text style={styles.runBtnText}>🏃 RUN STARTEN</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Legende */}
      {!isRunning && (
        <View style={styles.legend}>
          {(Object.values(FACTIONS)).map((f) => (
            <View key={f.id} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: f.color }]} />
              <Text style={styles.legendText}>{f.name}</Text>
            </View>
          ))}
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: NEUTRAL_STYLE.color }]} />
            <Text style={styles.legendText}>Neutral</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  map: { flex: 1 },
  hud: {
    position: 'absolute',
    top: 55,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  factionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,10,15,0.85)',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  factionEmoji: { fontSize: 16, marginRight: 6 },
  factionText: { fontSize: 13, fontWeight: '700' },
  locBtn: {
    position: 'absolute',
    top: 110,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(20,20,32,0.9)',
    borderWidth: 1,
    borderColor: '#2A2A3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locBtnText: { color: '#E8E8F0', fontSize: 22 },
  bottomBar: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
  },
  runBtn: {
    backgroundColor: '#1E8FD9',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  runBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 1 },
  legend: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    backgroundColor: 'rgba(10,10,15,0.85)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { color: '#AAA', fontSize: 11 },
});
