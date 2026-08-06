import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { findHits, indexFeatures, type Hit, type HitLayer } from '@/lib/map-hit';
import { LAYER_STYLES, labelOf, styleOf } from '@/lib/map-style';
import type { FeatureCollection } from '@/types/map';

// หน้าแผนที่ — ต้องถูก import แบบ dynamic({ ssr: false }) เท่านั้น เพราะ Leaflet
// แตะ window/document ตั้งแต่ตอนโหลดโมดูล
//
// ใช้ Leaflet ตรง ๆ ไม่ผ่าน react-leaflet: สิ่งที่หน้านี้ต้องทำคือ "สร้าง layer
// group แล้วเปิดปิด" ซึ่ง Leaflet API ทำได้ในไม่กี่บรรทัด ส่วน react-leaflet จะ
// พา lifecycle ของ React มาผูกกับ lifecycle ของแผนที่โดยไม่ได้อะไรกลับมา
//
// เลเยอร์ถูกโหลด "ตอนเปิดสวิตช์" ไม่ใช่ตอนเปิดหน้า — แปลงที่ดินหนัก ~4 MB
// (7,970 รูปทรง) ถ้าโหลดทุกเลเยอร์พร้อมกันตั้งแต่แรก หน้าจะค้างไปหลายวินาทีทั้งที่
// คนส่วนใหญ่เข้ามาดูแค่ขอบเขตหมู่

export type ViewerLayer = {
  id: string;
  title: string;
  featureCount: number;
  geojsonUrl: string;
};

/**
 * ระดับซูมลึกสุดที่ยอมให้ — เลือกไว้ที่ระดับที่แถบมาตราส่วนอ่านได้ว่า "100 m"
 *
 * ที่ละติจูดของน้ำแพร่ (~18.7°N) ระดับ 17 ให้ความละเอียด 1.13 เมตร/พิกเซล แถบ
 * มาตราส่วนกว้าง 100 พิกเซลจึงกินระยะ ~113 เมตร แล้ว Leaflet ปัดลงเป็น 100 เมตร
 * ส่วนระดับ 18 จะได้ 0.57 เมตร/พิกเซล ซึ่งปัดเป็น 50 เมตร — ลึกกว่าที่ต้องการ
 *
 * ต้องตั้งทั้งที่ตัวแผนที่และที่ tile layer ทุกตัว ไม่งั้นค่าที่ tile layer จะไป
 * ขยายเพดานของแผนที่กลับขึ้นมาเอง
 */
const MAX_ZOOM = 17;

// ภาพดาวเทียมของ Esri เปิดให้ใช้ฟรีโดยใส่เครดิต — ต่างจาก tile ของ Google ที่
// หน้า qgis2web เดิมดึงจาก mt1.google.com โดยตรงซึ่งผิดเงื่อนไขการใช้งาน
const BASEMAPS = {
  satellite: {
    label: 'ภาพดาวเทียม',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxZoom: MAX_ZOOM,
  },
  street: {
    label: 'แผนที่ถนน',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: MAX_ZOOM,
  },
} as const;

type BasemapKey = keyof typeof BASEMAPS;

const paneOf = (layerId: string) => `np-${layerId}`;


type LoadState = 'off' | 'loading' | 'on' | 'error';

export default function MapViewer({
  layers,
  center = [18.7257, 98.8662],
  zoom = 13,
}: {
  layers: ViewerLayer[];
  center?: [number, number];
  zoom?: number;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const base = useRef<L.TileLayer | null>(null);
  const groups = useRef<Map<string, L.GeoJSON>>(new Map());
  const hitIndex = useRef<Map<string, HitLayer>>(new Map());

  const [basemap, setBasemap] = useState<BasemapKey>('satellite');
  const [state, setState] = useState<Record<string, LoadState>>({});
  const [problem, setProblem] = useState<string | null>(null);

  // รัศมีการ "แตะโดน" บนหน้าจอ — นิ้วคนหนากว่าเส้นถนนหนึ่งพิกเซลมาก แปลงเป็น
  // องศาตามระดับซูมปัจจุบันทุกครั้ง เพื่อให้ความรู้สึกเท่ากันไม่ว่าซูมอยู่ระดับไหน
  const TOLERANCE_PX = 8;

  function handleClick(e: L.LeafletMouseEvent) {
    const m = map.current;
    if (!m) return;

    const p = m.latLngToContainerPoint(e.latlng);
    const edge = m.containerPointToLatLng(L.point(p.x + TOLERANCE_PX, p.y));
    const tolerance = Math.abs(edge.lng - e.latlng.lng);

    // ถามเฉพาะเลเยอร์ที่เปิดอยู่จริง — เลเยอร์ที่โหลดแล้วแต่ปิดสวิตช์ไว้ยังอยู่ใน
    // ดัชนี (เพื่อให้เปิดกลับมาได้ทันที) แต่ต้องไม่ตอบคลิก
    const active = [...hitIndex.current.values()].filter((l) => {
      const g = groups.current.get(l.layerId);
      return g ? m.hasLayer(g) : false;
    });

    const hits = findHits(active, e.latlng.lng, e.latlng.lat, tolerance);
    if (hits.length === 0) return;

    L.popup({ maxHeight: 340, maxWidth: 340 })
      .setLatLng(e.latlng)
      .setContent(popupHtml(hits))
      .openOn(m);
  }

  // สร้างแผนที่ครั้งเดียว
  useEffect(() => {
    if (!holder.current || map.current) return;
    const m = L.map(holder.current, {
      center,
      zoom,
      maxZoom: MAX_ZOOM,
      // canvas ไม่ใช่ svg: 7,970 รูปทรงบน svg = 7,970 DOM node ซึ่งทำให้เบราว์เซอร์
      // อืดตั้งแต่ตอน pan ยังไม่ทันคลิกอะไร
      preferCanvas: true,
      zoomControl: false,
    });
    L.control.zoom({ position: 'topright' }).addTo(m);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(m);

    // หนึ่ง pane ต่อหนึ่งเลเยอร์ พร้อม z-index ตายตัวตาม style.order
    //
    // ทำแบบนี้แทนการเรียก bringToFront()/bringToBack() หลังโหลดเสร็จ ด้วยสองเหตุผล:
    // ลำดับซ้อนไม่ขึ้นกับว่าเลเยอร์ไหนโหลดเสร็จก่อน (แปลงที่ดิน 4 MB มาทีหลังเสมอ
    // แต่ต้องอยู่ล่างสุดเสมอเช่นกัน) และ bringToFront() บนเลเยอร์ที่ใช้ canvas
    // renderer จะพังด้วย "Cannot read properties of undefined (reading 'min')"
    // เมื่อถูกเรียกก่อนที่ renderer จะคำนวณ bounds ของตัวเองเสร็จ
    for (const [id, style] of Object.entries(LAYER_STYLES)) {
      m.createPane(paneOf(id)).style.zIndex = String(410 + style.order);
    }
    m.on('click', handleClick);
    map.current = m;

    // เก็บ Map ตัวเดียวกันไว้ในตัวแปรของ effect นี้ ไม่อ่าน groups.current ตอน
    // cleanup: ref อาจถูกแทนที่ไปแล้วตอนที่ cleanup ทำงาน (React จะเตือนเรื่องนี้)
    const loaded = groups.current;
    return () => {
      m.remove();
      map.current = null;
      loaded.clear();
    };
    // ตั้งใจให้รันครั้งเดียว — center/zoom เป็นค่าเริ่มต้น ไม่ใช่ค่าที่ควบคุมแผนที่ต่อเนื่อง
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // สลับภาพพื้นหลัง
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (base.current) base.current.remove();
    const cfg = BASEMAPS[basemap];
    base.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
    }).addTo(m);
    // ภาพพื้นหลังต้องอยู่ล่างสุดเสมอ ไม่งั้นการสลับหลังจากเปิดเลเยอร์ไปแล้วจะเอา
    // ภาพดาวเทียมไปทับข้อมูลที่โหลดมาก่อนหน้าจนหายไปทั้งแผ่น
    base.current.bringToBack();
  }, [basemap]);

  // เปิดเลเยอร์ที่ตั้งไว้ว่าเปิดตั้งแต่แรก
  useEffect(() => {
    for (const layer of layers) {
      if (styleOf(layer.id).defaultOn) void toggle(layer, true);
    }
  }, [layers]);

  async function toggle(layer: ViewerLayer, on: boolean) {
    if (!map.current) return;

    const existing = groups.current.get(layer.id);
    if (!on) {
      if (existing) map.current.removeLayer(existing);
      setState((s) => ({ ...s, [layer.id]: 'off' }));
      return;
    }
    if (existing) {
      existing.addTo(map.current);
      setState((s) => ({ ...s, [layer.id]: 'on' }));
      return;
    }

    setState((s) => ({ ...s, [layer.id]: 'loading' }));
    setProblem(null);
    try {
      const res = await fetch(layer.geojsonUrl);
      if (!res.ok) throw new Error(`โหลดไม่สำเร็จ (${res.status})`);
      const fc = (await res.json()) as FeatureCollection;

      // อ่าน map.current ใหม่หลัง await เสมอ ห้ามใช้ค่าที่จับไว้ก่อนหน้า —
      // ไฟล์แปลงที่ดินใช้เวลาโหลดหลายวินาที ระหว่างนั้นผู้ใช้เปลี่ยนหน้าไปแล้วได้
      // (และ React StrictMode ตอน dev ก็ unmount/mount ซ้ำทันที) แผนที่ตัวเดิมถูก
      // remove() ไปแล้ว _panes ว่างเปล่า การ addTo แผนที่ที่ตายแล้วจะพังข้างใน
      // Leaflet ด้วย "Cannot read properties of undefined (reading 'appendChild')"
      const m = map.current;
      if (!m) return;

      const style = styleOf(layer.id);

      const pane = paneOf(layer.id);
      const group = L.geoJSON(fc as never, {
        // เลเยอร์ที่ไม่มีสไตล์ประจำตัวยังไม่มี pane — ปล่อยให้ Leaflet ใช้
        // overlayPane ปกติ ไม่ใช่ชี้ไป pane ที่ไม่มีอยู่จริงแล้วหายไปทั้งเลเยอร์
        //
        // ไม่ต้องส่ง renderer เอง: Map.getRenderer() ของ Leaflet สร้าง canvas
        // renderer ให้ pane ที่ไม่ใช่ overlayPane โดยอัตโนมัติ (_getPaneRenderer)
        pane: m.getPane(pane) ? pane : undefined,
        // ปิดระบบคลิกของ Leaflet ทั้งหมด — มันเลือกเลเยอร์บนสุดตาม z-index ตัวเดียว
        // ซึ่งคือขอบเขตหมู่ที่คลุมทั้งตำบล คลิกตรงไหนก็ได้แต่หมู่บ้าน การหาว่าอะไร
        // อยู่ใต้เคอร์เซอร์ทำเองที่ handleClick ด้านล่างแทน (src/lib/map-hit.ts)
        interactive: false,
        style: () => ({
          color: style.color,
          weight: style.weight,
          fillColor: style.fillColor ?? style.color,
          fillOpacity: style.fillOpacity,
        }),
      });
      group.addTo(m);
      groups.current.set(layer.id, group);
      // ดัชนีกรอบล้อมของทุก feature — คิดครั้งเดียวตอนโหลด ไม่ใช่ทุกครั้งที่คลิก
      hitIndex.current.set(layer.id, {
        layerId: layer.id,
        title: layer.title,
        order: style.order,
        features: indexFeatures(fc),
      });
      setState((s) => ({ ...s, [layer.id]: 'on' }));
    } catch (err) {
      // แถบบนหน้าบอกผู้ใช้ว่าเลเยอร์ไหนไม่ขึ้น ส่วน console เก็บ stack ไว้ให้คน
      // ที่ต้องตามแก้ — ข้อความอย่างเดียวไม่พอเวลาเป็น error จากข้างใน Leaflet
      console.error(`MapViewer: โหลดเลเยอร์ ${layer.id} ไม่สำเร็จ`, err);
      setState((s) => ({ ...s, [layer.id]: 'error' }));
      setProblem(`${layer.title}: ${(err as Error).message}`);
    }
  }

  return (
    <div className="relative h-full w-full">
      <div ref={holder} className="h-full w-full" />

      <div className="pointer-events-none absolute top-3 left-3 z-1000 flex max-w-[calc(100%-1.5rem)] flex-col gap-2">
        <div className="pointer-events-auto rounded-xl border border-black/10 bg-white/95 p-3 shadow-lg backdrop-blur">
          <p className="mb-2 font-display text-[12px] font-semibold text-ink">ชั้นข้อมูล</p>
          <ul className="space-y-1.5">
            {layers.map((layer) => {
              const st = state[layer.id] ?? 'off';
              const style = styleOf(layer.id);
              return (
                <li key={layer.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-soft">
                    <input
                      type="checkbox"
                      checked={st === 'on' || st === 'loading'}
                      disabled={st === 'loading'}
                      onChange={(e) => void toggle(layer, e.target.checked)}
                      className="h-3.5 w-3.5 accent-green"
                    />
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-sm border"
                      style={{
                        borderColor: style.color,
                        backgroundColor: style.fillOpacity
                          ? (style.fillColor ?? style.color)
                          : 'transparent',
                        opacity: style.fillOpacity ? 0.6 : 1,
                      }}
                    />
                    <span className="whitespace-nowrap">{layer.title}</span>
                    <span className="text-[10.5px] text-ink-mute">
                      {st === 'loading'
                        ? 'กำลังโหลด…'
                        : st === 'error'
                          ? 'โหลดไม่ได้'
                          : layer.featureCount.toLocaleString('th-TH')}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="mt-2.5 border-t border-black/[0.07] pt-2.5">
            <div className="flex gap-1">
              {(Object.keys(BASEMAPS) as BasemapKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBasemap(key)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-medium transition ${
                    basemap === key
                      ? 'bg-green-050 text-green-deep'
                      : 'text-ink-faint hover:bg-black/[0.04]'
                  }`}
                >
                  {BASEMAPS[key].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {problem ? (
          <p className="pointer-events-auto rounded-lg bg-red-50 px-3 py-2 text-[11.5px] text-red-700 shadow">
            {problem}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ป๊อปอัปเดียวที่รวมทุกอย่างใต้จุดที่คลิก เรียงจากละเอียดที่สุดลงไป — แปลงที่ดิน
// ก่อน แล้วค่อยอาคาร ถนน แล้วจบที่หมู่บ้าน เหมือนเครื่องมือ identify ของ QGIS
function popupHtml(hits: Hit[]): string {
  const blocks: string[] = [];
  let current = '';
  for (const hit of hits) {
    if (hit.layerId !== current) {
      current = hit.layerId;
      blocks.push(`<p class="np-popup-title">${escapeHtml(hit.title)}</p>`);
    }
    const rows = Object.entries(hit.feature.properties ?? {}).filter(
      ([, v]) => v !== null && v !== undefined && v !== ''
    );
    blocks.push(
      rows.length === 0
        ? '<p class="np-popup-empty">ไม่มีข้อมูลประกอบ</p>'
        : `<table>${rows
            .map(
              ([k, v]) =>
                `<tr><th>${escapeHtml(labelOf(k))}</th><td>${escapeHtml(String(v))}</td></tr>`
            )
            .join('')}</table>`
    );
  }
  return `<div class="np-popup">${blocks.join('')}</div>`;
}

// ค่าที่มาจากไฟล์ที่เจ้าหน้าที่อัปเองไปโผล่ใน innerHTML ของป๊อปอัป — Leaflet ไม่
// escape ให้ ชื่อหมู่บ้านที่มี < หรือ & จึงทำให้ป๊อปอัปเพี้ยนได้เป็นอย่างน้อย
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
