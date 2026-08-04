import Link from 'next/link';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import AdminLayout from '@/components/admin/AdminLayout';
import JobForm from '@/components/admin/JobForm';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getMemberSsrProps } from '@/lib/auth-server';
import { adminFetcher } from '@/lib/admin-api';
import type { JobInput } from '@/lib/schema';
import type { CalendarJob } from '@/types/portal';

// CalendarJob -> JobInput ที่ฟอร์มใช้ได้ (ตัดฟิลด์ที่ server เป็นเจ้าของ และ
// เติมค่าว่างให้ optional field เพื่อให้ตรงกับ shape ที่ input ต้องการ)
function toJobInput(job: CalendarJob): JobInput {
  return {
    kind: job.kind,
    date: job.date,
    time: job.time,
    title: job.title,
    village: job.village ?? '',
    origin: job.origin ?? '',
    destination: job.destination ?? '',
    phone: job.phone ?? '',
    note: job.note ?? '',
  };
}

function EditJobPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  // ดึงงานเดียวตรง ๆ จาก /api/admin/calendar/[id] แทนที่จะโหลดทั้งลิสต์แล้วหา
  // ด้วย .find() ฝั่ง client — ลิสต์เต็มลากข้อมูลผู้ป่วยทุกคนในระบบเข้ามาแค่เพื่อ
  // แก้ไขงานเดียว
  const {
    data: job,
    error,
    isLoading,
  } = useSWR<CalendarJob>(
    id ? `/api/admin/calendar/${encodeURIComponent(id)}` : null,
    adminFetcher
  );

  return (
    <AdminLayout title="แก้ไขงานปฏิบัติงาน">
      <Link
        href="/admin/calendar"
        className="mb-4 inline-block text-sm text-ink-soft hover:text-ink"
      >
        ← กลับไปหน้าปฏิทิน
      </Link>
      {error ? (
        <p className="text-red-700">
          {error instanceof Error ? error.message : 'โหลดข้อมูลไม่สำเร็จ'}
        </p>
      ) : isLoading || !job ? (
        <p className="text-ink-soft">กำลังโหลด…</p>
      ) : (
        <JobForm mode="edit" jobId={job.id} initial={toJobInput(job)} />
      )}
    </AdminLayout>
  );
}

export const getServerSideProps = getMemberSsrProps;

export default withMemberGuard(EditJobPage);
