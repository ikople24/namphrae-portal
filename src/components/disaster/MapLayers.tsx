import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
// CSS ของ markercluster ต้อง import คู่กับตัวปลั๊กอินเสมอ — ปลั๊กอินจัดกลุ่มได้โดยไม่มีมัน
// แต่จะไม่มีอะไรวาดวงกลมกับสีตามจำนวน เหลือแค่ตัวเลขลอยอยู่บนแผนที่ ต้นทางเคย import
// ไว้ที่ _app.tsx ระดับแอป ที่นี่ผูกไว้กับคอมโพเนนต์ที่ใช้จริงเพื่อไม่ให้หน้าอื่นแบก
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
// leaflet.heat ไม่มี CSS ของตัวเอง — มันวาดลง canvas ตรง ๆ
import 'leaflet.heat';
import type { IncidentItem } from '@/types/disaster';
import { imageUrl } from '@/lib/disaster-image';
import { DISASTER_COLORS } from '@/lib/disaster-types';

function popupHtml(it: IncidentItem): string {
  const img = it.imageFile
    ? `<img src="${imageUrl(it.imageFile)}" style="margin-top:4px;width:160px;border-radius:6px"/>`
    : '';
  return `<div style="font-size:13px"><b>${it.dateText}</b><div>${it.areaType}</div>${img}</div>`;
}

/** จับกลุ่มหมุด (marker cluster) */
export function ClusterLayer({ incidents }: { incidents: IncidentItem[] }) {
  const map = useMap();
  useEffect(() => {
    const group = L.markerClusterGroup();
    for (const it of incidents) {
      const [lng, lat] = it.location.coordinates;
      const marker = L.circleMarker([lat, lng], {
        radius: 7, color: '#fff', weight: 1.5,
        fillColor: DISASTER_COLORS[it.disasterType], fillOpacity: 0.9,
      }).bindPopup(popupHtml(it));
      group.addLayer(marker);
    }
    map.addLayer(group);
    return () => { map.removeLayer(group); };
  }, [map, incidents]);
  return null;
}

/** ความหนาแน่น (heatmap) */
export function HeatLayer({ incidents }: { incidents: IncidentItem[] }) {
  const map = useMap();
  useEffect(() => {
    const pts = incidents.map(
      (it) => [it.location.coordinates[1], it.location.coordinates[0], 0.6] as [number, number, number]
    );
    const layer = L.heatLayer(pts, { radius: 25, blur: 15, maxZoom: 17 });
    map.addLayer(layer);
    return () => { map.removeLayer(layer); };
  }, [map, incidents]);
  return null;
}
