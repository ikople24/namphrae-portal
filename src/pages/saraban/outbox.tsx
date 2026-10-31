import RegisterPage from '@/components/saraban/RegisterPage';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getFeatureSsrProps } from '@/lib/auth-server';

function OutboxPage() {
  return <RegisterPage registers={['out', 'circular']} title="ทะเบียนหนังสือส่ง" />;
}

export const getServerSideProps = getFeatureSsrProps('saraban');
export default withMemberGuard(OutboxPage);
