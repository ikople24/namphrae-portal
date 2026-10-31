import type { GetServerSideProps } from 'next';

// /saraban → ทะเบียนรับ (รอบ 6 กลายเป็นแดชบอร์ด) · ปลายทางมี guard ของตัวเอง
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: '/saraban/inbox', permanent: false },
});

export default function SarabanIndex() {
  return null;
}
