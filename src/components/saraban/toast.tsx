// toast ของระบบสารบรรณ (handoff: ล่างกลาง หายใน 2.6 วินาที)
// store ระดับโมดูล ไม่ใช่ context — หน้าเป็นคน render SarabanLayout เอง ตัวหน้าจึงอยู่นอก provider
// ใด ๆ ที่ layout ถือ (context จะได้ค่าเริ่มต้นที่ไม่ทำอะไรเลยแบบเงียบ ๆ) และข้อความอยู่รอดการเปลี่ยนหน้า
// (ลงรับเสร็จ → ไปทะเบียน) เพราะ Pages Router remount layout ทุกหน้าแต่โมดูลยังอยู่
import { useSyncExternalStore } from 'react';

let current: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function showToast(message: string): void {
  current = message;
  clearTimeout(timer);
  timer = setTimeout(() => {
    current = null;
    emit();
  }, 2600);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** วางครั้งเดียวใน SarabanLayout · ตอน SSR ไม่มี toast เสมอ */
export function Toaster() {
  const message = useSyncExternalStore(
    subscribe,
    () => current,
    () => null
  );
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed bottom-7 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-sb-ink px-[18px] py-3 text-sm text-white shadow-[0_8px_24px_rgba(0,0,0,.2)]"
    >
      {message}
    </div>
  );
}
