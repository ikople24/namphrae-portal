import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import JobForm from '@/components/admin/JobForm';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getFeatureSsrProps } from '@/lib/auth-server';

function NewJobPage() {
  return (
    <AdminLayout title="เพิ่มงานปฏิบัติงาน">
      <Link
        href="/admin/calendar"
        className="mb-4 inline-block text-sm text-ink-soft hover:text-ink"
      >
        ← กลับไปหน้าปฏิทิน
      </Link>
      <JobForm mode="new" />
    </AdminLayout>
  );
}

export const getServerSideProps = getFeatureSsrProps('calendar');

export default withMemberGuard(NewJobPage);
