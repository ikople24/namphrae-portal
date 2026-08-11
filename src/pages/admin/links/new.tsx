import useSWR from 'swr';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getFeatureSsrProps } from '@/lib/auth-server';
import LinkForm from '@/components/admin/LinkForm';
import { adminFetcher } from '@/lib/admin-api';
import type { PortalConfig } from '@/types/portal';

function NewLinkPage() {
  const { data, isLoading } = useSWR<PortalConfig>(
    '/api/admin/config',
    adminFetcher
  );

  return (
    <AdminLayout title="เพิ่มลิงก์บริการ">
      <Link href="/admin" className="mb-4 inline-block text-sm text-ink-soft hover:text-ink">
        ← กลับไปหน้ารายการ
      </Link>
      {isLoading || !data ? (
        <p className="text-ink-soft">กำลังโหลด…</p>
      ) : (
        <LinkForm mode="new" categories={data.categories} />
      )}
    </AdminLayout>
  );
}

export const getServerSideProps = getFeatureSsrProps('links');

export default withMemberGuard(NewLinkPage);
