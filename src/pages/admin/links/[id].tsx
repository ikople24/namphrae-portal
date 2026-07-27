import { useRouter } from 'next/router';
import useSWR from 'swr';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getMemberSsrProps } from '@/lib/auth-server';
import LinkForm from '@/components/admin/LinkForm';
import { adminFetcher, toLinkInput } from '@/lib/admin-api';
import type { PortalConfig } from '@/types/portal';

function EditLinkPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const { data, isLoading } = useSWR<PortalConfig>(
    '/api/admin/config',
    adminFetcher
  );

  const link = data?.links.find((l) => l.id === id);

  return (
    <AdminLayout title="แก้ไขลิงก์บริการ">
      <Link href="/admin" className="mb-4 inline-block text-sm text-ink-soft hover:text-ink">
        ← กลับไปหน้ารายการ
      </Link>
      {isLoading || !data ? (
        <p className="text-ink-soft">กำลังโหลด…</p>
      ) : !link ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          ไม่พบลิงก์ id “{id}”
        </p>
      ) : (
        <LinkForm
          mode="edit"
          categories={data.categories}
          initial={toLinkInput(link)}
        />
      )}
    </AdminLayout>
  );
}

export const getServerSideProps = getMemberSsrProps;

export default withMemberGuard(EditLinkPage);
