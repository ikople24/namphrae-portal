import {
  CATEGORICAL_MAX,
  THAILAND_BBOX,
  type Feature,
  type FeatureCollection,
  type MapCheck,
  type MapLayer,
  type MapStats,
} from '@/types/map';

// ด่านตรวจ — ฟังก์ชันบริสุทธิ์ ไม่มี I/O
//
// หลักการแบ่งระดับ:
//   error   = "ไฟล์นี้ใช้งานไม่ได้จริง" ยืนยันไปก็ไม่ทำให้มันใช้ได้ → ไม่เกิด draft
//   warning = "ข้อมูลอาจถูกต้องตามความเป็นจริง" คนตัดสินคือเจ้าหน้าที่ ไม่ใช่โปรแกรม
//
// ห้ามเพิ่มกฎที่ต้องรู้ว่า "ค่าที่ถูกต้องมีอะไรบ้าง" (เช่น รายชื่อโซนของน้ำแพร่)
// ระบบไม่มีทางรู้ และการเดาแทนเจ้าหน้าที่คือการสร้างข้อมูลปลอมที่ดูน่าเชื่อถือ —
// ดูสเปกหัวข้อ zone_id ว่าทำไมกฎ rare-value รุ่นแรกถึงถูกตัดทิ้งทั้งข้อ (ทดสอบกับ
// ข้อมูลจริงแล้วยิงโดน 18 ฟิลด์ ซึ่งถูกจริงแค่ 3)

// ASCII Unit Separator — อักขระควบคุมที่ไม่มีทางปรากฏในข้อมูลเชิงพื้นที่จริง
// ห้ามใช้ช่องว่างหรือขีดกลาง: ค่าจริงมีทั้งสองอย่างอยู่แล้ว (zone_id = 'Moo 4',
// own_soi = '-') คีย์ประกอบ ['w1', 'Moo 4'] กับ ['w1 Moo', '4'] จะกลายเป็น
// สตริงเดียวกันแล้วนับเป็นรายการเดียวกันเงียบ ๆ
export const KEY_SEPARATOR = '';
const COUNT_JUMP_RATIO = 0.2;
const SAMPLE_MAX = 5;

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

// ลำดับไบต์ที่โผล่เมื่อข้อความ UTF-8 ภาษาไทยถูกอ่านเป็น cp874/latin1 แล้วเข้ารหัส
// กลับเป็น UTF-8 — 'เธ'/'เน' ตามด้วยอักขระที่ไม่ใช่ตัวอักษรไทย คือรอยนิ้วมือ
const MOJIBAKE = /(เธ|เน)[^฀-๿]/;

export type PreviousVersion = {
  stats: MapStats;
  sha256: string;
  versionNo: number;
};

export type CheckInput = {
  fc: FeatureCollection;
  stats: MapStats;
  sha256: string;
  layer: MapLayer;
  previous: PreviousVersion | null;
};

/** ตัวตนของ feature ตาม keyFields — null แปลว่าไม่มีคีย์ให้ใช้ */
export function featureKey(f: Feature, keyFields: string[]): string | null {
  if (keyFields.length === 0) return null;
  const parts: string[] = [];
  for (const name of keyFields) {
    const v = f.properties?.[name];
    if (v === null || v === undefined || v === '') return null;
    parts.push(String(v));
  }
  return parts.join(KEY_SEPARATOR);
}

export function runChecks(input: CheckInput): MapCheck[] {
  const errors = collectErrors(input);
  // มี error แล้วไม่ต้องรายงาน warning — ไฟล์ยังไม่ถูกรับเข้าระบบอยู่ดี การแสดง
  // คำเตือนอีกสิบข้อพร้อมกันทำให้ข้อความที่ต้องลงมือแก้จริงจมหาย
  if (errors.length > 0) return errors;
  return collectWarnings(input);
}

function collectErrors({ fc, stats, layer }: CheckInput): MapCheck[] {
  const out: MapCheck[] = [];

  if (fc.features.length === 0) {
    out.push(mk('empty', 'error', 'ไฟล์ไม่มีข้อมูลสักรายการ', 0, []));
    return out; // ตรวจต่อไม่ได้ถ้าไม่มีอะไรให้ตรวจ
  }

  const noGeom = fc.features.filter(
    (f) => !f.geometry || !Array.isArray(f.geometry.coordinates)
  );
  if (noGeom.length > 0) {
    out.push(
      mk(
        'bad-geometry',
        'error',
        `มี ${noGeom.length} รายการที่ไม่มีรูปทรงหรือรูปทรงเสียหาย`,
        noGeom.length,
        noGeom.slice(0, SAMPLE_MAX).map((_, i) => `แถวที่ ${i + 1}`)
      )
    );
  }

  const [minLon, minLat, maxLon, maxLat] = stats.bbox;
  const [tMinLon, tMinLat, tMaxLon, tMaxLat] = THAILAND_BBOX;
  if (minLon < tMinLon || minLat < tMinLat || maxLon > tMaxLon || maxLat > tMaxLat) {
    out.push(
      mk(
        'outside-thailand',
        'error',
        `พิกัดอยู่นอกขอบเขตประเทศไทย (${minLon.toFixed(0)}, ${minLat.toFixed(0)}) — ` +
          'มักเกิดจากการ export โดยลืมเปลี่ยนระบบพิกัดจาก UTM เป็น EPSG:4326 ' +
          'ให้ตั้ง CRS ใน QGIS เป็น WGS 84 แล้ว export ใหม่',
        fc.features.length,
        []
      )
    );
  }

  const wrong = stats.geometryTypes.filter((t) => t !== layer.geometryType);
  if (wrong.length > 0) {
    out.push(
      mk(
        'geometry-type-mismatch',
        'error',
        `เลเยอร์นี้เก็บรูปทรงแบบ ${layer.geometryType} แต่ไฟล์มี ${wrong.join(', ')} — น่าจะอัปผิดเลเยอร์`,
        fc.features.length,
        wrong
      )
    );
  }

  return out;
}

function collectWarnings({
  fc,
  stats,
  sha256,
  layer,
  previous,
}: CheckInput): MapCheck[] {
  const out: MapCheck[] = [];

  if (previous && previous.sha256 === sha256) {
    out.push(
      mk(
        'identical',
        'warning',
        `เนื้อข้อมูลเหมือนเวอร์ชัน ${previous.versionNo} ที่เผยแพร่อยู่ทุกประการ — อาจอัปไฟล์เดิมซ้ำโดยไม่ตั้งใจ`,
        stats.featureCount,
        []
      )
    );
  }

  // ── คีย์ซ้ำ/ว่าง ────────────────────────────────────────────────────────
  if (layer.keyFields.length > 0) {
    const seen = new Map<string, number>();
    let missing = 0;
    for (const f of fc.features) {
      const key = featureKey(f, layer.keyFields);
      if (key === null) missing += 1;
      else seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const dupKeys = [...seen.entries()].filter(([, n]) => n > 1);
    const dupRows = dupKeys.reduce((sum, [, n]) => sum + n, 0);
    if (dupRows + missing > 0) {
      out.push(
        mk(
          'duplicate-key',
          'warning',
          `${layer.keyFields.join(' + ')} ซ้ำ ${dupRows} รายการ และว่าง ${missing} รายการ — ` +
            'ค่านี้ใช้เป็นตัวตนของแต่ละรายการในการเทียบส่วนต่าง ถ้าซ้ำจะบอกไม่ได้ว่ารายการไหนถูกแก้',
          dupRows + missing,
          dupKeys
            .slice(0, SAMPLE_MAX)
            .map(([k, n]) => `${k.split(KEY_SEPARATOR).join(' + ')} (${n} รายการ)`)
        )
      );
    }
  }

  // ── ประกอบคีย์กลับจากฟิลด์อื่นไม่ได้ ────────────────────────────────────
  if (layer.keyFields.length === 1 && layer.keyComposition.length > 0) {
    const bad: string[] = [];
    for (const f of fc.features) {
      const key = f.properties?.[layer.keyFields[0]];
      if (key === null || key === undefined || key === '') continue;
      const target = String(key);
      const usable = layer.keyComposition.filter((recipe) =>
        recipe.every((name) => {
          const v = f.properties?.[name];
          return v !== null && v !== undefined && v !== '';
        })
      );
      if (usable.length === 0) continue; // ฟิลด์ประกอบไม่ครบ ตัดสินไม่ได้ ไม่ใช่ความผิด
      const matched = usable.some(
        (recipe) => recipe.map((n) => String(f.properties![n])).join('') === target
      );
      if (!matched) bad.push(target);
    }
    if (bad.length > 0) {
      out.push(
        mk(
          'key-composition',
          'warning',
          `มี ${bad.length} รายการที่ ${layer.keyFields[0]} ประกอบกลับจากฟิลด์ย่อยไม่ได้ — ` +
            'มักแปลว่ากรอกเลขบล็อกหรือเลขล็อตผิด',
          bad.length,
          bad.slice(0, SAMPLE_MAX)
        )
      );
    }
  }

  // ── สตริงที่ใช้แทนค่าว่าง ───────────────────────────────────────────────
  const nullish: string[] = [];
  let nullishCount = 0;
  for (const f of fc.features) {
    for (const [key, v] of Object.entries(f.properties ?? {})) {
      if (typeof v === 'string' && NULL_LITERALS.has(v.trim().toLowerCase())) {
        nullishCount += 1;
        if (nullish.length < SAMPLE_MAX) nullish.push(`${key} = "${v}"`);
      }
    }
  }
  if (nullishCount > 0) {
    out.push(
      mk(
        'null-literal',
        'warning',
        `มี ${nullishCount} ช่องที่เก็บคำว่า "None"/"null" เป็นข้อความแทนที่จะเว้นว่าง`,
        nullishCount,
        nullish
      )
    );
  }

  // ── encoding พัง ────────────────────────────────────────────────────────
  const moji = new Map<string, number>();
  for (const f of fc.features) {
    for (const [key, v] of Object.entries(f.properties ?? {})) {
      if (typeof v === 'string' && MOJIBAKE.test(v)) {
        moji.set(key, (moji.get(key) ?? 0) + 1);
      }
    }
  }
  if (moji.size > 0) {
    const total = [...moji.values()].reduce((a, b) => a + b, 0);
    out.push(
      mk(
        'mojibake',
        'warning',
        `พบข้อความภาษาไทยที่อ่านไม่ออก ${total} ช่อง — เกิดตอน export ด้วยรหัสอักขระผิด ให้ตั้ง encoding เป็น UTF-8 แล้ว export ใหม่`,
        total,
        [...moji.entries()].slice(0, SAMPLE_MAX).map(([k, n]) => `${k} (${n} ช่อง)`)
      )
    );
  }

  // ── ฟิลด์ใหม่ที่ยังไม่เปิดสาธารณะ ───────────────────────────────────────
  if (layer.visibility === 'public') {
    const known = new Set(layer.publicFields);
    const fresh = stats.fields.map((f) => f.name).filter((n) => !known.has(n));
    if (fresh.length > 0) {
      out.push(
        mk(
          'new-public-candidate',
          'warning',
          `มี ${fresh.length} ฟิลด์ที่ยังไม่ได้เปิดเผยต่อสาธารณะ — ถ้าต้องการเปิด ให้ไปติ๊กในหน้าตั้งค่าเลเยอร์`,
          fresh.length,
          fresh.slice(0, SAMPLE_MAX)
        )
      );
    }
  }

  if (!previous) return out;

  // ── เทียบกับเวอร์ชันที่เผยแพร่อยู่ ──────────────────────────────────────
  const before = previous.stats.featureCount;
  const now = stats.featureCount;
  if (before > 0 && Math.abs(now - before) / before > COUNT_JUMP_RATIO) {
    out.push(
      mk(
        'count-jump',
        'warning',
        `จำนวนรายการเปลี่ยนจาก ${before} เป็น ${now} (${now > before ? '+' : ''}${now - before})`,
        Math.abs(now - before),
        []
      )
    );
  }

  const nowFields = new Set(stats.fields.map((f) => f.name));
  const gone = previous.stats.fields.map((f) => f.name).filter((n) => !nowFields.has(n));
  if (gone.length > 0) {
    out.push(
      mk(
        'field-removed',
        'warning',
        `ฟิลด์ที่เคยมีหายไป ${gone.length} ฟิลด์ — ระบบอื่นที่ดึงข้อมูลไปใช้อาจพัง`,
        gone.length,
        gone.slice(0, SAMPLE_MAX)
      )
    );
  }

  const fresh: string[] = [];
  let freshCount = 0;
  for (const field of stats.fields) {
    if (!field.values || field.distinct > CATEGORICAL_MAX) continue;
    const old = previous.stats.fields.find((f) => f.name === field.name);
    if (!old?.values) continue; // เวอร์ชันก่อนไม่ได้เก็บรายการค่า เทียบไม่ได้
    const known = new Set(old.values);
    for (const v of field.values) {
      if (known.has(v)) continue;
      freshCount += 1;
      if (fresh.length < SAMPLE_MAX) fresh.push(`${field.name} = "${v}"`);
    }
  }
  if (freshCount > 0) {
    out.push(
      mk(
        'new-value',
        'warning',
        `มีค่าที่ไม่เคยปรากฏในเวอร์ชัน ${previous.versionNo} จำนวน ${freshCount} ค่า — ถ้าไม่ได้ตั้งใจเพิ่ม อาจเป็นการพิมพ์ผิด`,
        freshCount,
        fresh
      )
    );
  }

  return out;
}

function mk(
  code: MapCheck['code'],
  level: MapCheck['level'],
  message: string,
  count: number,
  sample: string[]
): MapCheck {
  return { code, level, message, count, sample };
}
