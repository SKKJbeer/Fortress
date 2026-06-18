import { latLngToCell, cellToBoundary, gridDisk, cellToLatLng } from 'h3-js';
import { H3_RESOLUTION, NEARBY_RING_RADIUS } from '../constants/factions';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export function coordsToH3(lat: number, lng: number): string {
  return latLngToCell(lat, lng, H3_RESOLUTION);
}

export function h3ToPolygonCoords(h3id: string): LatLng[] {
  const boundary = cellToBoundary(h3id);
  return boundary.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
}

export function getNearbyH3Cells(centerH3: string): string[] {
  return gridDisk(centerH3, NEARBY_RING_RADIUS);
}

export function h3ToCenterLatLng(h3id: string): LatLng {
  const [lat, lng] = cellToLatLng(h3id);
  return { latitude: lat, longitude: lng };
}

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const aVal =
    sinDLat * sinDLat +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      sinDLon *
      sinDLon;
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}

export function speedKmh(prev: LatLng, curr: LatLng, elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  return (distanceKm(prev, curr) / elapsedSeconds) * 3600;
}
