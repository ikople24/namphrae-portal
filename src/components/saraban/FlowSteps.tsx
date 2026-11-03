// แถบ 5 ขั้นของหน้าติดตาม (ต้นแบบจอ 6) — ขั้นมาจาก flowStep() · ผ่านแล้วเขียว · ปัจจุบัน accent
// หรือแดงถ้าเกินกำหนด · ที่เหลือ #E3E8EF
import { FLOW_STEP_LABELS } from '@/lib/saraban-labels';
import type { FlowStepNo } from '@/lib/saraban-flow';

export default function FlowSteps({ step, overdue }: { step: FlowStepNo; overdue: boolean }) {
  return (
    <ol className="mt-4 grid grid-cols-5 gap-1.5" aria-label="ขั้นของหนังสือ">
      {FLOW_STEP_LABELS.map((label, i) => {
        const n = i + 1;
        // ขั้น 5 คือจบเรื่องแล้ว — ถือว่าผ่าน ไม่ใช่ "กำลังทำ"
        const done = n < step || step === 5;
        const current = n === step && step !== 5;
        const bar = done ? 'bg-sb-success' : current ? (overdue ? 'bg-sb-danger' : 'bg-sb-accent') : 'bg-[#E3E8EF]';
        const text = done ? 'text-sb-success' : current ? (overdue ? 'text-sb-danger' : 'text-sb-accent') : 'text-sb-muted';
        return (
          <li key={label} aria-current={current ? 'step' : undefined}>
            <div className={`h-1.5 rounded-full ${bar}`} />
            <p className={`mt-1.5 text-center text-[11px] leading-tight ${current ? 'font-semibold' : ''} ${text}`}>{label}</p>
          </li>
        );
      })}
    </ol>
  );
}
