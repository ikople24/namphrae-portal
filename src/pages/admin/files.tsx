import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import AdminLayout from '@/components/admin/AdminLayout';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import Icon from '@/components/Icon';
import { adminFetcher } from '@/lib/admin-api';
import { getMemberSsrProps } from '@/lib/auth-server';
import {
  libraryErrorMessage,
  libraryListKey,
  MAX_TITLE_LENGTH,
  pageWindow,
  parseListQuery,
  rowNumber,
  titleFromFileName,
  totalPages,
  uploadedDateLabel,
} from '@/lib/file-library';
import {
  deleteLibraryFile,
  LibraryApiError,
  libraryViewUrl,
  renameLibraryFile,
  uploadLibraryFile,
} from '@/lib/file-library-api';
import { MAX_FILE_BYTES } from '@/lib/saraban-attachment';
import type { LibraryListItem, LibraryPage } from '@/types/file-library';

type Me = { features?: string[]; isManager?: boolean };

function errorText(err: unknown): string {
  return err instanceof LibraryApiError ? err.message : libraryErrorMessage(undefined);
}

/** query ของ URL หน้า — ไม่ใส่ค่าเริ่มต้น (หน้า 1 / คำค้นว่าง) */
function listQuery(q: string, page: number): Record<string, string> {
  const query: Record<string, string> = {};
  if (q) query.q = q;
  if (page > 1) query.page = String(page);
  return query;
}

function FilesPage() {
  const router = useRouter();
  const { q, page } = parseListQuery(router.query);

  // ช่องค้นหา: พิมพ์อิสระ แล้ว debounce ไปเขียน URL · URL เปลี่ยนจาก back/forward → sync กลับ
  // sync เฉพาะเมื่อ draft ไม่ตรงกับ URL — ไม่งั้น URL ที่เพิ่งได้ค่า trim แล้วจะทับช่องว่างท้ายคำ
  // และตัวที่พิมพ์ระหว่างรอ router.replace ("รายงาน " → "รายงาน" แล้วพิมพ์ต่อได้ "รายงาน2568")
  const [draft, setDraft] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    if (draft.trim() !== q) setDraft(q);
  }

  const [uploadOpen, setUploadOpen] = useState(false);
  const [storageMissing, setStorageMissing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: me } = useSWR<Me>('/api/admin/me', adminFetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const canManage = me?.isManager === true || (me?.features ?? []).includes('files');

  const { data, error, mutate } = useSWR<LibraryPage>(
    libraryListKey(q, page),
    adminFetcher,
    { keepPreviousData: true }
  );

  useEffect(() => {
    const trimmed = draft.trim();
    if (trimmed === q) return;
    const timer = setTimeout(() => {
      void router.replace(
        { pathname: router.pathname, query: listQuery(trimmed, 1) },
        undefined,
        { shallow: true }
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, q, router]);

  // หน้าเกินจำนวนจริง (ลบรายการสุดท้ายของหน้าท้าย / ลิงก์เก่า) → ไปหน้าสุดท้าย
  // ต้องเช็ค data.page === page: keepPreviousData ยังถือข้อมูลว่างของหน้าเดิมระหว่างรอหน้าใหม่
  // และ router เปลี่ยน identity ทุกครั้งที่ route เปลี่ยน — ไม่เช็คแล้ว effect จะ replace ซ้ำวนไม่จบ
  useEffect(() => {
    if (data && data.page === page && data.items.length === 0 && data.total > 0 && page > 1) {
      void router.replace(
        { pathname: router.pathname, query: listQuery(q, totalPages(data.total)) },
        undefined,
        { shallow: true }
      );
    }
  }, [data, page, q, router]);

  function goToPage(next: number) {
    void router.push({ pathname: router.pathname, query: listQuery(q, next) }, undefined, {
      shallow: true,
    });
  }

  // revalidate ทั้งตอนสำเร็จและล้ม — ล้มเพราะ not_found (คนอื่นลบไปก่อน) แถวต้องหายไปด้วย
  async function onRename(item: LibraryListItem, title: string) {
    try {
      await renameLibraryFile(item.id, title);
    } finally {
      await mutate();
    }
  }

  async function onDelete(item: LibraryListItem) {
    if (!confirm(`ลบ “${item.title}” ?\nไฟล์จะถูกลบถาวร กู้คืนไม่ได้`)) return;
    setNotice(null);
    try {
      await deleteLibraryFile(item.id);
    } catch (err) {
      setNotice(errorText(err));
    }
    await mutate();
  }

  async function onUploaded() {
    setUploadOpen(false);
    setNotice(null);
    // ไฟล์ใหม่อยู่บนสุดของหน้า 1 ที่ไม่มีคำค้น
    if (q || page > 1) {
      setDraft('');
      await router.push({ pathname: router.pathname, query: {} }, undefined, { shallow: true });
    } else {
      await mutate();
    }
  }

  const pages = data ? totalPages(data.total) : 1;
  const colSpan = canManage ? 4 : 3;

  let rows;
  if (!data && error) {
    rows = (
      <tr>
        <td colSpan={colSpan} className="px-4 py-8 text-center text-ink-soft">
          โหลดรายการไม่สำเร็จ{' '}
          <button onClick={() => void mutate()} className="font-semibold text-emerald-deep underline">
            ลองใหม่
          </button>
        </td>
      </tr>
    );
  } else if (!data) {
    rows = (
      <tr>
        <td colSpan={colSpan} className="px-4 py-8 text-center text-ink-mute">
          กำลังโหลด…
        </td>
      </tr>
    );
  } else if (data.items.length === 0) {
    rows = (
      <tr>
        <td colSpan={colSpan} className="px-4 py-8 text-center text-ink-mute">
          {q ? `ไม่พบไฟล์ที่ตรงกับ “${q}”` : 'ยังไม่มีไฟล์'}
        </td>
      </tr>
    );
  } else {
    rows = data.items.map((item, i) => (
      <FileRow
        key={item.id}
        item={item}
        number={rowNumber(data.page, i)}
        canManage={canManage}
        onRename={onRename}
        onDelete={onDelete}
      />
    ));
  }

  return (
    <AdminLayout
      title="คลังไฟล์"
      actions={
        canManage && !storageMissing ? (
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-emerald px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-deep"
          >
            <Icon name="upload_file" size={18} />
            อัปโหลดไฟล์
          </button>
        ) : null
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">คุณกำลังอยู่หน้า {data?.page ?? page}</p>

        {storageMissing ? (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {libraryErrorMessage('storage_not_configured')}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{notice}</p>
        ) : null}
        {/* keepPreviousData ยังโชว์ตารางเดิม — ต้องบอกว่าที่เห็นไม่ใช่ผลของคำขอล่าสุด */}
        {error && data ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            โหลดรายการล่าสุดไม่สำเร็จ รายการที่เห็นอาจไม่ตรงกับหน้า/คำค้นปัจจุบัน{' '}
            <button onClick={() => void mutate()} className="font-semibold underline">
              ลองใหม่
            </button>
          </p>
        ) : null}

        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="ค้นหาชื่อไฟล์…"
          aria-label="ค้นหาชื่อไฟล์"
          className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:border-emerald"
        />

        <div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.07] font-display text-[13px] text-ink-soft">
                <th className="w-16 px-4 py-3 text-center font-semibold">ลำดับ</th>
                <th className="px-4 py-3 text-left font-semibold">ชื่อ</th>
                <th className="hidden w-36 px-4 py-3 text-left font-semibold sm:table-cell">
                  วันที่อัปโหลด
                </th>
                {canManage ? (
                  <th className="w-24 px-4 py-3">
                    <span className="sr-only">จัดการ</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        </div>

        {data && pages > 1 ? <Pager page={data.page} pages={pages} onGo={goToPage} /> : null}
      </div>

      {uploadOpen ? (
        <UploadDialog
          onClose={() => setUploadOpen(false)}
          onUploaded={() => void onUploaded()}
          onStorageMissing={() => {
            setUploadOpen(false);
            setStorageMissing(true);
          }}
        />
      ) : null}
    </AdminLayout>
  );
}

function FileRow({
  item,
  number,
  canManage,
  onRename,
  onDelete,
}: {
  item: LibraryListItem;
  number: number;
  canManage: boolean;
  onRename: (item: LibraryListItem, title: string) => Promise<void>;
  onDelete: (item: LibraryListItem) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function startEdit() {
    setTitle(item.title);
    setErr(null);
    setEditing(true);
  }

  async function save() {
    const next = title.trim();
    if (next === item.title) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onRename(item, next);
      setEditing(false);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-b border-black/5 last:border-b-0">
      <td className="px-4 py-2.5 text-center align-top text-ink-soft">{number}</td>
      <td className="px-4 py-2.5 align-top">
        {editing ? (
          <div className="space-y-1">
            <input
              autoFocus
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              disabled={saving}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void save();
                if (e.key === 'Escape') setEditing(false);
              }}
              aria-label="ชื่อเรื่อง"
              className="w-full rounded-lg border border-emerald px-3 py-1.5 text-sm text-ink outline-none"
            />
            <p className="text-xs text-ink-mute">Enter บันทึก · Esc ยกเลิก</p>
            {err ? <p className="text-xs text-red-700">{err}</p> : null}
          </div>
        ) : (
          <a
            href={libraryViewUrl(item.id)}
            target="_blank"
            rel="noopener"
            className="text-ink underline decoration-black/30 underline-offset-2 transition hover:text-emerald-deep hover:decoration-emerald"
          >
            {item.title}
          </a>
        )}
      </td>
      <td className="hidden whitespace-nowrap px-4 py-2.5 align-top text-ink-soft sm:table-cell">
        {uploadedDateLabel(item.uploadedAt)}
      </td>
      {canManage ? (
        <td className="whitespace-nowrap px-4 py-2.5 text-right align-top">
          {editing ? null : (
            <>
              <button
                onClick={startEdit}
                aria-label={`แก้ชื่อ ${item.title}`}
                title="แก้ชื่อ"
                className="rounded-lg p-1.5 text-ink-faint transition hover:bg-black/5 hover:text-ink"
              >
                <Icon name="edit" size={18} />
              </button>
              <button
                onClick={() => void onDelete(item)}
                aria-label={`ลบ ${item.title}`}
                title="ลบ"
                className="rounded-lg p-1.5 text-ink-faint transition hover:bg-red-50 hover:text-red-700"
              >
                <Icon name="delete" size={18} />
              </button>
            </>
          )}
        </td>
      ) : null}
    </tr>
  );
}

function Pager({
  page,
  pages,
  onGo,
}: {
  page: number;
  pages: number;
  onGo: (page: number) => void;
}) {
  const base =
    'min-w-9 border-l border-black/10 px-3 py-1.5 text-sm transition first:border-l-0 disabled:cursor-default disabled:bg-black/[0.03] disabled:text-ink-mute';
  const idle = 'text-emerald-deep hover:bg-emerald-050';
  return (
    <nav
      aria-label="แบ่งหน้า"
      className="inline-flex overflow-hidden rounded-lg border border-black/10 bg-white"
    >
      <button className={`${base} ${idle}`} disabled={page === 1} onClick={() => onGo(1)} aria-label="หน้าแรก">
        {'<<'}
      </button>
      <button className={`${base} ${idle}`} disabled={page === 1} onClick={() => onGo(page - 1)} aria-label="หน้าก่อน">
        {'<'}
      </button>
      {pageWindow(page, pages).map((n) => (
        <button
          key={n}
          className={`${base} ${n === page ? 'bg-emerald font-semibold text-white' : idle}`}
          aria-current={n === page ? 'page' : undefined}
          onClick={() => onGo(n)}
        >
          {n}
        </button>
      ))}
      <button className={`${base} ${idle}`} disabled={page === pages} onClick={() => onGo(page + 1)} aria-label="หน้าถัดไป">
        {'>'}
      </button>
      <button className={`${base} ${idle}`} disabled={page === pages} onClick={() => onGo(pages)} aria-label="หน้าสุดท้าย">
        {'>>'}
      </button>
    </nav>
  );
}

function UploadDialog({
  onClose,
  onUploaded,
  onStorageMissing,
}: {
  onClose: () => void;
  onUploaded: () => void;
  onStorageMissing: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function pick(picked: File | undefined) {
    setErr(null);
    if (!picked) {
      setFile(null);
      return;
    }
    // ตรวจก่อนส่ง ไม่ให้รอส่งไฟล์ใหญ่จนจบแล้วค่อยโดน 413 — เซิร์ฟเวอร์ยังตรวจซ้ำเสมอ
    if (picked.size > MAX_FILE_BYTES) {
      setFile(null);
      setErr(libraryErrorMessage('file_too_large'));
      return;
    }
    setFile(picked);
    setTitle(titleFromFileName(picked.name));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      await uploadLibraryFile(file, title.trim());
      onUploaded();
    } catch (error) {
      if (error instanceof LibraryApiError && error.code === 'storage_not_configured') {
        onStorageMissing();
        return;
      }
      setErr(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !busy) onClose();
      }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
    >
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <h2 id="upload-title" className="font-display text-lg font-semibold text-ink">
          อัปโหลดไฟล์
        </h2>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">ไฟล์ (PDF, JPG, PNG ไม่เกิน 10 MB)</span>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            disabled={busy}
            onChange={(e) => pick(e.target.files?.[0])}
            className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-emerald-050 file:px-4 file:py-2 file:text-sm file:font-medium file:text-emerald-deep"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">ชื่อเรื่อง</span>
          <input
            value={title}
            maxLength={MAX_TITLE_LENGTH}
            disabled={busy}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="เลือกไฟล์แล้วจะเติมจากชื่อไฟล์ให้"
            className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-ink outline-none transition focus:border-emerald"
          />
        </label>

        {err ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p> : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-black/5 disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={!file || !title.trim() || busy}
            className="rounded-full bg-emerald px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-deep disabled:opacity-50"
          >
            {busy ? 'กำลังอัปโหลด…' : 'บันทึก'}
          </button>
        </div>
      </form>
    </div>
  );
}

export const getServerSideProps = getMemberSsrProps;

export default withMemberGuard(FilesPage);
