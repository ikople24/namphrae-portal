// แผนที่ฐานที่ใช้ร่วมกันทุกหน้า (โทน tile / สลับถนน-ดาวเทียม / ซูมให้พอดีตำบลตอนโหลด)
// client-only เท่านั้น — ถูก dynamic import แบบ { ssr: false } ผ่านคอมโพเนนต์แผนที่แต่ละตัว
import { useEffect, useRef } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { VillageCollection } from '@/lib/village-geo';

export const CENTER: [number, number] = [18.73, 98.84]; // ตำบลน้ำแพร่ (fallback ก่อน fitBounds)

export type BaseLayer = 'road' | 'satellite';

// แผนที่ฐาน (ถนน / ดาวเทียม) — สลับผ่าน prop แทน LayersControl ที่ทับ overlay
const TILES: Record<BaseLayer, { url: string; attribution: string; maxZoom?: number; subdomains?: string[] }> = {
  road: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    // ต้องตั้ง maxZoom — ถ้าไม่ตั้ง react-leaflet ส่ง undefined ทับ default → map.getMaxZoom() = Infinity
    // → leaflet.markercluster วน for(zoom=Infinity) ไม่จบ → โหมด "กระจุก" ค้าง/พัง
    maxZoom: 19,
  },
  satellite: {
    // Google Satellite — ซูมได้ลึกกว่า (~z21) + ภาพชนบทไทยชัดกว่า Esri
    url: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: 'Imagery &copy; Google',
    maxZoom: 21,
  },
};

export function BaseTileLayer({ baseLayer }: { baseLayer: BaseLayer }) {
  const tile = TILES[baseLayer];
  return <TileLayer key={baseLayer} url={tile.url} attribution={tile.attribution} maxZoom={tile.maxZoom} subdomains={tile.subdomains ?? 'abc'} />;
}

// ตอนโหลดครั้งแรก ซูมให้พอดีขอบเขตตำบล (เว้นพื้นที่ให้แผงกระจกด้านขวา/บน/ล่าง)
// ป้องกันหลายชั้น: รอ container มีขนาดจริง + พิกัดต้องเป็นตัวเลข + clamp padding + cap zoom
// + หุ้ม try/catch เป็น safety net เพื่อไม่ให้แผนที่ทำทั้งหน้า React ล่ม (Leaflet "infinite tiles")
export function FitBounds({ villages }: { villages?: VillageCollection | null }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !villages) return;
    const bounds = L.geoJSON(villages).getBounds();
    // isValid() เช็กแค่ว่ามีมุม ไม่กัน NaN — ตรวจพิกัดเป็นตัวเลขจริงเอง
    if (!bounds.isValid()) return;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    if (![sw.lat, sw.lng, ne.lat, ne.lng].every(Number.isFinite)) return;
    const center = bounds.getCenter();
    const safeCenter: [number, number] =
      Number.isFinite(center.lat) && Number.isFinite(center.lng) ? [center.lat, center.lng] : CENTER;

    let raf = 0;
    let tries = 0;
    const run = () => {
      if (done.current || !map) return;
      map.invalidateSize(false);
      const size = map.getSize();
      // รอจน container ถูก layout จริงก่อน (บน production effect อาจ fire ก่อนวัดขนาดได้)
      if (size.x < 40 || size.y < 40) {
        if (tries++ < 90) raf = requestAnimationFrame(run);
        return;
      }
      done.current = true;
      // clamp padding ไม่ให้เกินขนาดจอ — กัน (ขนาดจอ − padding) ทำ zoom เพี้ยน
      const padL = Math.min(24, size.x * 0.08);
      const padR = Math.min(300, size.x * 0.35);
      const padT = Math.min(96, size.y * 0.2);
      const padB = Math.min(104, size.y * 0.2);
      try {
        map.fitBounds(bounds, {
          paddingTopLeft: [padL, padT],
          paddingBottomRight: [padR, padB],
          maxZoom: 16,
          animate: false,
        });
      } catch {
        // fallback ปลอดภัย — ไม่ปล่อยให้ทั้งหน้าพัง ถ้า fitBounds คำนวณ zoom เพี้ยน
        try { map.setView(safeCenter, 13, { animate: false }); } catch { /* noop */ }
      }
    };
    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [villages, map]);
  return null;
}
