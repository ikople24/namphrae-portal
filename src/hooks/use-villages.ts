import { useEffect, useState } from 'react';
import type { VillageCollection } from '@/lib/village-geo';

// ขอบเขตหมู่บ้านเป็นไฟล์ static ก้อนเดียว (~70 KB) ที่ทั้งสามหน้าของภัยพิบัติต้องใช้
// เหมือนกัน — ต้นทางเขียน fetch เดียวกันซ้ำสามที่ รวมไว้ที่เดียวตั้งแต่แรกดีกว่า
//
// พังแล้วคืน null ไม่ throw: หน้าแผนที่ยังแสดงหมุดได้โดยไม่มีเส้นขอบหมู่ ส่วนสถิติ
// รายหมู่จะว่าง ซึ่งแย่กว่าแต่ยังดีกว่าทั้งหน้าล่ม
export function useVillages(): VillageCollection | null {
  const [villages, setVillages] = useState<VillageCollection | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/cmu_namphare.geojson')
      .then((r) => r.json())
      .then((v: VillageCollection) => alive && setVillages(v))
      .catch(() => alive && setVillages(null));
    return () => {
      alive = false;
    };
  }, []);
  return villages;
}
