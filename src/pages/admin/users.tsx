import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import AdminLayout from '@/components/admin/AdminLayout';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getManagerSsrProps } from '@/lib/auth-server';
import {
  adminFetcher,
  approveSignupRequest,
  rejectSignupRequest,
  updateMember,
  updateMemberAccess,
  type MemberWithAccess,
  type SignupListResponse,
} from '@/lib/admin-api';
import type { RegistryMember } from '@/lib/registry-user';
import { FEATURE_LABELS } from '@/lib/user-access';

// จัดการผู้ใช้: แท็บคิวผู้สมัคร (อนุมัติ/ปฏิเสธ) + แท็บสมาชิก (แก้ไข/
// เปิด-ปิดการใช้งาน). ทุก mutation จบด้วย mutate() ให้ SWR ดึงสถานะจริง
// จากเซิร์ฟเวอร์ ไม่เดา state เอง
export const getServerSideProps = getManagerSsrProps;

function UsersAdminPage() {
  const [tab, setTab] = useState<'queue' | 'members'>('queue');
  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-1.5 font-display text-[13px] font-medium transition ${
      active
        ? 'bg-green-050 text-green-deep'
        : 'text-ink-faint hover:bg-black/[0.04]'
    }`;
  return (
    <AdminLayout title="จัดการผู้ใช้">
      <div className="mb-5 flex gap-1">
        <button type="button" onClick={() => setTab('queue')} className={tabClass(tab === 'queue')}>
          คิวผู้สมัคร
        </button>
        <button type="button" onClick={() => setTab('members')} className={tabClass(tab === 'members')}>
          สมาชิก
        </button>
      </div>
      {tab === 'queue' ? <SignupQueue /> : <MembersTable />}
    </AdminLayout>
  );
}

export default withMemberGuard(UsersAdminPage);

function SignupQueue() {
  const { data, error, mutate } = useSWR<SignupListResponse>(
    '/api/admin/signups',
    adminFetcher
  );
  // ดึงรายชื่อสมาชิกมาด้วย (SWR dedupe กับแท็บสมาชิก) เพื่อทำ role suggestions
  const { data: membersData } = useSWR<{ members: MemberWithAccess[] }>(
    '/api/admin/users',
    adminFetcher
  );
  const roleOptions = [
    ...new Set((membersData?.members ?? []).map((m) => m.role).filter(Boolean)),
  ];
  const { mutate: globalMutate } = useSWRConfig();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState('');

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setActionError('');
    try {
      await fn();
      await mutate();
      // แก้ badge ค้างที่แถบข้าง (AdminLayout ใช้คีย์นี้แยกจาก /api/admin/signups)
      await globalMutate('/api/admin/signups?countOnly=1');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'ดำเนินการไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return <p className="text-sm text-red-600">โหลดคิวผู้สมัครไม่สำเร็จ: {String(error.message ?? error)}</p>;
  }
  if (!data) return <p className="text-sm text-ink-faint">กำลังโหลด…</p>;
  if (data.signups.length === 0) {
    return <p className="text-sm text-ink-faint">ไม่มีผู้สมัครรออนุมัติ</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
      <datalist id="role-suggestions">
        {roleOptions.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      {data.signups.map((s) => (
        <div key={s.id} className="rounded-2xl border border-black/[0.07] bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-display text-[15px] font-semibold text-ink">{s.name}</p>
            <p className="text-xs text-ink-mute">
              สมัครเมื่อ {new Date(s.appliedAt).toLocaleString('th-TH')}
            </p>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {s.position} · {s.department} · {s.phone}
            {s.email ? ` · ${s.email}` : ''}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="text"
              aria-label="role"
              placeholder="role (เช่น staff)"
              list="role-suggestions"
              value={roles[s.id] ?? ''}
              onChange={(e) => setRoles({ ...roles, [s.id]: e.target.value })}
              className="w-40 rounded-xl border border-black/[0.12] px-3 py-1.5 text-sm outline-none focus:border-emerald"
            />
            <button
              type="button"
              disabled={busyId === s.id || !(roles[s.id] ?? '').trim()}
              onClick={() => run(s.id, () => approveSignupRequest(s.id, (roles[s.id] ?? '').trim()))}
              className="rounded-full bg-emerald px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
            >
              อนุมัติ
            </button>
            <input
              type="text"
              aria-label="เหตุผลที่ปฏิเสธ"
              placeholder="เหตุผลที่ปฏิเสธ (ไม่บังคับ)"
              value={notes[s.id] ?? ''}
              onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })}
              className="w-52 rounded-xl border border-black/[0.12] px-3 py-1.5 text-sm outline-none focus:border-emerald"
            />
            <button
              type="button"
              disabled={busyId === s.id}
              onClick={() => run(s.id, () => rejectSignupRequest(s.id, notes[s.id] ?? ''))}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              ปฏิเสธ
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const EDIT_FIELDS = [
  { key: 'name', label: 'ชื่อ-นามสกุล' },
  { key: 'position', label: 'ตำแหน่ง' },
  { key: 'department', label: 'แผนก' },
  { key: 'role', label: 'role' },
  { key: 'phone', label: 'เบอร์โทร' },
] as const;

function MembersTable() {
  const [editing, setEditing] = useState<RegistryMember | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const { data, error, mutate } = useSWR<{ members: MemberWithAccess[] }>(
    '/api/admin/users',
    adminFetcher,
    // ระหว่างแก้ไขแถวอยู่ ห้าม revalidate ทับ — ไม่งั้นกดบันทึกแล้ว snapshot เก่า
    // ใน editing จะเขียนทับค่าที่คนอื่นเพิ่งแก้บนเซิร์ฟเวอร์
    { isPaused: () => editing !== null }
  );

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setActionError('');
    try {
      await fn();
      setEditing(null);
      await mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return <p className="text-sm text-red-600">โหลดรายชื่อสมาชิกไม่สำเร็จ: {String(error.message ?? error)}</p>;
  }
  if (!data) return <p className="text-sm text-ink-faint">กำลังโหลด…</p>;

  return (
    <div className="flex flex-col gap-3">
      {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
      {data.members.map((m) => (
        <div
          key={m.id}
          className={`rounded-2xl border border-black/[0.07] bg-white p-5 ${
            m.isActive ? '' : 'opacity-60'
          }`}
        >
          {editing?.id === m.id ? (
            <div className="flex flex-col gap-3">
              {EDIT_FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-soft">{f.label}</span>
                  <input
                    type="text"
                    value={editing[f.key]}
                    onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}
                    className="w-full rounded-xl border border-black/[0.12] px-3 py-1.5 text-sm outline-none focus:border-emerald"
                  />
                </label>
              ))}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === m.id}
                  onClick={() =>
                    run(m.id, () =>
                      updateMember(m.id, {
                        name: editing.name,
                        position: editing.position,
                        department: editing.department,
                        role: editing.role,
                        phone: editing.phone,
                      })
                    )
                  }
                  className="rounded-full bg-emerald px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
                >
                  บันทึก
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-full px-4 py-1.5 text-sm font-medium text-ink-soft hover:bg-black/[0.04]"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-[15px] font-semibold text-ink">
                  {m.name || '(ไม่มีชื่อ)'}
                  {!m.isActive ? (
                    <span className="ml-2 rounded-full bg-black/[0.06] px-2 py-px text-[11px] font-medium text-ink-mute">
                      ปิดการใช้งาน
                    </span>
                  ) : null}
                  {m.isArchived ? (
                    <span className="ml-2 rounded-full bg-black/[0.06] px-2 py-px text-[11px] font-medium text-ink-mute">
                      archived
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-sm text-ink-soft">
                  {[m.position, m.department, m.role, m.phone].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(m)}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-black/[0.04]"
                >
                  แก้ไข
                </button>
                <button
                  type="button"
                  disabled={busyId === m.id}
                  onClick={() => {
                    const next = !m.isActive;
                    if (
                      !next &&
                      !window.confirm(`ปิดการใช้งานบัญชี "${m.name}" ?`)
                    ) {
                      return;
                    }
                    void run(m.id, () => updateMember(m.id, { isActive: next }));
                  }}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                    m.isActive
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-emerald-deep hover:bg-green-050'
                  }`}
                >
                  {m.isActive ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
                </button>
              </div>
            </div>
          )}
          {editing?.id !== m.id ? (
            m.access ? (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-black/[0.06] pt-3">
                <span className="text-xs font-semibold text-ink-soft">สิทธิ์เข้าใช้:</span>
                {FEATURE_LABELS.map(({ key, label }) => (
                  <label
                    key={key}
                    className={`flex items-center gap-1.5 text-xs ${
                      m.access!.isManager ? 'text-ink-mute' : 'text-ink-soft'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={m.access!.isManager || busyId === m.id}
                      checked={m.access!.isManager || m.access!.features.includes(key)}
                      onChange={(e) =>
                        void run(m.id, () =>
                          updateMemberAccess(m.id, {
                            features: e.target.checked
                              ? [...m.access!.features, key]
                              : m.access!.features.filter((f) => f !== key),
                          })
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
                <label className="ml-auto flex items-center gap-1.5 text-xs font-medium text-ink">
                  <input
                    type="checkbox"
                    disabled={m.isEnvManager || busyId === m.id}
                    checked={m.access!.isManager}
                    onChange={(e) => {
                      const next = e.target.checked;
                      if (
                        !next &&
                        !window.confirm(`ถอดสถานะผู้จัดการของ "${m.name}" ?`)
                      ) {
                        return;
                      }
                      void run(m.id, () =>
                        updateMemberAccess(m.id, { isManager: next })
                      );
                    }}
                  />
                  ผู้จัดการ
                  {m.isEnvManager ? (
                    <span
                      title="ผู้จัดการหลัก กำหนดจากตัวแปรระบบ ถอดจากหน้านี้ไม่ได้"
                      className="rounded-full bg-green-050 px-2 py-px text-[10px] font-medium text-green-deep"
                    >
                      หลัก
                    </span>
                  ) : null}
                </label>
              </div>
            ) : (
              <p className="mt-3 text-xs text-ink-mute">
                บัญชีนี้ไม่มี clerkId — กำหนดสิทธิ์จากพอร์ทัลไม่ได้
              </p>
            )
          ) : null}
        </div>
      ))}
    </div>
  );
}
