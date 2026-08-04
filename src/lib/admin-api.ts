import type {
  CalendarJob,
  Category,
  JobStatus,
  PortalConfig,
  ServiceLink,
  SiteSettings,
} from '@/types/portal';
import type { JobInput, LinkInput } from '@/lib/schema';

// Thin client wrappers around the /api/admin endpoints. Each throws on failure
// with a message suitable for a toast/inline error.

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error ? ` (${body.error})` : '';
    } catch {
      // ignore
    }
    throw new Error(`คำขอล้มเหลว: ${res.status}${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const adminFetcher = <T = unknown>(url: string): Promise<T> =>
  fetch(url).then((r) => jsonOrThrow<T>(r));

export async function getAdminConfig(): Promise<PortalConfig> {
  return adminFetcher<PortalConfig>('/api/admin/config');
}

// ServiceLink -> editable LinkInput (drops the server-owned clickCount and fills
// optional fields so the value satisfies the form's required-string shape).
export function toLinkInput(l: ServiceLink): LinkInput {
  return {
    id: l.id,
    title: l.title,
    subtitle: l.subtitle ?? '',
    url: l.url,
    imageUrl: l.imageUrl ?? '',
    icon: l.icon ?? '',
    categoryId: l.categoryId,
    openInNewTab: l.openInNewTab,
    isActive: l.isActive,
    isFeatured: l.isFeatured,
    order: l.order,
  };
}

export async function createLink(input: LinkInput): Promise<ServiceLink> {
  return jsonOrThrow(
    await fetch('/api/admin/links', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
  );
}

export async function updateLink(
  id: string,
  input: LinkInput
): Promise<ServiceLink> {
  return jsonOrThrow(
    await fetch(`/api/admin/links/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
  );
}

export async function deleteLink(id: string): Promise<void> {
  return jsonOrThrow(
    await fetch(`/api/admin/links/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  );
}

export async function reorderLinks(order: string[]): Promise<void> {
  await jsonOrThrow(
    await fetch('/api/admin/links/reorder', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ order }),
    })
  );
}

export async function updateCategories(
  categories: Category[]
): Promise<Category[]> {
  return jsonOrThrow(
    await fetch('/api/admin/categories', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ categories }),
    })
  );
}

export async function updateSite(site: SiteSettings): Promise<SiteSettings> {
  return jsonOrThrow(
    await fetch('/api/admin/site', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(site),
    })
  );
}

export async function importConfig(config: unknown): Promise<PortalConfig> {
  return jsonOrThrow(
    await fetch('/api/admin/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(config),
    })
  );
}

type UploadSignature = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  resourceType: 'image' | 'video';
};

/**
 * Signed, direct browser -> Cloudinary upload. We ask our server only for a
 * signature (a tiny JSON), then send the file straight to Cloudinary — this
 * avoids routing large videos through the serverless function (which has a
 * ~4.5MB body limit on Vercel). Returns the delivered secure URL.
 */
export async function uploadMedia(
  file: File,
  kind: 'image' | 'video'
): Promise<{ url: string }> {
  const sig: UploadSignature = await jsonOrThrow(
    await fetch('/api/admin/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind }),
    })
  );

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);

  const endpoint = `https://api.cloudinary.com/v1_1/${sig.cloudName}/${sig.resourceType}/upload`;
  const res = await fetch(endpoint, { method: 'POST', body: form });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error?.message ? `: ${body.error.message}` : '';
    } catch {
      /* ignore */
    }
    throw new Error(`อัปโหลดไป Cloudinary ไม่สำเร็จ${detail}`);
  }
  const data = (await res.json()) as { secure_url: string };
  return { url: data.secure_url };
}

export type JobListResponse = { month: string | null; jobs: CalendarJob[] };

/** สร้าง query string ของหน้าปฏิทินหลังบ้าน — ไม่ใส่คีย์ที่ไม่มีค่า */
export function adminCalendarKey(params: {
  month?: string;
  status?: JobStatus;
}): string {
  const qs = new URLSearchParams();
  if (params.month) qs.set('month', params.month);
  if (params.status) qs.set('status', params.status);
  const query = qs.toString();
  return `/api/admin/calendar${query ? `?${query}` : ''}`;
}

export async function createJob(
  input: JobInput
): Promise<{ job: CalendarJob; lineNotified: boolean }> {
  return jsonOrThrow(
    await fetch('/api/admin/calendar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
  );
}

export async function updateJob(
  id: string,
  patch: JobInput
): Promise<CalendarJob> {
  return jsonOrThrow(
    await fetch(`/api/admin/calendar/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ patch }),
    })
  );
}

export async function setJobStatus(
  id: string,
  status: JobStatus
): Promise<CalendarJob> {
  return jsonOrThrow(
    await fetch(`/api/admin/calendar/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  );
}

export async function deleteJob(id: string): Promise<void> {
  return jsonOrThrow(
    await fetch(`/api/admin/calendar/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  );
}

export async function updateLineGroupId(lineGroupId: string): Promise<void> {
  return jsonOrThrow(
    await fetch('/api/admin/line-group', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lineGroupId }),
    })
  );
}
