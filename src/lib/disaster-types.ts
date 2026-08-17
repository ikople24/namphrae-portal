// ค่าคงที่ประเภทภัย — client-safe ห้าม import mongo/clerk ที่นี่
// ทั้งหน้าเว็บและ store ฝั่งเซิร์ฟเวอร์ import จากไฟล์นี้ตัวเดียวกัน

export const DISASTER_TYPES = ['WILDFIRE', 'FLOOD', 'LANDSLIDE', 'DROUGHT'] as const;
export type DisasterType = (typeof DISASTER_TYPES)[number];
export const DISASTER_LABELS: Record<DisasterType, string> = {
  WILDFIRE: 'ไฟป่า',
  FLOOD: 'อุทกภัย',
  LANDSLIDE: 'ดินโคลนถล่ม',
  DROUGHT: 'ภัยแล้ง',
};

// สี categorical ของแต่ละภัย — ผ่าน CVD validation (dataviz), ใช้ร่วมกันทุกกราฟ/แผนที่
export const DISASTER_COLORS: Record<DisasterType, string> = {
  WILDFIRE: '#e34948',
  FLOOD: '#2a78d6',
  LANDSLIDE: '#6b4423', // น้ำตาลเข้ม (สื่อดินโคลน)
  DROUGHT: '#eda100',
};
