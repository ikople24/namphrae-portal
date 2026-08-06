import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import type { GetServerSideProps } from 'next';
import { resolveApplyState, type ApplyState } from '@/lib/signups';
import { applyInputSchema } from '@/lib/user-schema';

// สมัครเข้าใช้งานหลังบ้าน: ผู้ที่ล็อกอิน Clerk แล้วแต่ยังไม่เป็นสมาชิก
// (getMemberSsrProps ส่งมาที่นี่แทน AccessDenied) กรอกข้อมูลเพื่อเข้าคิว
// รออนุมัติ — role ให้แอดมินกำหนดตอนอนุมัติ ผู้สมัครไม่ได้เลือกเอง
type Props = { apply: ApplyState };

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const { isClerkConfigured } = await import('@/lib/clerk-config');
  if (!isClerkConfigured()) {
    // dev-open: no signup concept, admin is already open
    return { redirect: { destination: '/admin', permanent: false } };
  }
  const { getAuth } = await import('@clerk/nextjs/server');
  const { userId } = getAuth(ctx.req);
  if (!userId) {
    return { redirect: { destination: '/sign-in', permanent: false } };
  }
  const { isMongoConfigured } = await import('@/lib/mongodb');
  if (!isMongoConfigured()) {
    return { redirect: { destination: '/', permanent: false } };
  }
  const { findRegistryUserByClerkId, getLatestSignupByClerkId } = await import(
    '@/lib/signups-store'
  );
  const registry = await findRegistryUserByClerkId(userId);
  if (registry) {
    const active = registry.isActive !== false && registry.isArchived !== true;
    if (active) return { redirect: { destination: '/admin', permanent: false } };
    return { props: { apply: { state: 'deactivated' } } };
  }
  const latest = await getLatestSignupByClerkId(userId);
  return {
    props: {
      apply: resolveApplyState(
        latest ? { status: latest.status, rejectNote: latest.rejectNote } : null
      ),
    },
  };
};

export default function ApplyPage({ apply }: Props) {
  const [submitted, setSubmitted] = useState(false);
  let content;
  if (submitted || apply.state === 'pending') {
    content = (
      <StatusCard
        title="ส่งคำขอแล้ว — รอการอนุมัติ"
        body="ผู้ดูแลระบบจะตรวจสอบคำขอของคุณ เมื่ออนุมัติแล้วจะเข้าใช้งานหลังบ้านได้ทันที"
      />
    );
  } else if (apply.state === 'deactivated') {
    content = (
      <StatusCard
        title="บัญชีถูกปิดการใช้งาน"
        body="บัญชีนี้เคยเป็นสมาชิกแต่ถูกปิดการใช้งานแล้ว กรุณาติดต่อผู้ดูแลระบบ"
      />
    );
  } else {
    content = (
      <ApplyForm
        rejectNote={apply.state === 'rejected' ? apply.rejectNote : null}
        onDone={() => setSubmitted(true)}
      />
    );
  }
  return (
    <>
      <Head>
        <title>สมัครเข้าใช้งาน · Namphrae Portal</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="grid min-h-screen place-items-center bg-paper px-5 py-10">
        {content}
      </div>
    </>
  );
}

function StatusCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-md rounded-2xl border border-black/[0.07] bg-surface p-8 text-center">
      <h1 className="font-display text-xl font-semibold text-ink">{title}</h1>
      <p className="mt-3 text-sm text-ink-soft">{body}</p>
      <Link
        href="/"
        className="mt-5 inline-block rounded-full px-4 py-2 text-sm font-medium text-ink-soft hover:bg-black/[0.04]"
      >
        กลับหน้าหลัก
      </Link>
    </div>
  );
}

const FIELDS = [
  { key: 'name', label: 'ชื่อ-นามสกุล' },
  { key: 'position', label: 'ตำแหน่ง' },
  { key: 'department', label: 'แผนก/กลุ่มงาน' },
  { key: 'phone', label: 'เบอร์โทรศัพท์' },
] as const;

function ApplyForm({
  rejectNote,
  onDone,
}: {
  rejectNote: string | null;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    position: '',
    department: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function submit() {
    const parsed = applyInputSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง');
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `ส่งคำขอไม่สำเร็จ (${res.status})`);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งคำขอไม่สำเร็จ');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-black/[0.07] bg-surface p-8">
      <h1 className="font-display text-xl font-semibold text-ink">
        สมัครเข้าใช้งานหลังบ้าน
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        กรอกข้อมูลเพื่อส่งคำขอ — ผู้ดูแลระบบจะตรวจสอบและอนุมัติ
      </p>
      {rejectNote !== null ? (
        <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-800">
          คำขอก่อนหน้าถูกปฏิเสธ{rejectNote ? `: ${rejectNote}` : ''} —
          แก้ไขข้อมูลแล้วส่งใหม่ได้
        </div>
      ) : null}
      <div className="mt-5 flex flex-col gap-4">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-sm font-medium text-ink">
              {f.label}
            </span>
            <input
              type="text"
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              className="w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm text-ink outline-none focus:border-emerald"
            />
          </label>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={submit}
        disabled={sending}
        className="mt-5 w-full rounded-full bg-emerald px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
      >
        {sending ? 'กำลังส่ง…' : 'ส่งคำขอสมัคร'}
      </button>
    </div>
  );
}
