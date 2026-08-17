import type { Feature, FeatureCollection, Polygon } from 'geojson';

export type VillageProps = { title: string; bondaryor?: string };
export type VillageFeature = Feature<Polygon, VillageProps>;
export type VillageCollection = FeatureCollection<Polygon, VillageProps>;

/** ray-casting: จุด (lng,lat) อยู่ในวงแหวน ring ([lng,lat][]) หรือไม่ */
export function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect =
      (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** คืนชื่อหมู่บ้านแรกที่พิกัดตกอยู่ (ใช้วงแหวนนอก coordinates[0]) หรือ null */
export function villageOf(lng: number, lat: number, features: VillageFeature[]): string | null {
  for (const f of features) {
    const outer = f.geometry.coordinates[0];
    if (pointInRing(lng, lat, outer)) return f.properties.title;
  }
  return null;
}

/** ระยะทางบนผิวโลกระหว่างสองพิกัด (เมตร) — สูตร haversine, R = 6371000 ม. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
