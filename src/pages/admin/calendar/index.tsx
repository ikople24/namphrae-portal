import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import AdminLayout from '@/components/admin/AdminLayout';
import MonthGrid from '@/components/MonthGrid';
import Icon from '@/components/Icon';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getMemberSsrProps } from '@/lib/auth-server';
import {
  adminCalendarKey,
  adminFetcher,
  deleteCalendarJob,
  setCalendarJobStatus,
  type JobListResponse,
} from '@/lib/admin-api';
import { currentMonthInBangkok, thaiShortDate } from '@/lib/calendar-grid';
import { nextStatuses } from '@/lib/job-status';
import {
  JOB_KIND_COLOR,
  JOB_KIND_LABEL,
  JOB_STATUS_LABEL,
  type CalendarJob,
  type JobStatus,
} from '@/types/portal';

const STATUS_STYLE: Record<JobStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-050 text-green-deep',
  done: 'bg-black/[0.06] text-ink-faint',
  cancelled: 'bg-red-100 text-red-800',
};
// jobs-store อ่านจาก Mongo/ไฟล์ตรง ๆ โดยไม่ผ่าน Zod (ดูหมายเหตุใน jobs-store.ts)
// แถวที่ถูกแก้มือให้มี status แปลกปลอมจึงเป็นไปได้จริง — ไม่ใช่แค่ทฤษฎี ต้องมีสี
// สำรองไว้ ไม่งั้น STATUS_STYLE[job.status] จะคืน undefined แล้ว className หาย
const FALLBACK_STATUS_STYLE = 'bg-black/[0.06] text-ink-faint';

const ACTION_LABEL: Record<JobStatus, string> = {
  pending: 'ถอนอนุมัติ',
  approved: 'อนุมัติ',
  done: 'ปิดงาน',
  cancelled: 'ยกเลิก',
};

function AdminCalendarPage() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonthInBangkok());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // สองคำขอแยกกันโดยตั้งใจ: ปฏิทินดูทีละเดือน แต่คิวรออนุมัติต้องเห็นทุกงาน
  // ไม่งั้นงานที่ขอไว้เดือนหน้าจะหายไปจากสายตาจนกว่าจะเลื่อนเดือนไปเจอ
  const monthQuery = useSWR<JobListResponse>(
    adminCalendarKey({ month }),
    adminFetcher
  );
  const pendingQuery = useSWR<JobListResponse>(
    adminCalendarKey({ status: 'pending' }),
    adminFetcher
  );

  const jobs = monthQuery.data?.jobs ?? [];
  const pending = pendingQuery.data?.jobs ?? [];

  async function refresh() {
    await Promise.all([monthQuery.mutate(), pendingQuery.mutate()]);
  }

  async function changeStatus(job: CalendarJob, next: JobStatus) {
    setBusy(job.id);
    setMsg(null);
    try {
      await setCalendarJobStatus(job.id, next);
      await refresh();
      setMsg(`${job.title}: ${JOB_STATUS_LABEL[next]}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'เปลี่ยนสถานะไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  }

  async function remove(job: CalendarJob) {
    if (!confirm(`ลบงาน "${job.title}" ถาวร?`)) return;
    setBusy(job.id);
    setMsg(null);
    try {
      await deleteCalendarJob(job.id);
      await refresh();
      setMsg('ลบงานแล้ว');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'ลบไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminLayout
      title="ปฏิทินปฏิบัติงาน"
      actions={
        <Link
          href="/admin/calendar/new"
          className="flex items-center gap-1.5 rounded-xl bg-green px-4 py-2 font-display text-[13.5px] font-semibold text-white transition hover:bg-green-deep"
        >
          <Icon name="add" size={19} />
          เพิ่มงาน
        </Link>
      }
    >
      {msg ? (
        <p className="mb-4 rounded-xl border border-black/[0.08] bg-white px-3.5 py-2.5 text-[13px] text-ink-soft">
          {msg}
        </p>
      ) : null}

      <section className="mb-6">
        <h2 className="mb-2 flex items-center gap-1.5 font-display text-[15px] font-semibold text-ink">
          <Icon name="schedule" size={19} />
          รออนุมัติ
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11.5px] font-medium text-amber-800">
            {pending.length}
          </span>
        </h2>
        {pendingQuery.isLoading ? (
          <p className="text-[13px] text-ink-soft">กำลังโหลด…</p>
        ) : pending.length === 0 ? (
          <p className="text-[13px] text-ink-faint">ไม่มีงานรออนุมัติ</p>
        ) : (
          <JobTable
            jobs={pending}
            busy={busy}
            onStatus={changeStatus}
            onDelete={remove}
          />
        )}
      </section>

      <section className="mb-6">
        <MonthGrid
          month={month}
          jobs={jobs.filter((j) => j.status !== 'cancelled')}
          onMonthChange={setMonth}
          renderLabel={(job) => job.title}
          // คลิกงานบนปฏิทินแล้วไปหน้าแก้ไขเลย — ไม่งั้นปฏิทินเป็นแค่ภาพนิ่ง
          // ต้องไล่หาแถวเดียวกันในตารางด้านล่างอีกที
          onSelect={(job) => router.push(`/admin/calendar/${job.id}`)}
        />
      </section>

      <section>
        <h2 className="mb-2 font-display text-[15px] font-semibold text-ink">
          งานทั้งหมดในเดือนนี้
        </h2>
        {monthQuery.isLoading ? (
          <p className="text-[13px] text-ink-soft">กำลังโหลด…</p>
        ) : jobs.length === 0 ? (
          <p className="text-[13px] text-ink-faint">ยังไม่มีงานในเดือนนี้</p>
        ) : (
          <JobTable
            jobs={jobs}
            busy={busy}
            onStatus={changeStatus}
            onDelete={remove}
          />
        )}
      </section>
    </AdminLayout>
  );
}

function JobTable({
  jobs,
  busy,
  onStatus,
  onDelete,
}: {
  jobs: CalendarJob[];
  busy: string | null;
  onStatus: (job: CalendarJob, next: JobStatus) => void;
  onDelete: (job: CalendarJob) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-black/[0.07] bg-white">
      <table className="w-full min-w-[760px] text-left text-[13px]">
        <thead className="border-b border-black/[0.07] text-[12px] text-ink-faint">
          <tr>
            <th className="px-3 py-2.5 font-medium">วันเวลา</th>
            <th className="px-3 py-2.5 font-medium">งาน</th>
            <th className="px-3 py-2.5 font-medium">เส้นทาง</th>
            <th className="px-3 py-2.5 font-medium">สถานะ</th>
            <th className="px-3 py-2.5 text-right font-medium">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-b border-black/[0.05] last:border-b-0">
              <td className="whitespace-nowrap px-3 py-2.5 text-ink-soft">
                {thaiShortDate(job.date)} {job.time}
              </td>
              <td className="px-3 py-2.5">
                <span className="flex items-center gap-1.5 font-medium text-ink">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: JOB_KIND_COLOR[job.kind] }}
                    title={JOB_KIND_LABEL[job.kind]}
                  />
                  {job.title}
                </span>
                {job.village || job.phone ? (
                  <span className="mt-0.5 block text-[11.5px] text-ink-faint">
                    {[job.village, job.phone].filter(Boolean).join(' · ')}
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2.5 text-ink-soft">
                {job.origin || job.destination
                  ? `${job.origin || '-'} → ${job.destination || '-'}`
                  : '—'}
              </td>
              <td className="px-3 py-2.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${
                    STATUS_STYLE[job.status] ?? FALLBACK_STATUS_STYLE
                  }`}
                >
                  {JOB_STATUS_LABEL[job.status] ?? `สถานะไม่รู้จัก (${job.status})`}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {nextStatuses(job.status).map((next) => (
                    <button
                      key={next}
                      type="button"
                      disabled={busy === job.id}
                      onClick={() => onStatus(job, next)}
                      className="rounded-lg border border-black/[0.12] px-2.5 py-1 text-[12px] text-ink-soft transition hover:bg-black/[0.04] disabled:opacity-40"
                    >
                      {ACTION_LABEL[next]}
                    </button>
                  ))}
                  <Link
                    href={`/admin/calendar/${job.id}`}
                    className="grid h-7 w-7 place-items-center rounded-lg text-ink-faint transition hover:bg-black/[0.04]"
                    aria-label="แก้ไข"
                  >
                    <Icon name="edit" size={17} />
                  </Link>
                  <button
                    type="button"
                    disabled={busy === job.id}
                    onClick={() => onDelete(job)}
                    aria-label="ลบ"
                    className="grid h-7 w-7 place-items-center rounded-lg text-ink-faint transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                  >
                    <Icon name="delete" size={17} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const getServerSideProps = getMemberSsrProps;

export default withMemberGuard(AdminCalendarPage);
