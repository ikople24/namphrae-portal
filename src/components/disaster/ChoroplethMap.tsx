// ต้อง import CSS ของ Leaflet เอง เพราะคอมโพเนนต์นี้ถูกยกมาจาก namphrae-map
// โดยไม่ได้พ่วง _app.tsx เดิมที่เคย import ไว้ระดับแอป — ถ้าไม่มีไฟล์นี้ กฎจัดตำแหน่ง
// ไทล์ของ Leaflet จะหายไป ทำให้แผนที่ขึ้นแค่บางไทล์และเพี้ยนตำแหน่ง
import 'leaflet/dist/leaflet.css';
import { MapContainer, ZoomControl, GeoJSON } from 'react-leaflet';
import type { Layer, PathOptions } from 'leaflet';
import type { Feature } from 'geojson';
import type { VillageCollection, VillageProps } from '@/lib/village-geo';
import { DENGUE_SCALE } from '@/lib/color-scales';
import { CENTER, BaseTileLayer, FitBounds, type BaseLayer } from '@/components/disaster/mapBase';

function colorFor(count: number, max: number, scale: string[]): string {
  if (count <= 0) return '#ffffff';
  const t = max <= 0 ? 0 : count / max;
  const idx = Math.min(scale.length - 1, Math.floor(t * scale.length));
  return scale[idx];
}

export default function ChoroplethMap({
  villages, counts, scale = DENGUE_SCALE, baseLayer = 'road',
}: {
  villages: VillageCollection;
  counts: Record<string, number>;
  scale?: string[];
  baseLayer?: BaseLayer;
}) {
  const max = Math.max(0, ...Object.values(counts));
  return (
    <MapContainer center={CENTER} zoom={12} zoomControl={false} className="h-full w-full z-0 np-disaster-map">
      <ZoomControl position="bottomleft" />
      <FitBounds villages={villages} />
      <BaseTileLayer baseLayer={baseLayer} />
      <GeoJSON
        key={JSON.stringify(counts)}
        data={villages}
        style={(feature): PathOptions => {
          const title = (feature?.properties as VillageProps | undefined)?.title ?? '';
          return { color: '#9fb7ac', weight: 1, fillColor: colorFor(counts[title] ?? 0, max, scale), fillOpacity: 0.8 };
        }}
        onEachFeature={(feature: Feature, layer: Layer) => {
          const title = (feature.properties as VillageProps | null)?.title ?? '';
          layer.bindTooltip(`${title}: ${counts[title] ?? 0} ครั้ง`, { sticky: true });
        }}
      />
    </MapContainer>
  );
}
