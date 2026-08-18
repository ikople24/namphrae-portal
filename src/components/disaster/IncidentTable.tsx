import type { IncidentItem } from '@/types/disaster';
import { imageUrl } from '@/lib/disaster-image';
import { DISASTER_LABELS } from '@/lib/disaster-types';
import Icon from '@/components/Icon';
import { Badge } from '@/components/disaster/ui';

export default function IncidentTable({
  incidents, onEdit, onDelete,
}: {
  incidents: IncidentItem[];
  onEdit?: (it: IncidentItem) => void;
  onDelete?: (it: IncidentItem) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-[150px_64px_130px_1fr_150px_120px_90px_96px] items-center gap-0 border-b border-[#eef3f1] bg-[#f7faf8] px-4 py-2.5 text-[11.5px] font-semibold text-ink-faint">
        <div>วันที่</div><div>ปี (พ.ศ.)</div><div>ประเภทภัย</div><div>ประเภทพื้นที่</div>
        <div>พิกัด (lat, lng)</div><div>วิธีจัดการ</div><div>รูป</div><div className="text-right">จัดการ</div>
      </div>
      {incidents.map((it) => (
        <div key={it._id}
          className="grid grid-cols-[150px_64px_130px_1fr_150px_120px_90px_96px] items-center gap-0 border-b border-[#f2f5f3] px-4 py-3 text-[12.5px] hover:bg-[#f9fbfa]">
          <div className="font-medium text-ink">{it.dateText}</div>
          <div className="font-mono text-ink-faint">{it.year}</div>
          <div><Badge variant={it.disasterType}>{DISASTER_LABELS[it.disasterType]}</Badge></div>
          <div className="truncate text-ink-soft" title={it.areaType}>{it.areaType}</div>
          <div className="font-mono text-[11.5px] text-ink-faint">{it.location.coordinates[1].toFixed(4)}, {it.location.coordinates[0].toFixed(4)}</div>
          <div className="truncate text-ink-soft" title={it.method}>{it.method}</div>
          <div>
            {it.imageFile && (
              <a href={imageUrl(it.imageFile)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11.5px] text-aqua">
                <Icon name="image" size={13} />{it.imageFile.split('.')[0]}
              </a>
            )}
          </div>
          <div className="flex justify-end gap-1.5">
            {onEdit && (
              <button onClick={() => onEdit(it)} title="แก้ไข"
                className="flex h-[30px] w-[30px] items-center justify-center rounded-xl border border-line text-ink-faint"><Icon name="edit" size={14} /></button>
            )}
            {onDelete && (
              <button onClick={() => onDelete(it)} title="ลบ"
                className="flex h-[30px] w-[30px] items-center justify-center rounded-xl border border-[#f2d5da] bg-[#fdf4f5] text-[#d1495b]"><Icon name="delete" size={14} /></button>
            )}
          </div>
        </div>
      ))}
      {incidents.length === 0 && <div className="px-4 py-8 text-center text-ink-mute">ไม่มีข้อมูล</div>}
    </div>
  );
}
