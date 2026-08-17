import type { IncidentItem } from '@/types/disaster';
import type { DisasterType } from '@/lib/disaster-types';

export type TypeFilter = 'ALL' | DisasterType;

export function filterIncidents(items: IncidentItem[], query: string, type: TypeFilter): IncidentItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((it) => {
    if (type !== 'ALL' && it.disasterType !== type) return false;
    if (!q) return true;
    return (
      it.areaType.toLowerCase().includes(q) ||
      it.imageFile.toLowerCase().includes(q) ||
      it.dateText.toLowerCase().includes(q)
    );
  });
}

export function paginate<T>(items: T[], page: number, perPage: number): T[] {
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * perPage;
  return items.slice(start, start + perPage);
}

export function summaryByType(items: IncidentItem[]): Record<DisasterType, number> {
  const out: Record<DisasterType, number> = { WILDFIRE: 0, FLOOD: 0, LANDSLIDE: 0, DROUGHT: 0 };
  for (const it of items) out[it.disasterType] += 1;
  return out;
}
