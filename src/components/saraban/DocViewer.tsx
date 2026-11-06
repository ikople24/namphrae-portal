// ตัวดูเอกสาร (สเปกรอบ 4 ข้อ 4 · ต้นแบบจอ 5 / B) — เลือกไฟล์ · หน้า · ชั้นตรา/ลายมือ
// ชั้นล่าง: ของทุกการเกษียนที่ผ่านมา (อ่านอย่างเดียว) · ชั้นบน: ร่างของผู้ใช้ตอนนี้ (draft — หน้าเป็นเจ้าของ state)
// พิกัดเป็นสัดส่วน 0–1 ของกล่องกระดาษ กล่องสูงตามสัดส่วนหน้าจริง ตรา/ลายมือจึงอยู่ที่เดิมทุกขนาดจอ
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import Icon from '@/components/Icon';
import type { PdfInfo } from '@/components/saraban/PdfPage';
import { STAMP_COLORS, STAMP_LABELS } from '@/lib/saraban-labels';
import { marksOn, maxPageOf } from '@/lib/saraban-mark';
import { addStamp, appendStroke, canAddStamp, clearInk, dragTo, moveStamp, removeMark, strokePoints, toUnit } from '@/lib/saraban-viewer';
import { errorMessage } from '@/lib/saraban-view';
import { STAMP_KINDS, type SarabanEvent, type SarabanFile, type SarabanMark, type StampMark } from '@/types/saraban';

const PdfPage = dynamic(() => import('@/components/saraban/PdfPage'), {
  ssr: false,
  loading: () => <p className="absolute inset-0 flex items-center justify-center text-[13px] text-sb-muted">กำลังเปิดเอกสาร…</p>,
});

export type ViewerTools = 'none' | 'stamp' | 'stamp+ink';

const A4 = 297 / 210;

export default function DocViewer({
  files,
  events,
  rawUrl,
  openUrl,
  tools,
  draft,
  onDraftChange,
}: {
  files: SarabanFile[];
  events: SarabanEvent[];
  rawUrl: (fileId: string) => string; // ?raw=1 (same-origin)
  openUrl: (fileId: string) => string; // 302 เปิดแท็บใหม่
  tools: ViewerTools;
  draft: SarabanMark[];
  onDraftChange: (draft: SarabanMark[]) => void;
}) {
  const [rawFileId, setFileId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [info, setInfo] = useState<PdfInfo | null>(null);
  const [imgAspect, setImgAspect] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [pen, setPen] = useState(false);
  // เส้นที่กำลังวาด: ref เป็นตัวจริง (pointermove ถี่กว่ารอบ render — อ่านจาก state จะทำจุดหาย) · state ไว้แสดงผล
  const [stroke, setStroke] = useState<number[] | null>(null);
  const strokeRef = useRef<number[] | null>(null);
  const penPointer = useRef<number | null>(null); // นิ้ว/ปากกาที่กำลังวาด — นิ้วอื่นไม่นับ
  const [width, setWidth] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  // ตราที่กำลังลาก + ระยะจากจุดที่จับถึงกึ่งกลางตรา (หน่วยสัดส่วน) — ตราไม่กระโดดมาที่นิ้ว
  const drag = useRef<{ index: number; grab: { x: number; y: number } } | null>(null);

  const file = files.find((f) => f.id === rawFileId) ?? files[0];

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [file?.id]);

  if (!file) {
    return <div className="flex min-h-[200px] items-center justify-center text-[13px] text-sb-muted">ไม่มีไฟล์แนบ</div>;
  }

  const isPdf = file.format === 'pdf';
  const pages = isPdf ? (info?.pages ?? (file.pages || 1)) : 1;
  const aspect = (isPdf ? info?.aspect : imgAspect) ?? A4;
  const at = { fileId: file.id, page };
  const past = marksOn(events, file.id, page);
  const mine = draft.map((m, index) => ({ m, index })).filter(({ m }) => m.fileId === file.id && m.page === page);
  const canStamp = tools !== 'none';
  const canInk = tools === 'stamp+ink';
  // ปากกาทำงานจริงเมื่อเปิดอยู่และหน้านี้อนุญาตลายมือ — กันปากกาค้างเมื่อ tools เปลี่ยน
  const penOn = pen && canInk;

  function pick(id: string) {
    endStroke();
    setFileId(id);
    setPage(1);
    setInfo(null);
    setImgAspect(null);
    setFailed(null);
  }

  function unitOf(e: ReactPointerEvent) {
    return toUnit(e.clientX, e.clientY, box.current!.getBoundingClientRect());
  }

  // ---- ปากกา ----
  function endStroke(): number[] | null {
    const s = strokeRef.current;
    strokeRef.current = null;
    penPointer.current = null;
    setStroke(null);
    return s;
  }
  function penDown(e: ReactPointerEvent<SVGSVGElement>) {
    // นิ้วที่สอง (ไม่ใช่ primary) ไม่นับ · นิ้ว primary ใหม่เริ่มเส้นใหม่เสมอ — เส้นที่ค้างเพราะ tools/ปากกาถูกปิด
    // กลางเส้น (handler ถูกถอด ไม่มี cancel มาล้าง) จึงไม่ทำให้ปากกาตาย
    if (!e.isPrimary) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    penPointer.current = e.pointerId;
    const p = unitOf(e);
    strokeRef.current = [p.x, p.y];
    setStroke(strokeRef.current);
  }
  function penMove(e: ReactPointerEvent<SVGSVGElement>) {
    const cur = strokeRef.current;
    if (e.pointerId !== penPointer.current || !cur) return;
    const p = unitOf(e);
    // ข้ามจุดที่ชิดกันเกินไป — ประหยัดงบ 5,000 จุด
    if (Math.hypot(p.x - cur[cur.length - 2], p.y - cur[cur.length - 1]) < 0.002) return;
    strokeRef.current = [...cur, p.x, p.y];
    setStroke(strokeRef.current);
  }
  function penUp(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.pointerId !== penPointer.current) return;
    const s = endStroke();
    if (s) onDraftChange(appendStroke(draft, at, s));
  }
  function penCancel(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.pointerId !== penPointer.current) return;
    endStroke(); // ระบบยกเลิก/เสีย capture ก่อนยก (เช่นเลื่อนจอ สายเรียกเข้า) — ทิ้งเส้น ไม่บันทึกครึ่ง ๆ
  }

  // ---- ลากตราในร่าง ----
  function stampDown(e: ReactPointerEvent<HTMLDivElement>, index: number, mark: StampMark) {
    if (penOn) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = unitOf(e);
    drag.current = { index, grab: { x: p.x - mark.x, y: p.y - mark.y } };
  }
  function stampMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    onDraftChange(moveStamp(draft, d.index, dragTo(unitOf(e), d.grab)));
  }
  function stampEnd() {
    drag.current = null;
  }

  const chipOn = 'bg-sb-accent text-white';
  const chipOff = 'bg-white hover:bg-sb-hover';

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-sb-line bg-sb-panel px-4 py-2.5">
        <Icon name="description" size={18} className="text-sb-muted" />
        {files.length > 1
          ? files.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => pick(f.id)}
                aria-pressed={f.id === file.id}
                title={f.name}
                className={`max-w-[200px] truncate rounded-lg px-2.5 py-1 text-xs ${f.id === file.id ? chipOn : chipOff}`}
              >
                {f.name}
              </button>
            ))
          : <span className="max-w-[240px] truncate text-xs">{file.name}</span>}
        {pages > 1 ? (
          <span className="flex items-center gap-1 text-xs">
            <button type="button" aria-label="หน้าก่อน" disabled={page <= 1} onClick={() => { endStroke(); setPage(page - 1); }} className="rounded p-1 hover:bg-sb-hover disabled:opacity-40">
              <Icon name="chevron_left" size={18} />
            </button>
            หน้า {page}/{pages}
            <button type="button" aria-label="หน้าถัดไป" disabled={page >= pages} onClick={() => { endStroke(); setPage(page + 1); }} className="rounded p-1 hover:bg-sb-hover disabled:opacity-40">
              <Icon name="chevron_right" size={18} />
            </button>
          </span>
        ) : null}
        <a href={openUrl(file.id)} target="_blank" rel="noopener" className="ml-auto flex items-center gap-1 text-xs text-sb-accent hover:underline">
          <Icon name="open_in_new" size={16} />
          เปิดในแท็บใหม่
        </a>
      </div>

      {canStamp ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-sb-line px-4 py-2" role="toolbar" aria-label="เครื่องมือตรา/ลายมือ">
          {STAMP_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              disabled={!canAddStamp(draft) || page > maxPageOf(file)}
              onClick={() => onDraftChange(addStamp(draft, at, k))}
              aria-label={`วางตรา ${STAMP_LABELS[k]}`}
              className="h-9 rounded-lg border-2 bg-white px-3 text-xs font-bold disabled:opacity-40"
              style={{ color: STAMP_COLORS[k], borderColor: STAMP_COLORS[k] }}
            >
              {STAMP_LABELS[k]}
            </button>
          ))}
          {canInk ? (
            <>
              <span className="mx-1 h-6 w-px bg-sb-line" aria-hidden />
              <button type="button" aria-pressed={penOn} onClick={() => { endStroke(); setPen(!penOn); }} className={`flex h-9 items-center gap-1 rounded-lg px-3 text-xs ${penOn ? chipOn : `border border-sb-line ${chipOff}`}`}>
                <Icon name="edit" size={16} />
                ปากกา
              </button>
              <button type="button" disabled={!draft.some((m) => m.type === 'ink')} onClick={() => onDraftChange(clearInk(draft))} className="flex h-9 items-center gap-1 rounded-lg border border-sb-line bg-white px-3 text-xs disabled:opacity-40">
                <Icon name="delete" size={16} />
                ล้างลายมือ
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="bg-[#E9EDF2] p-3">
        <div
          ref={box}
          className="relative w-full overflow-hidden bg-white shadow-sm [container-type:inline-size]"
          style={{ aspectRatio: `1 / ${aspect}` }}
        >
          {failed ? (
            <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-[13px] text-sb-muted">{failed}</p>
          ) : isPdf ? (
            <PdfPage
              key={file.id}
              url={rawUrl(file.id)}
              name={file.name}
              page={page}
              width={width}
              onInfo={setInfo}
              onError={(status) => setFailed(status === 503 ? errorMessage('storage_not_configured') : 'เปิดไฟล์ไม่ได้ ลองเปิดในแท็บใหม่')}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- ไฟล์ราชการผ่าน route ตรวจสิทธิ์ ไม่ผ่าน next/image
            <img
              key={file.id}
              src={rawUrl(file.id)}
              alt={file.name}
              onLoad={(e) => setImgAspect(e.currentTarget.naturalHeight / e.currentTarget.naturalWidth)}
              onError={() => setFailed('เปิดไฟล์ไม่ได้ ลองเปิดในแท็บใหม่')}
              className="absolute inset-0 h-full w-full object-contain"
            />
          )}

          <svg
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            style={{ pointerEvents: penOn ? 'auto' : 'none', touchAction: penOn ? 'none' : 'auto', cursor: penOn ? 'crosshair' : undefined }}
            onPointerDown={penOn ? penDown : undefined}
            onPointerMove={penOn ? penMove : undefined}
            onPointerUp={penOn ? penUp : undefined}
            onPointerCancel={penOn ? penCancel : undefined}
            onLostPointerCapture={penOn ? penCancel : undefined}
          >
            {[...past, ...mine.map(({ m }) => m)].flatMap((m, i) =>
              m.type === 'ink'
                ? m.strokes.map((s, j) => <Line key={`${i}-${j}`} points={strokePoints(s)} />)
                : []
            )}
            {stroke ? <Line points={strokePoints(stroke)} /> : null}
          </svg>

          {past.map((m, i) => (m.type === 'stamp' ? <Stamp key={`p${i}`} mark={m} /> : null))}
          {mine.map(({ m, index }) =>
            m.type === 'stamp' ? (
              <Stamp
                key={`d${index}`}
                mark={m}
                // tools = none (เช่น refetch แล้วไม่ใช่ผู้ถือหนังสือแล้ว) — ร่างแสดงอย่างเดียว ลาก/เอาออกไม่ได้
                draft={canStamp ? {
                  pen: penOn,
                  onPointerDown: (e) => stampDown(e, index, m),
                  onPointerMove: stampMove,
                  onPointerEnd: stampEnd,
                  onRemove: () => onDraftChange(removeMark(draft, index)),
                } : undefined}
              />
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}

function Line({ points }: { points: string }) {
  return (
    <polyline
      points={points}
      fill="none"
      stroke="#1E2A4A"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  );
}

function Stamp({
  mark,
  draft,
}: {
  mark: StampMark;
  draft?: {
    pen: boolean;
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerEnd: () => void; // up / cancel / เสีย capture — เลิกลาก
    onRemove: () => void;
  };
}) {
  const color = STAMP_COLORS[mark.stamp];
  return (
    <div
      className={`absolute select-none whitespace-nowrap rounded-md border-2 bg-white/60 px-[0.6em] py-[0.15em] font-bold ${draft && !draft.pen ? 'cursor-move touch-none ring-2 ring-sb-accent/40' : 'pointer-events-none'}`}
      style={{
        left: `${mark.x * 100}%`,
        top: `${mark.y * 100}%`,
        transform: `translate(-50%, -50%) rotate(${mark.rot}deg)`,
        color,
        borderColor: color,
        fontSize: 'clamp(10px, 3.2cqw, 22px)',
      }}
      onPointerDown={draft?.onPointerDown}
      onPointerMove={draft?.onPointerMove}
      onPointerUp={draft?.onPointerEnd}
      onPointerCancel={draft?.onPointerEnd}
      onLostPointerCapture={draft?.onPointerEnd}
    >
      {STAMP_LABELS[mark.stamp]}
      {draft && !draft.pen ? (
        <button
          type="button"
          aria-label={`เอาตรา ${STAMP_LABELS[mark.stamp]} ออก`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={draft.onRemove}
          className="absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-sb-danger text-white"
        >
          <Icon name="close" size={14} />
        </button>
      ) : null}
    </div>
  );
}
