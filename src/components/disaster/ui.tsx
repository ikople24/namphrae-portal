import type { ReactNode } from 'react';
import { DISASTER_COLORS, DISASTER_LABELS, DISASTER_TYPES, type DisasterType } from '@/lib/disaster-types';

export function GlassPanel({
  className = '', children,
}: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-xl border border-white/80 shadow-lg ${className}`}
      style={{ background: 'rgba(255,255,255,.93)' }}>
      {children}
    </div>
  );
}

export function CommandBar({ children }: { children: ReactNode }) {
  return (
    // เต็มความกว้าง + จัดกึ่งกลาง (pointer-events-none กันบังการคลิกแผนที่รอบ ๆ แถบ)
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[4] flex justify-center px-3">
      {/* จอเล็ก: ไม่เกินความกว้างจอ แล้วเลื่อนแนวนอน แทนที่จะบีบปุ่มจนข้อความตัดบรรทัด (ปุ่มบวม) */}
      <GlassPanel className="pointer-events-auto flex h-[52px] max-w-full items-center gap-3 overflow-x-auto rounded-full px-4 [&>*]:shrink-0">
        {children}
      </GlassPanel>
    </div>
  );
}

export function Segmented<T extends string>({
  options, value, onChange, className = '',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-1 rounded-full bg-surface-sunken p-[3px] ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} type="button" aria-pressed={active} onClick={() => onChange(o.value)}
            className={`whitespace-nowrap rounded-[16px] px-4 py-1.5 text-xs transition ${
              active ? 'bg-green-deep font-semibold text-white' : 'font-medium text-ink-faint hover:text-ink'
            }`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

type StatusVariant = 'progress' | 'watch' | 'closed';
const STATUS: Record<StatusVariant, { fg: string; bg: string; label: string }> = {
  progress: { fg: '#b8860b', bg: '#fdf3d7', label: 'กำลังดำเนินการ' },
  watch: { fg: '#1e5fa8', bg: '#e6effb', label: 'เข้าระวัง' },
  closed: { fg: '#0e8a4f', bg: '#e3f3ea', label: 'ปิดเคส' },
};

function isDisaster(v: string): v is DisasterType {
  return (DISASTER_TYPES as readonly string[]).includes(v);
}

export function Badge({
  variant, children,
}: { variant: StatusVariant | DisasterType; children?: ReactNode }) {
  if (isDisaster(variant)) {
    const c = DISASTER_COLORS[variant];
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold text-ink"
        style={{ background: `${c}1f` }}>
        <span className="h-2 w-2 rounded-sm" style={{ background: c }} />
        {children ?? DISASTER_LABELS[variant]}
      </span>
    );
  }
  const s = STATUS[variant];
  return (
    <span className="inline-flex items-center rounded-md px-2 py-1 text-[10.5px] font-semibold"
      style={{ color: s.fg, background: s.bg }}>
      {children ?? s.label}
    </span>
  );
}
