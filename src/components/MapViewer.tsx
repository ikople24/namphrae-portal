import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { findHits, indexFeatures, type Hit, type HitLayer } from '@/lib/map-hit';
import {
  buildColorGroups,
  COLOR_BY,
  HOVER_STYLE,
  LAYER_STYLES,
  labelOf,
  styleOf,
} from '@/lib/map-style';
import type { Feature, FeatureCollection } from '@/types/map';

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
// pane ของเส้นไฮไลต์ตอนชี้ — ต้องอยู่เหนือทุกเลเยอร์ ไม่งั้นชี้แปลงที่ดินแล้วเส้น
// เหลืองไปโผล่ใต้ขอบเขตหมู่จนมองไม่เห็นว่ากำลังจะเลือกอะไร
const HOVER_PANE = 'np-hover';


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
  // ค่า → สี ของแต่ละเลเยอร์ คิดครั้งเดียวตอนโหลด (ดู COLOR_BY ใน map-style.ts
  // ว่าทำไมต้องแยกตารางสีต่อเลเยอร์ ห้ามใช้ร่วมกัน)
  const colorGroups = useRef<Map<string, Map<string, string>>>(new Map());
  const highlight = useRef<L.GeoJSON | null>(null);
  const hovered = useRef<Feature | null>(null);
  const lastMove = useRef(0);

  const [basemap, setBasemap] = useState<BasemapKey>('satellite');
  const [state, setState] = useState<Record<string, LoadState>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [grouped, setGrouped] = useState(false);

  // เงาของ state ไว้ให้ callback ที่ถูกผูกกับแผนที่ตั้งแต่ตอนสร้าง (mousemove,
  // click) และ toggle() ที่ถูกเรียกจาก effect อ่านค่าล่าสุดได้ — closure ของ
  // render แรกจะเห็น grouped เป็น false ตลอดไปถ้าอ่านจาก state ตรง ๆ
  const groupedRef = useRef(grouped);
  groupedRef.current = grouped;

  // รัศมีการ "แตะโดน" บนหน้าจอ — นิ้วคนหนากว่าเส้นถนนหนึ่งพิกเซลมาก แปลงเป็น
  // องศาตามระดับซูมปัจจุบันทุกครั้ง เพื่อให้ความรู้สึกเท่ากันไม่ว่าซูมอยู่ระดับไหน
  const TOLERANCE_PX = 8;
  // ไม่คิดใหม่ถี่กว่านี้ — mousemove ยิงได้เป็นร้อยครั้งต่อวินาที ส่วนการไล่หา
  // ในแปลงที่ดิน 7,970 รูปกินเวลาพอสมควรแม้จะตัดด้วยกรอบล้อมก่อนแล้ว
  const MOVE_THROTTLE_MS = 45;

  /** เลเยอร์ที่เปิดสวิตช์อยู่จริง — ที่โหลดแล้วแต่ปิดไว้ต้องไม่ตอบทั้งคลิกและ hover */
  function activeHitLayers(m: L.Map): HitLayer[] {
    return [...hitIndex.current.values()].filter((l) => {
      const g = groups.current.get(l.layerId);
      return g ? m.hasLayer(g) : false;
    });
  }

  function toleranceAt(m: L.Map, latlng: L.LatLng): number {
    const p = m.latLngToContainerPoint(latlng);
    const edge = m.containerPointToLatLng(L.point(p.x + TOLERANCE_PX, p.y));
    return Math.abs(edge.lng - latlng.lng);
  }

  function handleClick(e: L.LeafletMouseEvent) {
    const m = map.current;
    if (!m) return;
    const hits = findHits(
      activeHitLayers(m),
      e.latlng.lng,
      e.latlng.lat,
      toleranceAt(m, e.latlng)
    );
    if (hits.length === 0) return;

    L.popup({ maxHeight: 340, maxWidth: 340 })
      .setLatLng(e.latlng)
      .setContent(popupHtml(hits))
      .openOn(m);
  }

  // ชี้แล้วเน้นสิ่งที่กำลังจะถูกเลือก — ใช้ตัวหาการชนตัวเดียวกับคลิก สิ่งที่เห็น
  // ตอนชี้จึงเป็นสิ่งเดียวกับที่ได้ตอนคลิกเสมอ ไม่ใช่คนละตรรกะที่เพี้ยนจากกันได้
  function handleMove(e: L.LeafletMouseEvent) {
    const m = map.current;
    if (!m) return;
    const now = e.originalEvent.timeStamp || performance.now();
    if (now - lastMove.current < MOVE_THROTTLE_MS) return;
    lastMove.current = now;

    const hits = findHits(
      activeHitLayers(m),
      e.latlng.lng,
      e.latlng.lat,
      toleranceAt(m, e.latlng),
      1
    );
    setHovered(hits[0]?.feature ?? null);
  }

  function setHovered(feature: Feature | null) {
    // เทียบด้วย reference ได้เพราะทุก feature มาจากก้อน GeoJSON ที่ parse ครั้งเดียว
    // ตอนโหลดเลเยอร์ — วาดใหม่ทุกเฟรมที่เมาส์ขยับจะกินแรงเปล่าโดยไม่เปลี่ยนอะไร
    if (hovered.current === feature) return;
    hovered.current = feature;

    const layer = highlight.current;
    const m = map.current;
    if (!layer || !m) return;

    layer.clearLayers();
    if (feature) layer.addData(feature as never);
    // เปลี่ยนเคอร์เซอร์ให้รู้ว่าคลิกได้ — ทุกเลเยอร์ถูกตั้ง interactive: false ไว้
    // Leaflet จึงไม่เปลี่ยนเคอร์เซอร์ให้เองเหมือนตอนใช้ระบบคลิกของมัน
    m.getContainer().style.cursor = feature ? 'pointer' : '';
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
    m.createPane(HOVER_PANE).style.zIndex = '500';
    highlight.current = L.geoJSON(undefined, {
      pane: HOVER_PANE,
      interactive: false,
      style: () => HOVER_STYLE,
    }).addTo(m);

    m.on('click', handleClick);
    m.on('mousemove', handleMove);
    // ออกนอกแผนที่แล้วต้องล้างไฮไลต์ ไม่งั้นเส้นเหลืองค้างอยู่บนของที่ไม่ได้ชี้แล้ว
    m.on('mouseout', () => setHovered(null));
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

  // เปิดเลเยอร์ที่ตั้งไว้ว่าเปิดตั้งแต่แรก — ครั้งเดียวต่อชุดเลเยอร์เท่านั้น
  //
  // ไม่ใส่ toggle เป็น dependency โดยตั้งใจ: มันถูกสร้างใหม่ทุก render ถ้าใส่ไป
  // effect จะรันซ้ำทุกครั้งที่ state เปลี่ยน แล้วยิง fetch ไฟล์ 4 MB ใหม่ทุกรอบ
  // (toggle อ่านทุกอย่างผ่าน ref อยู่แล้ว ตัวที่ถูกจับไว้จึงไม่เคยเก่า)
  useEffect(() => {
    for (const layer of layers) {
      if (styleOf(layer.id).defaultOn) void toggle(layer, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers]);

  /** สไตล์ของหนึ่ง feature — เปลี่ยนตามว่ากำลังเปิดโหมดแยกสีตามกลุ่มอยู่หรือไม่ */
  function styleFor(layerId: string, feature?: Feature): L.PathOptions {
    const style = styleOf(layerId);
    const plain = {
      color: style.color,
      weight: style.weight,
      fillColor: style.fillColor ?? style.color,
      fillOpacity: style.fillOpacity,
    };
    if (!groupedRef.current) return plain;

    const field = COLOR_BY[layerId];
    const color = field
      ? colorGroups.current.get(layerId)?.get(String(feature?.properties?.[field] ?? ''))
      : undefined;
    if (!color) return plain;

    return {
      color,
      weight: style.weight,
      fillColor: color,
      // ต้องมีพื้นถึงจะเห็นเป็น "กลุ่มพื้นที่" ได้ ขอบเขตหมู่ปกติไม่มีพื้นเลย
      // (fillOpacity 0) แต่จาง ๆ พอ ไม่งั้นบังภาพดาวเทียมที่คนกำลังเทียบอยู่
      fillOpacity: Math.max(style.fillOpacity, 0.25),
    };
  }

  // ทาสีใหม่ทั้งหมดเมื่อสลับโหมด — setStyle ของ L.GeoJSON รับฟังก์ชันได้ และจะ
  // เรียกทีละ feature ให้เอง จึงไม่ต้องสร้างเลเยอร์ใหม่หรือโหลดไฟล์ซ้ำ
  useEffect(() => {
    for (const [layerId, group] of groups.current) {
      group.setStyle((f) => styleFor(layerId, f as Feature | undefined));
    }
  }, [grouped]);

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

      // ตารางสีของเลเยอร์นี้ — ไล่จากค่าที่มีอยู่จริงในไฟล์ ไม่ใช่รายการที่เดาไว้
      // ล่วงหน้า เพราะโซนของแปลงที่ดินมีค่าที่ไม่มีใครรู้ล่วงหน้าปนอยู่ (0E, 167)
      const field = COLOR_BY[layer.id];
      if (field) {
        const values = fc.features
          .map((f) => f.properties?.[field])
          .filter((v): v is string | number => v !== null && v !== undefined && v !== '')
          .map(String);
        colorGroups.current.set(layer.id, buildColorGroups(values));
      }

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
        style: (f) => styleFor(layer.id, f as Feature | undefined),
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
        {/* จำกัดความกว้างไว้ ไม่งั้นคำอธิบายสี 11 หมู่จะยืดแถบจนกินครึ่งจอ */}
        <div className="pointer-events-auto w-65.5 max-w-full rounded-xl border border-black/10 bg-white/95 p-3 shadow-lg backdrop-blur">
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
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-soft">
              <input
                type="checkbox"
                checked={grouped}
                onChange={(e) => setGrouped(e.target.checked)}
                className="h-3.5 w-3.5 accent-green"
              />
              แยกสีตามโซน
            </label>

            {grouped ? (
              <div className="mt-2 space-y-2">
                {layers
                  .filter(
                    (l) =>
                      COLOR_BY[l.id] &&
                      (state[l.id] ?? 'off') === 'on' &&
                      colorGroups.current.get(l.id)?.size
                  )
                  .map((l) => (
                    <div key={l.id}>
                      <p className="text-[10.5px] font-semibold text-ink-mute">
                        {l.title} · {labelOf(COLOR_BY[l.id])}
                      </p>
                      <ul className="mt-1 flex flex-wrap gap-x-2.5 gap-y-1">
                        {[...colorGroups.current.get(l.id)!].map(([value, color]) => (
                          <li
                            key={value}
                            className="flex items-center gap-1 text-[10.5px] text-ink-soft"
                          >
                            <span
                              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                              style={{ backgroundColor: color }}
                            />
                            {value}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                {/* เตือนไว้ตรงนี้เพราะสองเลเยอร์ใช้ชื่อฟิลด์ zone_id เหมือนกันแต่
                    คนละระบบเลข — ถ้าไม่บอก คนอ่านจะนึกว่าโซน 04 คือหมู่ 4 */}
                {layers.some((l) => l.id === 'parcel' && (state[l.id] ?? 'off') === 'on') &&
                layers.some(
                  (l) => l.id === 'zone-moobang' && (state[l.id] ?? 'off') === 'on'
                ) ? (
                  <p className="text-[10px] leading-snug text-ink-mute">
                    โซนของแปลงที่ดินเป็นเลขงานรังวัด คนละระบบกับหมู่บ้าน
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

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
