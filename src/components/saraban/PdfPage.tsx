// pdf.js หนึ่งหน้าลง canvas (สเปกรอบ 4 ข้อ 4) — import ผ่าน next/dynamic({ ssr: false }) เท่านั้น
// เพราะ pdfjs-dist แตะ DOM/worker ตั้งแต่ตอนโหลดโมดูล · ไฟล์มาจาก ?raw=1 ของเราเอง (same-origin, cookie ติดไปเอง)
import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export type PdfInfo = { pages: number; aspect: number }; // aspect = สูง/กว้าง ของหน้าปัจจุบัน

export default function PdfPage({
  url,
  page,
  width,
  onInfo,
  onError,
}: {
  url: string;
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
    const task = getDocument({ url, disableRange: true, disableStream: true });
    task.promise.then(
      (doc) => alive && setPdf(doc),
      (err: { status?: number }) => alive && cb.current.onError(err?.status)
    );
    return () => {
      alive = false;
      setPdf(null);
      void task.destroy();
    };
  }, [url]);

  useEffect(() => {
    if (!pdf || width <= 0) return;
    let alive = true;
    let render: RenderTask | undefined;
    pdf.getPage(page).then(
      (p) => {
        const el = canvas.current;
        if (!alive || !el) return;
        const base = p.getViewport({ scale: 1 });
        cb.current.onInfo({ pages: pdf.numPages, aspect: base.height / base.width });
        const dpr = window.devicePixelRatio || 1;
        const viewport = p.getViewport({ scale: (width / base.width) * dpr });
        el.width = Math.floor(viewport.width);
        el.height = Math.floor(viewport.height);
        render = p.render({ canvas: el, viewport });
        render.promise.catch(() => {}); // ถูกยกเลิกตอนเปลี่ยนหน้า/ขนาด — ไม่ใช่ error
      },
      () => alive && cb.current.onError()
    );
    return () => {
      alive = false;
      render?.cancel();
    };
  }, [pdf, page, width]);

  return <canvas ref={canvas} className="absolute inset-0 block h-full w-full" />;
}
