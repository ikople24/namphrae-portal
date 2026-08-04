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
  const { data, error, isLoading } = useSWR<{ jobs: CalendarJob[] }>(
    id ? '/api/admin/calendar' : null,
    adminFetcher
  );
  const job = data?.jobs.find((j) => j.id === id);

  return (
    <AdminLayout title="แก้ไขงานปฏิบัติงาน">
      <Link
        href="/admin/calendar"
        className="mb-4 inline-block text-sm text-ink-soft hover:text-ink"
      >
        ← กลับไปหน้าปฏิทิน
      </Link>
      {error ? (
        <p className="text-red-700">โหลดข้อมูลไม่สำเร็จ</p>
      ) : isLoading || !data ? (
        <p className="text-ink-soft">กำลังโหลด…</p>
      ) : !job ? (
        <p className="text-ink-soft">ไม่พบงานนี้</p>
      ) : (
        <JobForm mode="edit" jobId={job.id} initial={toJobInput(job)} />
      )}
    </AdminLayout>
  );
}

export const getServerSideProps = getMemberSsrProps;

export default withMemberGuard(EditJobPage);
