import { useRef, useState } from 'react';

// Image field: paste a URL or upload a file (via the provided upload fn, which
// signs + sends to Cloudinary). Degrades gracefully when uploads aren't set up —
// the URL box still works.
export default function ImageUploadField({
  value,
  onChange,
  upload,
  accept = 'image/*',
}: {
  value: string;
  onChange: (url: string) => void;
  upload: (file: File) => Promise<string>;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      const url = await upload(file);
      onChange(url);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-black/10 bg-paper">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] text-ink-soft">ไม่มีรูป</span>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/20"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="วาง URL รูป หรืออัปโหลดด้านล่าง"
            inputMode="url"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-lg border border-black/15 px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-black/[0.04] disabled:opacity-50"
            >
              {uploading ? 'กำลังอัปโหลด…' : 'อัปโหลดไฟล์'}
            </button>
            {value ? (
              <button
                type="button"
                onClick={() => onChange('')}
                className="text-sm text-red-600 hover:underline"
              >
                ลบรูป
              </button>
            ) : null}
          </div>
          {err ? <p className="text-xs text-red-600">{err}</p> : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  );
}
