// Pure model ของชั้นสิทธิ์รายฟีเจอร์ (namphrae_portal.userAccess) — client-safe,
// ห้าม import mongo/clerk. กฎทั้งหมดตรึงด้วย user-access.test.ts
// (แพทเทิร์นเดียวกับ admin-registry-gate.ts)

export const FEATURES = ['links', 'categories', 'calendar', 'map', 'data', 'settings'] as const;
export type FeatureKey = (typeof FEATURES)[number];

// สมาชิกที่ผู้จัดการยังไม่เคยตั้งค่า (รวมสมาชิกเก่าทุกคน ณ วันเปิดใช้ระบบสิทธิ์)
export const DEFAULT_FEATURES: readonly FeatureKey[] = ['calendar', 'data'];

// หน้าแรกของแต่ละฟีเจอร์ — ใช้เป็นปลายทาง redirect เมื่อเข้าหน้าที่ไม่มีสิทธิ์
// ลำดับความสำคัญ = ลำดับใน FEATURES
export const FEATURE_HOME: Record<FeatureKey, string> = {
  links: '/admin',
  categories: '/admin/categories',
  calendar: '/admin/calendar',
  map: '/admin/map',
  data: '/admin/data',
  settings: '/admin/settings',
};

export const FEATURE_LABELS: { key: FeatureKey; label: string }[] = [
  { key: 'links', label: 'ลิงก์บริการ' },
  { key: 'categories', label: 'หมวดหมู่' },
  { key: 'calendar', label: 'ปฏิทิน' },
  { key: 'map', label: 'แผนที่' },
  { key: 'data', label: 'นำเข้า/ส่งออก' },
  { key: 'settings', label: 'ตั้งค่าเว็บ' },
];

export type ResolvedAccess = { features: FeatureKey[]; isManager: boolean };

export function isEnvManager(
  clerkId: string | null | undefined,
  managerEnvId: string | undefined
): boolean {
  return Boolean(managerEnvId) && clerkId === managerEnvId;
}

// doc ไม่มี = ใช้ default; doc มีแต่ features ว่าง = ไม่เห็นอะไรเลย (ตั้งใจ —
// ผู้จัดการถอดหมดแล้ว ต้องไม่เด้งกลับเป็น default เอง)
export function resolveAccess(args: {
  doc: { features?: unknown; isManager?: unknown } | null;
  clerkId: string;
  managerEnvId: string | undefined;
}): ResolvedAccess {
  const isManager =
    isEnvManager(args.clerkId, args.managerEnvId) || args.doc?.isManager === true;
  if (isManager) return { isManager: true, features: [...FEATURES] };
  if (!args.doc) return { isManager: false, features: [...DEFAULT_FEATURES] };
  const stored = Array.isArray(args.doc.features) ? args.doc.features : [];
  return { isManager: false, features: FEATURES.filter((f) => stored.includes(f)) };
}

export function hasFeature(
  access: { features: FeatureKey[]; isManager: boolean },
  feature: FeatureKey
): boolean {
  return access.isManager || access.features.includes(feature);
}

export function firstAllowedPath(access: ResolvedAccess): string | null {
  if (access.isManager) return '/admin';
  const first = FEATURES.find((f) => access.features.includes(f));
  return first ? FEATURE_HOME[first] : null;
}
