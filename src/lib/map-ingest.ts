import { parseMapFile } from '@/lib/map-parse';
import { computeStats, sha256OfFeatureCollection } from '@/lib/map-stats';
import { runChecks } from '@/lib/map-checks';
import { computeDiff } from '@/lib/map-diff';
import type {
  FeatureCollection,
  MapCheck,
  MapDiff,
  MapLayer,
  MapLayerVersion,
  MapStats,
  SourceFormat,
} from '@/types/map';

// ประกอบร่างขั้นตอน "แกะ → นับสถิติ → ตรวจ → เทียบส่วนต่าง" ไว้ที่เดียว
//
// ไม่มี I/O โดยตั้งใจ: ผู้เรียกเป็นคนหาเนื้อไฟล์กับเวอร์ชันก่อนหน้ามาให้ ทำให้
// API route กับ scripts/import-map-layers.ts เดินผ่านตรรกะชุดเดียวกันเป๊ะ ๆ
// ถ้าแยกกันเขียน สคริปต์นำเข้าจะกลายเป็นทางลัดที่ข้ามด่านตรวจไปโดยไม่มีใครรู้

export type IngestOk = {
  ok: true;
  fc: FeatureCollection;
  format: SourceFormat;
  stats: MapStats;
  sha256: string;
  checks: MapCheck[];
  diff: MapDiff | null;
  /** true = มี check ระดับ error → ห้ามสร้าง draft */
  blocked: boolean;
};

export type IngestResult = IngestOk | { ok: false; message: string };

export function ingestMapFile(args: {
  text: string;
  fileName: string;
  layer: MapLayer;
  previous: { version: MapLayerVersion; fc: FeatureCollection } | null;
}): IngestResult {
  const parsed = parseMapFile(args.text, args.fileName);
  if (!parsed.ok) return { ok: false, message: parsed.message };

  const { fc } = parsed;
  const stats = computeStats(fc);
  const sha256 = sha256OfFeatureCollection(fc);

  const checks = runChecks({
    fc,
    stats,
    sha256,
    layer: args.layer,
    previous: args.previous
      ? {
          stats: args.previous.version.stats,
          sha256: args.previous.version.source.sha256,
          versionNo: args.previous.version.versionNo,
        }
      : null,
  });

  // เทียบส่วนต่างเฉพาะเมื่อไฟล์ผ่านด่าน error — ไฟล์ที่พิกัดเป็น UTM ทั้งไฟล์จะให้
  // ตัวเลข "แก้ไข 7,970 รายการ" ที่จริงตามตัวอักษรแต่ไร้ประโยชน์และชวนตกใจ
  const blocked = checks.some((c) => c.level === 'error');
  const diff =
    !blocked && args.previous
      ? computeDiff(
          fc,
          args.previous.fc,
          args.layer.keyFields,
          args.previous.version.versionNo
        )
      : null;

  return { ok: true, fc, format: parsed.format, stats, sha256, checks, diff, blocked };
}
