import RegisterPage from '@/components/saraban/RegisterPage';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getFeatureSsrProps } from '@/lib/auth-server';

function InboxPage() {
  return <RegisterPage registers={['in']} title="ทะเบียนหนังสือรับ" />;
}

export const getServerSideProps = getFeatureSsrProps('saraban');
export default withMemberGuard(InboxPage);
