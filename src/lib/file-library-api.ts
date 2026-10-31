// src/lib/file-library-api.ts
// client wrapper ของ /api/admin/files — โยน LibraryApiError ที่มี code ให้หน้าจอเลือกข้อความ/พฤติกรรม
// (admin-api.ts รวม code ไว้ใน message ซึ่งหน้าคลังไฟล์ต้องแยก storage_not_configured ออกมา)

import { libraryErrorMessage } from '@/lib/file-library';
import type { LibraryListItem } from '@/types/file-library';

export class LibraryApiError extends Error {
  readonly code: string | undefined;

  constructor(code: string | undefined) {
    super(libraryErrorMessage(code));
    this.code = code;
  }
}

async function okOrThrow<T>(res: Response): Promise<T> {
  if (res.ok) return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  let code: string | undefined;
  try {
    const body = (await res.json()) as { error?: unknown };
    code = typeof body?.error === 'string' ? body.error : undefined;
  } catch {
    // body ไม่ใช่ JSON (เช่น 413 จาก proxy หน้าเว็บ) — ใช้ status แทน
  }
  throw new LibraryApiError(code ?? (res.status === 413 ? 'file_too_large' : undefined));
}

export async function uploadLibraryFile(file: File, title: string): Promise<LibraryListItem> {
  const params = new URLSearchParams({ title, name: file.name });
  return okOrThrow(
    await fetch(`/api/admin/files?${params}`, {
      method: 'POST',
      headers: { 'content-type': file.type || 'application/octet-stream' },
      body: file,
    })
  );
}

export async function renameLibraryFile(id: string, title: string): Promise<LibraryListItem> {
  return okOrThrow(
    await fetch(`/api/admin/files/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title }),
    })
  );
}

export async function deleteLibraryFile(id: string): Promise<void> {
  return okOrThrow(
    await fetch(`/api/admin/files/${encodeURIComponent(id)}`, { method: 'DELETE' })
  );
}

export function libraryViewUrl(id: string): string {
  return `/api/admin/files/${encodeURIComponent(id)}/view`;
}
