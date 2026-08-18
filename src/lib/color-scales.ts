// สเกลสีไล่เฉดสำหรับแผนที่ choropleth
// ตั้งใจไม่ import leaflet เพื่อให้หน้าเว็บ import ได้โดยไม่ลาก react-leaflet เข้า
// server bundle — import จาก component แผนที่ตรง ๆ จะทำให้ `next build` พัง
export const DENGUE_SCALE = ['#c7e9b4', '#78c679', '#f7d94c', '#f0932b', '#d1495b'];
export const DISASTER_SCALE = ['#e9f2ec', '#c4e2d3', '#8fccb1', '#4ba888', '#0e7c66'];
