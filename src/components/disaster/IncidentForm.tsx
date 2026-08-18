import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { DISASTER_TYPES, DISASTER_LABELS, DISASTER_COLORS, type DisasterType } from '@/lib/disaster-types';
import type { IncidentItem } from '@/types/disaster';
import { imageUrl } from '@/lib/disaster-image';
import type { VillageCollection } from '@/lib/village-geo';
import { villageOf } from '@/lib/village-geo';
import { fitDimensions } from '@/lib/image-resize';
import Icon from '@/components/Icon';
import ThaiDatePicker from '@/components/disaster/ThaiDatePicker';
import SelectOrCustom from '@/components/disaster/SelectOrCustom';
import { METHOD_OPTIONS, AREA_TYPE_OPTIONS } from '@/lib/disaster-options';
import { uploadMedia } from '@/lib/admin-api';

const MapView = dynamic(() => import('@/components/disaster/MapView'), { ssr: false });

export interface FormValues {
  disasterType: DisasterType; year: number; dateText: string; method: string;
  areaType: string; lat: number; lng: number; imageFile: string;
}
export function toFormValues(it: IncidentItem): FormValues {
  return {
    disasterType: it.disasterType, year: it.year, dateText: it.dateText, method: it.method,
    areaType: it.areaType, lat: it.location.coordinates[1], lng: it.location.coordinates[0], imageFile: it.imageFile,
  };
}
const EMPTY: FormValues = {
  disasterType: 'WILDFIRE', year: 2569, dateText: '', method: 'ดับด้วยคน',
  areaType: 'ป่าสงวนแห่งชาติ', lat: 18.73, lng: 98.84, imageFile: '',
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // รับต้นฉบับถึง 5MB
const RESIZE_MAX_DIM = 1920;
const RESIZE_QUALITY = 0.85;

// ย่อรูปในเบราว์เซอร์ก่อนอัป (โหลดเร็ว คงคุณภาพ) → คืน jpeg data URI
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่ได้'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('อ่านรูปไม่ได้'));
      img.onload = () => {
        const { width, height } = fitDimensions(img.naturalWidth, img.naturalHeight, RESIZE_MAX_DIM);
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('canvas ไม่พร้อม')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', RESIZE_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function IncidentForm({
  initial, onSubmit, onCancel, submitting, error, villages,
}: {
  initial?: FormValues;
  onSubmit: (v: FormValues) => void;
  onCancel: () => void;
  submitting: boolean;
  error?: string;
  villages?: VillageCollection | null;
}) {
  const [v, setV] = useState<FormValues>(initial ?? EMPTY);
  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const fld = 'w-full rounded-xl border-[1.5px] border-line px-3 py-2.5 text-sm outline-none focus:border-green-deep';
  const villageName = useMemo(
    () => (villages ? villageOf(v.lng, v.lat, villages.features) : null),
    [villages, v.lat, v.lng]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  async function handleFile(file: File) {
    setUploadError('');
    if (!file.type.startsWith('image/')) { setUploadError('ต้องเป็นไฟล์รูปภาพ'); return; }
    if (file.size > MAX_UPLOAD_BYTES) { setUploadError('รูปต้องไม่เกิน 5MB'); return; }
    setUploading(true);
    try {
      const dataUri = await resizeImage(file);
      // portal ไม่รับ data URI — /api/admin/upload คืนแค่ลายเซ็นแล้วให้เบราว์เซอร์ยิงไฟล์
      // ตรงไป Cloudinary เอง (เลี่ยงเพดาน body ~4.5MB ของ serverless) uploadMedia()
      // ห่อขั้นตอนนั้นไว้ให้แล้ว
      //
      // ยังย่อรูปก่อนเหมือนเดิม เพราะเจ้าหน้าที่ถ่ายจากมือถือได้ไฟล์ 8–12MB ต่อรูป
      // ถ้าอัปตรงโดยไม่ย่อ พื้นที่ Cloudinary จะหมดเร็วขึ้นหลายเท่าและหน้าสาธารณะโหลดช้าลง
      const blob = await (await fetch(dataUri)).blob();
      const resized = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
        type: 'image/jpeg',
      });
      const { url } = await uploadMedia(resized, 'image');
      set('imageFile', url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'อัปโหลดไม่สำเร็จ');
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    const dateText = v.dateText.trim() || `ปี ${v.year}`; // ภัยแล้ง/ไม่ระบุวัน → ให้ dateText ไม่ว่าง
    onSubmit({ ...v, dateText });
  }

  return (
    <div className="fixed inset-0 z-[50] flex items-center justify-center p-4" style={{ background: 'rgba(15,42,43,.42)' }} role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="max-h-[92vh] w-full max-w-[1000px] overflow-y-auto rounded-[18px] bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[12px] bg-[#fdecdf] text-[#d97a2b]"><Icon name="warning" size={21} /></span>
          <div className="flex-1 leading-tight">
            <div className="text-[17px] font-bold text-ink">{initial ? 'แก้ไขเหตุการณ์ภัยพิบัติ' : 'บันทึกเหตุการณ์ภัยพิบัติ'}</div>
            <div className="text-xs text-ink-faint">เพิ่มข้อมูลเหตุการณ์ภัยในตำบลน้ำแพร่</div>
          </div>
          <button type="button" onClick={onCancel} aria-label="ปิด" className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-sunken text-ink-faint">✕</button>
        </div>

        {error && <p className="mx-6 mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="grid grid-cols-2 gap-6 p-6">
          {/* LEFT: fields */}
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-2 text-[12.5px] font-semibold text-ink">ประเภทภัย <span className="text-[#d1495b]">*</span></div>
              <div className="grid grid-cols-2 gap-2">
                {DISASTER_TYPES.map((t) => {
                  const on = v.disasterType === t;
                  return (
                    <button key={t} type="button"
                      onClick={() => { set('disasterType', t); set('method', METHOD_OPTIONS[t][0] ?? ''); set('areaType', AREA_TYPE_OPTIONS[t][0] ?? ''); }}
                      className={`flex items-center gap-2.5 rounded-xl border-[1.5px] px-3 py-2.5 text-[13px] ${on ? 'border-green-deep bg-green-deep/5 font-semibold' : 'border-line font-medium'}`}>
                      <span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: DISASTER_COLORS[t] }} />{DISASTER_LABELS[t]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-[1fr_1.4fr] gap-3.5">
              <label className="text-[12.5px] font-semibold text-ink">ปี (พ.ศ.) <span className="text-[#d1495b]">*</span>
                <input type="number" value={v.year} onChange={(e) => set('year', Number(e.target.value))} className={`mt-1.5 font-mono ${fld}`} />
              </label>
              <div className="text-[12.5px] font-semibold text-ink">วันที่เกิดเหตุ
                <div className="mt-1.5">
                  <ThaiDatePicker value={v.dateText} fallbackYearBE={v.year}
                    onChange={(text, yBE) => { set('dateText', text); if (text) set('year', yBE); }} />
                </div>
              </div>
            </div>
            <div className="text-[12.5px] font-semibold text-ink">วิธีจัดการ
              <div className="mt-1.5">
                <SelectOrCustom key={`m-${v.disasterType}`} options={METHOD_OPTIONS[v.disasterType]}
                  value={v.method} onChange={(x) => set('method', x)} placeholder="พิมพ์วิธีจัดการ…" />
              </div>
            </div>
            <div className="text-[12.5px] font-semibold text-ink">ประเภทพื้นที่
              <div className="mt-1.5">
                <SelectOrCustom key={`a-${v.disasterType}`} options={AREA_TYPE_OPTIONS[v.disasterType]}
                  value={v.areaType} onChange={(x) => set('areaType', x)} placeholder="เช่น 158/1 ม.11" />
              </div>
            </div>
            <div>
              <div className="mb-2 text-[12.5px] font-semibold text-ink">รูปเหตุการณ์</div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
              {v.imageFile ? (
                <div className="flex items-start gap-3">
                  <img src={imageUrl(v.imageFile)} alt="ตัวอย่างรูป" className="h-20 w-20 rounded-xl border border-line object-cover" />
                  <div className="flex flex-col gap-1.5">
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="rounded-xl border-[1.5px] border-line px-3 py-1.5 text-xs font-medium text-ink-soft disabled:opacity-50">
                      {uploading ? 'กำลังอัปโหลด…' : 'เปลี่ยนรูป'}
                    </button>
                    <button type="button" onClick={() => set('imageFile', '')} className="text-xs text-[#d1495b]">ลบรูป</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-line py-4 text-[13px] text-ink-faint disabled:opacity-50">
                  <Icon name="image" size={16} /> {uploading ? 'กำลังอัปโหลด…' : 'อัปโหลดรูป'}
                </button>
              )}
              {uploadError && <p className="mt-1.5 text-[11.5px] text-[#d1495b]">{uploadError}</p>}
            </div>
          </div>

          {/* RIGHT: map picker + coords */}
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-2 text-[12.5px] font-semibold text-ink">ตำแหน่งที่เกิดเหตุ <span className="text-[#d1495b]">*</span> <span className="text-[11px] font-normal text-ink-mute">— คลิกบนแผนที่</span></div>
              <div className="h-[250px] overflow-hidden rounded-card border-[1.5px] border-line">
                <MapView incidents={[]} villages={villages} picked={{ lat: v.lat, lng: v.lng }}
                  onPick={(lat, lng) => { set('lat', Number(lat.toFixed(5))); set('lng', Number(lng.toFixed(5))); }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <label className="text-[12.5px] font-semibold text-ink">ละติจูด (lat)
                <input type="number" step="0.00001" value={v.lat} onChange={(e) => set('lat', Number(e.target.value))} className={`mt-1.5 font-mono ${fld}`} />
              </label>
              <label className="text-[12.5px] font-semibold text-ink">ลองจิจูด (lng)
                <input type="number" step="0.00001" value={v.lng} onChange={(e) => set('lng', Number(e.target.value))} className={`mt-1.5 font-mono ${fld}`} />
              </label>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-[#cfe7dd] bg-[#f0f8f5] px-3 py-2.5 text-xs text-green-forest">
              <Icon name="location_on" size={16} /> หมุดอยู่ในเขต <b className="mx-0.5">{villageName ?? 'นอกเขต 11 หมู่บ้าน'}</b>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-line bg-[#fafcfb] px-6 py-4">
          <div className="flex-1 text-[11.5px] text-ink-mute">ช่องที่มี <span className="text-[#d1495b]">*</span> เป็นข้อมูลที่จำเป็น</div>
          <button type="button" onClick={onCancel} className="rounded-xl border-[1.5px] border-line px-5 py-2.5 text-[13px] font-medium text-ink-soft">ยกเลิก</button>
          <button type="button" disabled={submitting || uploading} onClick={submit}
            className="flex items-center gap-2 rounded-xl bg-green-deep px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
            <Icon name="check_circle" size={16} /> {submitting ? 'กำลังบันทึก…' : initial ? 'บันทึกการแก้ไข' : 'บันทึกเหตุการณ์'}
          </button>
        </div>
      </div>
    </div>
  );
}
