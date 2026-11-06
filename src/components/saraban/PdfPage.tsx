// pdf.js หนึ่งหน้าลง canvas (สเปกรอบ 4 ข้อ 4) — import ผ่าน next/dynamic({ ssr: false }) เท่านั้น
// เพราะ pdfjs-dist แตะ DOM/worker ตั้งแต่ตอนโหลดโมดูล · ไฟล์มาจาก ?raw=1 ของเราเอง (same-origin, cookie ติดไปเอง)
import { useEffect, useRef, useState } from 'react';
// ใช้ legacy build: เครื่องในสำนักงานและ iPad รุ่นเก่ามักเป็นเบราว์เซอร์ที่ build ปกติของ pdf.js 6 ไม่รองรับ
// (build ปกติเล็งเฉพาะเบราว์เซอร์รุ่นล่าสุด) · ชนิดข้อมูลของ legacy re-export จาก "pdfjs-dist" เหมือนกัน
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();

// ไฟล์ประกอบที่ scripts/copy-pdfjs-assets.mjs คัดไว้ใน public/pdfjs/ (postinstall) — ถ้าไม่ส่ง
// หนังสือที่เป็นภาพสแกน (JBIG2/CCITT/JPX ถอดด้วย wasm) โปรไฟล์สี ICC ฟอนต์มาตรฐาน และ CMap จะขึ้นหน้าว่าง
const ASSETS = {
  wasmUrl: '/pdfjs/wasm/',
  iccUrl: '/pdfjs/iccs/',
  cMapUrl: '/pdfjs/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/pdfjs/standard_fonts/',
} as const;

export type PdfInfo = { pages: number; aspect: number }; // aspect = สูง/กว้าง ของหน้าปัจจุบัน

// ผู้เรียกต้องใส่ key={fileId} — เปลี่ยนไฟล์ = ทิ้ง component เดิมทั้งก้อน ไม่มีเอกสารเก่าค้างระหว่างโหลดไฟล์ใหม่
export default function PdfPage({
  url,
  name,
  page,
  width,
  onInfo,
  onError,
}: {
  url: string;
  name: string; // ชื่อไฟล์ — ใช้เป็นชื่อเรียกของ canvas ให้โปรแกรมอ่านหน้าจอ
  page: number;
  width: number; // px ของกล่องกระดาษ — 0 = ยังวัดไม่ได้
  onInfo: (info: PdfInfo) => void;
  onError: (status?: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  // callback ล่าสุดโดยไม่ต้องใส่ใน deps — กันโหลด PDF ใหม่ทุกครั้งที่ผู้เรียก re-render
  const cb = useRef({ onInfo, onError });
  useEffect(() => {
    cb.current = { onInfo, onError };
  });

  useEffect(() => {
    let alive = true;
    // route ไม่รองรับ Range — โหลดทั้งไฟล์ครั้งเดียว (≤ 10MB)
    const task = getDocument({ url, disableRange: true, disableStream: true, ...ASSETS });
    task.promise.then(
      (doc) => alive && setPdf(doc),
      (err: { status?: number }) => alive && cb.current.onError(err?.status)
    );
    return () => {
      alive = false;
      void task.destroy();
    };
  }, [url]);

  useEffect(() => {
    if (!pdf || width <= 0) return;
    let alive = true;
    let render: RenderTask | undefined;
    pdf
      .getPage(page)
      .then((p) => {
        const el = canvas.current;
        if (!alive || !el) return;
        const base = p.getViewport({ scale: 1 });
        cb.current.onInfo({ pages: pdf.numPages, aspect: base.height / base.width });
        const dpr = window.devicePixelRatio || 1;
        const viewport = p.getViewport({ scale: (width / base.width) * dpr });
        el.width = Math.floor(viewport.width);
        el.height = Math.floor(viewport.height);
        render = p.render({ canvas: el, viewport });
        render.promise.catch((err: { name?: string }) => {
          // ถูกยกเลิกตอนเปลี่ยนหน้า/ขนาด — ไม่ใช่ error · อย่างอื่น (ไฟล์เสียกลางเล่ม ฯลฯ) แจ้งผู้ใช้
          if (err?.name !== 'RenderingCancelledException' && alive) cb.current.onError();
        });
      })
      // .catch แทนตัวที่สองของ then — รับทั้ง getPage ล้มและ render() ที่โยนตรง ๆ ในตัวแรก
      .catch(() => alive && cb.current.onError());
    return () => {
      alive = false;
      render?.cancel();
    };
  }, [pdf, page, width]);

  return <canvas ref={canvas} role="img" aria-label={`${name} หน้า ${page}`} className="absolute inset-0 block h-full w-full" />;
}
