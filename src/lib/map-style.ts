// สีและลำดับการวางซ้อนของแต่ละเลเยอร์บนหน้าแผนที่
//
// เลือกจากหน้าที่ของข้อมูล ไม่ใช่จากความสวย: ขอบเขตหมู่เป็นกรอบอ้างอิงจึงเป็นเส้น
// ไม่มีพื้น ส่วนแปลงที่ดินกับอาคารเป็นเนื้อหาหลักจึงมีพื้นโปร่งพอให้เห็นภาพดาวเทียม
// ข้างใต้ — บนภาพดาวเทียมสีเข้มทึบจะบังสิ่งที่คนกำลังเทียบอยู่พอดี

export type LayerStyle = {
  color: string;
  weight: number;
  fillColor?: string;
  fillOpacity: number;
  /** ยิ่งมากยิ่งอยู่บน — ขอบเขตหมู่ต้องอยู่บนสุดเพื่อให้เห็นกรอบเสมอ */
  order: number;
  /** เปิดไว้ตั้งแต่แรกไหม — เลเยอร์หนักปิดไว้ก่อนเพื่อไม่ให้หน้าเปิดช้า */
  defaultOn: boolean;
};

export const LAYER_STYLES: Record<string, LayerStyle> = {
  'zone-moobang': {
    color: '#f59e0b',
    weight: 2.5,
    fillOpacity: 0,
    order: 40,
    defaultOn: true,
  },
  road: {
    color: '#ffffff',
    weight: 1.5,
    fillOpacity: 0,
    order: 30,
    defaultOn: true,
  },
  building: {
    color: '#f87171',
    weight: 0.5,
    fillColor: '#ef4444',
    fillOpacity: 0.35,
    order: 20,
    // 5,460 รูปทรง — เปิดเองได้แต่ไม่เปิดให้ตั้งแต่แรก
    defaultOn: false,
  },
  parcel: {
    color: '#38bdf8',
    weight: 0.6,
    fillColor: '#0ea5e9',
    fillOpacity: 0.12,
    order: 10,
    // 7,970 รูปทรง ~4 MB — เปิดตอนต้องใช้เท่านั้น
    defaultOn: false,
  },
};

export const FALLBACK_STYLE: LayerStyle = {
  color: '#22c55e',
  weight: 1.5,
  fillColor: '#22c55e',
  fillOpacity: 0.2,
  order: 0,
  defaultOn: false,
};

export function styleOf(layerId: string): LayerStyle {
  return LAYER_STYLES[layerId] ?? FALLBACK_STYLE;
}

// ชื่อฟิลด์ที่คนอ่านรู้เรื่อง — ใช้ในป๊อปอัปตอนคลิกดูรายละเอียด ฟิลด์ที่ไม่อยู่ใน
// นี้แสดงชื่อดิบตามที่มีในไฟล์ ไม่ซ่อน เพราะการซ่อนฟิลด์ที่ไม่รู้จักทำให้ข้อมูลที่
// เพิ่งเพิ่มเข้ามาหายไปจากสายตาโดยไม่มีใครรู้
export const FIELD_LABELS: Record<string, string> = {
  zone_id: 'โซน/หมู่',
  'Area Km2': 'พื้นที่ (ตร.กม.)',
  'Area Ria': 'พื้นที่ (ไร่)',
  parcel_cod: 'รหัสแปลง',
  block_id: 'บล็อก',
  lot: 'ล็อต',
  rai: 'ไร่',
  ngan: 'งาน',
  wa: 'ตร.วา',
  subwa: 'เศษ ตร.วา',
  province: 'จังหวัด',
  amphur: 'อำเภอ',
  tambol: 'ตำบล',
  Id_Chanod: 'เลขโฉนด',
  parcel_no: 'เลขที่ดิน',
  survey_no: 'เลขที่สำรวจ',
  land_no: 'หน้าสำรวจ',
  own_Hse_no: 'บ้านเลขที่เจ้าของ',
  own_moo: 'หมู่ (เจ้าของ)',
  own_soi: 'ซอย (เจ้าของ)',
  own_villag: 'หมู่บ้าน (เจ้าของ)',
  own_road: 'ถนน (เจ้าของ)',
  own_tambol: 'ตำบล (เจ้าของ)',
  own_amphur: 'อำเภอ (เจ้าของ)',
  own_provin: 'จังหวัด (เจ้าของ)',
  name: 'ชื่อ',
  name_en: 'ชื่อ (อังกฤษ)',
  alt_name_e: 'ชื่ออื่น',
  ref: 'รหัสสายทาง',
  highway: 'ประเภทถนน',
  surface: 'ผิวทาง',
  lanes: 'ช่องจราจร',
  maxspeed: 'จำกัดความเร็ว',
};

export function labelOf(field: string): string {
  return FIELD_LABELS[field] ?? field;
}
