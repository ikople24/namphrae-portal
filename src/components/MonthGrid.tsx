import {
  THAI_DOW,
  buildMonthGrid,
  currentMonthInBangkok,
  parseMonth,
  shiftMonth,
  thaiMonthLabel,
  todayInBangkok,
} from '@/lib/calendar-grid';
import Icon from '@/components/Icon';
import {
  JOB_KIND_COLOR,
  JOB_KIND_LABEL,
  type JobKind,
  type JobStatus,
} from '@/types/portal';

// ส่วนของงานที่ปฏิทินต้องใช้จริง — ไม่มีฟิลด์ PII อยู่ในสัญญานี้เลย component
// จึงเผลอแสดงชื่อผู้ป่วยไม่ได้แม้หน้าหลังบ้านจะส่ง CalendarJob เต็ม ๆ เข้ามา
// ข้อความบนช่องมาจาก renderLabel ที่แต่ละหน้าตัดสินใจเอง
export type CalendarEntry = {
  id: string;
  kind: JobKind;
  date: string;
  time: string;
  status: JobStatus;
};

export default function MonthGrid<T extends CalendarEntry>({
  month,
  jobs,
  renderLabel,
  onMonthChange,
  onSelect,
}: {
  month: string; // 'YYYY-MM'
  jobs: T[];
  renderLabel: (job: T) => string;
  onMonthChange: (month: string) => void;
  onSelect?: (job: T) => void;
}) {
  // ใช้ parseMonth() ตัวเดียวกับที่ API ใช้ ไม่ใช่ split('-') เอง — ไม่งั้น component
  // กับ API ตอบไม่ตรงกันว่าอะไรคือเดือนที่ถูกต้อง: '2026-13' ที่ API ตอบ 400 จะกลาย
  // เป็นสัปดาห์ผีของเดือนธันวาคมพร้อมหัวข้อ 'undefined 2569' ส่วน '' ทำให้ทุกช่องมี
  // key เป็น 'NaN-NaN-NaN' ซ้ำกันหมด · เดือนพังแล้วถอยไปเดือนปัจจุบันดีกว่าพังทั้งตาราง
  // (currentMonthInBangkok() คืนรูปแบบถูกต้องเสมอ parseMonth จึงไม่มีทางคืน null)
  const { year, month: monthNo } =
    parseMonth(month) ?? parseMonth(currentMonthInBangkok())!;
  const weeks = buildMonthGrid(year, monthNo);
  const today = todayInBangkok();

  const byDate = new Map<string, T[]>();
  for (const job of jobs) {
    const list = byDate.get(job.date);
    if (list) list.push(job);
    else byDate.set(job.date, [job]);
  }

  return (
    <div className="rounded-2xl border border-black/[0.07] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.07] px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMonthChange(shiftMonth(month, -1))}
            aria-label="เดือนก่อนหน้า"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint transition hover:bg-black/[0.04]"
          >
            <Icon name="chevron_left" size={20} />
          </button>
          <p className="min-w-[9.5rem] text-center font-display text-[15px] font-semibold text-ink">
            {thaiMonthLabel(year, monthNo)}
          </p>
          <button
            type="button"
            onClick={() => onMonthChange(shiftMonth(month, 1))}
            aria-label="เดือนถัดไป"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint transition hover:bg-black/[0.04]"
          >
            <Icon name="chevron_right" size={20} />
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(today.slice(0, 7))}
            className="ml-1 rounded-lg px-2.5 py-1 text-[12px] font-medium text-ink-faint transition hover:bg-black/[0.04]"
          >
            วันนี้
          </button>
        </div>

        <div className="flex items-center gap-4 text-[12px] text-ink-soft">
          {(Object.keys(JOB_KIND_LABEL) as JobKind[]).map((kind) => (
            <span key={kind} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: JOB_KIND_COLOR[kind] }}
              />
              {JOB_KIND_LABEL[kind]}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-black/[0.07]">
        {THAI_DOW.map((dow) => (
          <div
            key={dow}
            className="px-2 py-2 text-center text-[11.5px] font-medium text-ink-faint"
          >
            {dow}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {weeks.flat().map((cell) => {
          const entries = byDate.get(cell.date) ?? [];
          return (
            <div
              key={cell.date}
              className={`min-h-[86px] border-b border-r border-black/[0.05] p-1.5 last:border-r-0 ${
                cell.inMonth ? '' : 'bg-black/[0.015]'
              }`}
            >
              <div
                className={`mb-1 text-[11.5px] ${
                  cell.date === today
                    ? 'inline-grid h-5 w-5 place-items-center rounded-full bg-green font-semibold text-white'
                    : cell.inMonth
                      ? 'text-ink-soft'
                      : 'text-ink-faint/50'
                }`}
              >
                {Number(cell.date.slice(8))}
              </div>

              <div className="flex flex-col gap-0.5">
                {entries.map((job) => {
                  const label = `${job.time} ${renderLabel(job)}`;
                  const body = (
                    <>
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: JOB_KIND_COLOR[job.kind] }}
                      />
                      <span className="truncate">{label}</span>
                    </>
                  );
                  const cls = `flex items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-tight ${
                    job.status === 'done'
                      ? 'text-ink-faint line-through'
                      : 'text-ink-soft'
                  }`;

                  return onSelect ? (
                    <button
                      key={job.id}
                      type="button"
                      title={label}
                      onClick={() => onSelect(job)}
                      className={`${cls} transition hover:bg-black/[0.04]`}
                    >
                      {body}
                    </button>
                  ) : (
                    <span key={job.id} title={label} className={cls}>
                      {body}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
