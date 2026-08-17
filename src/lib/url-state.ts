// helper อ่านค่าจาก router.query (string | string[] | undefined) แบบ validate

/** คืน value ถ้าอยู่ใน allowed ไม่งั้นคืน fallback */
export function pickOne<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** parse ปี พ.ศ. — คืน null ถ้าไม่ใช่จำนวนเต็มในช่วง 2400–2700 */
export function readYear(value: unknown): number | null {
  const v = Array.isArray(value) ? value[0] : value;
  if (typeof v !== 'string') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 2400 && n <= 2700 ? n : null;
}

/** parse โรคจาก query — 'dengue' | 'chikungunya' (default dengue) */
export function readDisease(value: unknown): 'dengue' | 'chikungunya' {
  return pickOne(value, ['dengue', 'chikungunya'] as const, 'dengue');
}
