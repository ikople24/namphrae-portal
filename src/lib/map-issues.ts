import { featureKey, KEY_SEPARATOR } from '@/lib/map-checks';
import type { CheckCode, FeatureCollection, MapLayer } from '@/types/map';

// แถวที่เข้าข่ายคำเตือนแต่ละข้อ ในรูปแบบที่เอาไปเปิดใน QGIS/Excel แล้วไล่แก้ได้ทันที
//
// นี่คือสิ่งที่ทำให้คำเตือนเป็น "งานที่ทำต่อได้" แทนที่จะเป็นตัวเลขน่ารำคาญที่ทุกคน
// เรียนรู้ที่จะกดข้าม — คำเตือนบอกว่ามีปัญหา 88 แถว แต่ CSV บอกว่าแถวไหน

const NULL_LITERALS = new Set([
  'none',
  'null',
  'nan',
  'nil',
  'n/a',
  'na',
  '#n/a',
  '<null>',
  'undefined',
]);
const MOJIBAKE = /(เธ|เน)[^฀-๿]/;

export type IssueTable = { headers: string[]; rows: string[][] };

export function collectIssueRows(
  fc: FeatureCollection,
  layer: MapLayer,
  code: CheckCode
): IssueTable {
  switch (code) {
    case 'duplicate-key':
      return duplicateKeyRows(fc, layer);
    case 'key-composition':
      return keyCompositionRows(fc, layer);
    case 'null-literal':
      return valueRows(fc, layer, (v) => NULL_LITERALS.has(v.trim().toLowerCase()));
    case 'mojibake':
      return valueRows(fc, layer, (v) => MOJIBAKE.test(v));
    default:
      return { headers: [], rows: [] };
  }
}

function keyLabel(layer: MapLayer): string {
  return layer.keyFields.join('+') || 'ลำดับแถว';
}

function rowKey(
  fc: FeatureCollection,
  layer: MapLayer,
  index: number
): string {
  return featureKey(fc.features[index], layer.keyFields) ?? `(แถวที่ ${index + 1})`;
}

function duplicateKeyRows(fc: FeatureCollection, layer: MapLayer): IssueTable {
  const seen = new Map<string, number[]>();
  const rows: string[][] = [];

  fc.features.forEach((f, i) => {
    const key = featureKey(f, layer.keyFields);
    if (key === null) {
      rows.push([`(แถวที่ ${i + 1})`, 'ว่าง', String(i + 1)]);
      return;
    }
    const list = seen.get(key);
    if (list) list.push(i);
    else seen.set(key, [i]);
  });

  for (const [key, idxs] of seen) {
    if (idxs.length < 2) continue;
    for (const i of idxs) {
      rows.push([key.split(KEY_SEPARATOR).join(' + '), 'ซ้ำ', String(i + 1)]);
    }
  }

  return { headers: [keyLabel(layer), 'ปัญหา', 'ลำดับแถวในไฟล์'], rows };
}

function keyCompositionRows(fc: FeatureCollection, layer: MapLayer): IssueTable {
  const fieldsUsed = [...new Set(layer.keyComposition.flat())];
  const rows: string[][] = [];
  if (layer.keyFields.length !== 1) return { headers: [], rows };

  fc.features.forEach((f, i) => {
    const raw = f.properties?.[layer.keyFields[0]];
    if (raw === null || raw === undefined || raw === '') return;
    const target = String(raw);
    const usable = layer.keyComposition.filter((recipe) =>
      recipe.every((n) => {
        const v = f.properties?.[n];
        return v !== null && v !== undefined && v !== '';
      })
    );
    if (usable.length === 0) return;
    const matched = usable.some(
      (recipe) => recipe.map((n) => String(f.properties![n])).join('') === target
    );
    if (matched) return;
    rows.push([
      target,
      ...fieldsUsed.map((n) => String(f.properties?.[n] ?? '')),
      // แสดงสิ่งที่ "ควรจะเป็น" ตามสูตรแรกที่ใช้ได้ เพื่อให้เห็นทันทีว่าต่างตรงไหน
      usable[0].map((n) => String(f.properties![n])).join(''),
      String(i + 1),
    ]);
  });

  return {
    headers: [layer.keyFields[0], ...fieldsUsed, 'ประกอบได้เป็น', 'ลำดับแถวในไฟล์'],
    rows,
  };
}

function valueRows(
  fc: FeatureCollection,
  layer: MapLayer,
  hit: (value: string) => boolean
): IssueTable {
  const rows: string[][] = [];
  fc.features.forEach((f, i) => {
    for (const [field, v] of Object.entries(f.properties ?? {})) {
      if (typeof v === 'string' && hit(v)) {
        rows.push([rowKey(fc, layer, i), field, v, String(i + 1)]);
      }
    }
  });
  return { headers: [keyLabel(layer), 'ฟิลด์', 'ค่าที่พบ', 'ลำดับแถวในไฟล์'], rows };
}

/**
 * CSV พร้อม BOM — Excel บน Windows ซึ่งเป็นเครื่องมือที่เจ้าหน้าที่เทศบาลใช้จริง
 * อ่าน UTF-8 ที่ไม่มี BOM เป็น cp874 แล้วภาษาไทยกลายเป็นขยะทั้งไฟล์ ซึ่งน่าขันมาก
 * เพราะไฟล์นี้มีไว้รายงานปัญหา encoding เป็นหลัก
 */
export function toCsv(table: IssueTable): string {
  const escape = (cell: string) =>
    /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
  const lines = [table.headers, ...table.rows].map((r) => r.map(escape).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}
