// toast ของระบบสารบรรณ (handoff: ล่างกลาง หายใน 2.6 วินาที)
// flashToast(): ข้อความที่ต้องโชว์ "หลังเปลี่ยนหน้า" (ลงรับเสร็จ → ไปทะเบียน) — Pages Router remount
// layout ทุกหน้า state ใน component จึงหาย ตัวแปรระดับโมดูลอยู่รอดการเปลี่ยนหน้าฝั่งเบราว์เซอร์
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

let pendingFlash: string | null = null;

export function flashToast(message: string): void {
  pendingFlash = message;
}

const ToastContext = createContext<(message: string) => void>(() => {});

export function useToast(): (message: string) => void {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  // ข้อความค้างจากหน้าก่อนอ่านตอนสร้าง state ไม่ใช่ใน effect (setState ใน effect ทำให้ render ซ้อน)
  // ไม่ล้างใน initializer เพราะ StrictMode เรียก initializer สองครั้ง — ล้างใน effect แทน
  const [message, setMessage] = useState<string | null>(() => pendingFlash);
  useEffect(() => {
    pendingFlash = null;
  }, []);

  // หายเองใน 2.6 วินาที — setState อยู่ใน callback ของ timer ไม่ใช่ตัว effect
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 2600);
    return () => clearTimeout(timer);
  }, [message]);

  const show = useCallback((next: string) => setMessage(next), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message ? (
        <div
          role="status"
          className="fixed bottom-7 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-sb-ink px-[18px] py-3 text-sm text-white shadow-[0_8px_24px_rgba(0,0,0,.2)]"
        >
          {message}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
